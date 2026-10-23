import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { afterEach, beforeAll, expect, vi } from 'vitest'
import { contract } from '../../src/test/contract'
import { actionsHttp, everyStoredValue } from './actions-fixture'
import { matureLoad } from './load-time-fixture'

declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(() => applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__))
afterEach(() => { vi.restoreAllMocks() })

type Received = { url: string; eventId: string; eventType: string; timestamp: string; signature: string; body: string }
type Answer = (index: number, request: Received) => Response
const hex = (bytes: ArrayBuffer) => [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('')
// The receiver's side of the documented contract: HMAC-SHA256 of the exact body, keyed by the secret's UTF-8 bytes.
async function expectedSignature(secret: string, body: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return `sha256=${hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)))}`
}
const minute = 60_000
const receiverOrigin = 'http://127.0.0.1:9'

contract(['INTEG-010', 'INTEG-015', 'DATA-002'], 'signed response events verify, retry on one event ID, replay, disable with an alert and list undelivered responses without ever blocking collection', async () => {
  const f = await actionsHttp({}, 'hooks')
  await env.DB.prepare("UPDATE oa_operators SET role='owner' WHERE id=?").bind(f.lead.operatorId).run()
  await env.DB.prepare('UPDATE oa_sessions SET operator_version=(SELECT version FROM oa_operators WHERE id=operator_id) WHERE operator_id=?').bind(f.lead.operatorId).run()
  const received: Received[] = [], answers = new Map<string, Answer>()
  const network = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input instanceof Request ? input.url : input)
    if (!url.startsWith(receiverOrigin)) throw new Error('Unexpected external request')
    const headers = new Headers(init?.headers), request: Received = { url, eventId: headers.get('pencil-event-id')!, eventType: headers.get('pencil-event-type')!, timestamp: headers.get('pencil-timestamp')!, signature: headers.get('pencil-signature')!, body: String(init?.body) }
    expect(init?.redirect).toBe('manual')
    received.push(request)
    return (answers.get(new URL(url).pathname) ?? (() => new Response(null, { status: 204 })))(received.filter(item => item.url === url).length, request)
  })
  const accepted = async <T>(response: Response, status = 200) => { expect(response.status, await response.clone().text()).toBe(status); return response.json() as Promise<T> }
  const slug = (await env.DB.prepare('SELECT slug FROM flows WHERE id=?').bind(f.flowId).first<{ slug: string }>())!.slug
  const submit = async (text = 'synthetic-pencil-answer', options: { honeypot?: string } = {}) => {
    const session = await f.services.responses.startPublicSession({ slug, deviceClass: 'mobile', source: 'direct', clientAddress: `${slug}-${crypto.randomUUID()}` })
    await matureLoad(session, 5000)
    const draft = await f.services.flows.getBuilderDraft(f.workspaceId, f.flowId), step = draft.steps.find(item => item.prompt === 'Anything else?')!, choice = draft.steps.find(item => item.prompt === 'How was the wait?')!
    const option = draft.choices.find(item => item.stepId === choice.id && item.label === 'Short')!
    await f.services.responses.submitPublicResponse({ slug, sessionId: session.sessionId, sessionToken: session.sessionToken, loadTime: session.loadTime, idempotencyKey: `key-${session.sessionId}`, answers: [{ stepId: choice.id, value: option.id }, { stepId: step.id, value: text }], honeypot: options.honeypot ?? '', clientAddress: `${slug}-${session.sessionId}` })
    return (await env.DB.prepare('SELECT id, state FROM responses WHERE session_id=?').bind(session.sessionId).first<{ id: string; state: string }>())!
  }
  const deliveries = async (endpointId: string) => (await accepted<{ deliveries: Array<{ id: string; eventId: string; eventType: string; responseId: string | null; status: string; attempts: number; reason: string | null; attemptLog: Array<{ event: string; httpStatus: number | null; outcomeClass: string | null }> }> }>(await f.call(`/api/app/webhooks/deliveries?endpointId=${endpointId}`))).deliveries
  const ledger = async (state?: string) => (await accepted<{ deliveries: Array<{ kind: string; subject: string; state: string; idempotencyKey: string; responseId: string | null; attempts: Array<{ outcome: string | null; httpStatus: number | null; reason: string | null }> }> }>(await f.call(`/api/app/integration-deliveries${state ? `?state=${state}` : ''}`))).deliveries
  const dispatcher = f.services.webhooks.dispatcher

  // The owner registers an endpoint for this form; only the owner may, the address must be safe, and the secret is shown once.
  const member = await f.operator('Member operator'), asMember = f.as(member.token)
  await env.DB.prepare("UPDATE oa_operators SET role='member' WHERE id=?").bind(member.operatorId).run()
  await env.DB.prepare('UPDATE oa_sessions SET operator_version=(SELECT version FROM oa_operators WHERE id=operator_id) WHERE operator_id=?').bind(member.operatorId).run()
  expect((await asMember('/api/app/webhooks', { url: `${receiverOrigin}/hook`, flowId: f.flowId })).status).toBe(403)
  for (const url of ['http://example.test/hook', 'https://user:pass@example.test/hook', 'https://example.test/hook?token=1', 'https://10.0.0.5/hook', 'not a url']) expect((await f.call('/api/app/webhooks', { url })).status, url).toBe(400)
  const created = await accepted<{ endpoint: { id: string; secretSet: boolean }; secret: string }>(await f.call('/api/app/webhooks', { url: `${receiverOrigin}/hook`, flowId: f.flowId }), 201)
  const endpointId = created.endpoint.id, secret = created.secret
  expect(JSON.stringify(await accepted(await f.call('/api/app/webhooks')))).not.toContain(secret)
  expect(created.endpoint.secretSet).toBe(true)
  expect((await env.DB.prepare('SELECT sealed_secret FROM response_webhook_endpoints WHERE id=?').bind(endpointId).first<{ sealed_secret: string }>())!.sealed_secret).not.toContain(secret)
  expect((await everyStoredValue()).filter(value => value.includes(secret))).toEqual([])

  // A receiver that answers 500 twice sees two retries on the same event ID, each signed; then the event is confirmed.
  answers.set('/hook', index => new Response(null, { status: index <= 2 ? 500 : 204 }))
  const first = await submit('ANSWER-CANARY-6a1 private text'), start = Date.now()
  expect(first.state).toBe('released')
  await dispatcher.run(new Date(start).toISOString()); await dispatcher.run(new Date(start + minute).toISOString())
  expect(received).toHaveLength(2)
  await dispatcher.run(new Date(start + 2 * minute).toISOString())
  expect(received).toHaveLength(2)
  await dispatcher.run(new Date(start + 5 * minute).toISOString())
  expect(received).toHaveLength(3)
  expect(new Set(received.map(item => item.eventId)).size).toBe(1)
  for (const item of received) {
    expect(item.signature).toBe(await expectedSignature(secret, item.body))
    const body = JSON.parse(item.body)
    expect(body).toMatchObject({ id: item.eventId, type: 'response.created', formId: f.flowId, revisionId: f.revisionId, responseId: first.id })
    expect(Number(item.timestamp)).toBe(Math.floor(Date.parse(body.sentAt) / 1000))
    expect(Object.keys(body).sort()).toEqual(['apiVersion', 'attempt', 'formId', 'id', 'occurredAt', 'responseId', 'revisionId', 'sentAt', 'type'])
    expect(item.body).not.toContain('ANSWER-CANARY')
  }
  expect((await expectedSignature('another-secret', received[0].body))).not.toBe(received[0].signature)
  const [delivery] = await deliveries(endpointId)
  expect(delivery).toMatchObject({ status: 'confirmed', attempts: 3, eventType: 'response.created', responseId: first.id })
  expect(delivery.attemptLog.map(attempt => `${attempt.event}:${attempt.httpStatus ?? ''}`)).toEqual(['started:', 'failed:500', 'started:', 'failed:500', 'started:', 'confirmed:204'])

  // Replay re-sends the same event ID and records a new attempt.
  const replayed = await accepted<{ delivery: typeof delivery }>(await f.call(`/api/app/webhooks/deliveries/${delivery.id}/replay`, {}))
  expect(received).toHaveLength(4)
  expect(received[3].eventId).toBe(received[0].eventId)
  expect(replayed.delivery).toMatchObject({ status: 'confirmed', attempts: 4 })
  expect(replayed.delivery.attemptLog.map(attempt => attempt.event)).toContain('replay')
  expect((await asMember(`/api/app/webhooks/deliveries/${delivery.id}/replay`, {})).status).toBe(403)

  // Quarantined responses are announced only when released; a test event is signed too; a redirect is never followed.
  const held = await submit('held', { honeypot: 'scanner' })
  expect(held.state).toBe('quarantined')
  await dispatcher.run(new Date(start + 10 * minute).toISOString()); expect(received).toHaveLength(4)
  await f.services.responses.releaseQuarantinedResponse({ workspaceId: f.workspaceId, responseId: held.id, operatorId: f.owner.operatorId })
  await dispatcher.run(new Date(Date.now() + minute).toISOString())
  expect(JSON.parse(received.at(-1)!.body)).toMatchObject({ type: 'response.created', responseId: held.id })
  // PART-002 and PAY-001 events: a saved partial names only the form and revision; a payment change names only its enumerated state.
  const publicCall = (path: string, body: unknown) => f.app.request(`http://localhost${path}`, { method: 'POST', headers: { Host: 'localhost', Origin: 'http://localhost', 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.77' }, body: JSON.stringify(body) })
  const partial = await accepted<{ sessionId: string; sessionToken: string; flow: { steps: Array<{ id: string }> } }>(await publicCall(`/api/public/flows/${slug}/sessions`, { deviceClass: 'desktop', source: 'direct' }), 201)
  await accepted(await publicCall(`/api/public/flows/${slug}/sessions/save`, { sessionId: partial.sessionId, sessionToken: partial.sessionToken, commandKey: crypto.randomUUID(), email: 'synthetic-pencil-partial@example.test', currentStepId: partial.flow.steps[0].id, answers: [] }), 200)
  await env.DB.prepare("INSERT INTO response_payments (response_id, step_id, completion_step_id, provider, livemode, state, attempt, amount, currency, lines_json, state_changed_at, created_at, updated_at) VALUES (?, 'synthetic-pencil-step', 'synthetic-pencil-end', 'stripe', 0, 'pending', 1, 1200, 'usd', '[]', ?, ?, ?)").bind(held.id, new Date().toISOString(), new Date().toISOString(), new Date().toISOString()).run()
  await env.DB.prepare("UPDATE response_payments SET state = 'paid' WHERE response_id = ?").bind(held.id).run()
  await dispatcher.run(new Date(Date.now() + minute).toISOString())
  const partialEvent = JSON.parse(received.find(item => item.eventType === 'response.partial_saved')!.body), paymentEvent = JSON.parse(received.find(item => item.eventType === 'payment.changed')!.body)
  expect(partialEvent).toMatchObject({ type: 'response.partial_saved', formId: f.flowId, revisionId: f.revisionId, responseId: null })
  expect(paymentEvent).toMatchObject({ type: 'payment.changed', responseId: held.id, payment: { state: 'paid' } })
  expect(JSON.stringify(received.map(item => item.body))).not.toContain('synthetic-pencil-partial@example.test')
  answers.set('/redirect', () => new Response(null, { status: 307, headers: { location: 'http://10.0.0.5/private' } }))
  const redirecting = await accepted<{ endpoint: { id: string } }>(await f.call('/api/app/webhooks', { url: `${receiverOrigin}/redirect` }), 201)
  const test = await accepted<{ delivery: { status: string; eventType: string; attemptLog: Array<{ outcomeClass: string | null }> } }>(await f.call(`/api/app/webhooks/${redirecting.endpoint.id}/test`, {}))
  expect(test.delivery).toMatchObject({ status: 'pending', eventType: 'webhook.test' })
  expect(test.delivery.attemptLog.map(attempt => attempt.outcomeClass)).toContain('3xx')
  expect(received.filter(item => item.url.includes('private'))).toEqual([])
  expect((await f.call(`/api/app/webhooks/${redirecting.endpoint.id}`, undefined, { method: 'DELETE' })).status).toBe(204)

  // Collection is never blocked: with the receiver down a response still commits, and five failed deliveries are listed by response ID with an alert.
  answers.set('/hook', () => new Response(null, { status: 503 }))
  await f.call(`/api/app/webhooks/${endpointId}/pause`, {}); await f.call(`/api/app/webhooks/${endpointId}/resume`, {})
  const lost = []
  for (let index = 0; index < 5; index++) lost.push(await submit(`outage-${index}`))
  expect((await env.DB.prepare('SELECT count(*) AS n FROM responses WHERE id IN (?,?,?,?,?)').bind(...lost.map(row => row.id)).first<{ n: number }>())!.n).toBe(5)
  const outage = Date.now() + 20 * minute
  await dispatcher.run(new Date(outage).toISOString())
  const failing = await deliveries(endpointId)
  expect(failing.filter(item => item.status === 'pending' && item.attempts === 1).map(item => item.responseId).sort()).toEqual(lost.map(row => row.id).sort())
  expect((await accepted<{ responses: Array<{ responseId: string }> }>(await f.call(`/api/app/webhooks/${endpointId}/undelivered`))).responses.map(item => item.responseId).sort()).toEqual(lost.map(row => row.id).sort())
  expect((await accepted<{ alerts: Array<{ kind: string }> }>(await f.call('/api/app/webhooks/alerts'))).alerts[0].kind).toBe('failing')
  // The ladder ends 24 hours after the first attempt: the events fail, and sustained failure disables the endpoint with an alert.
  for (const offset of [1, 5, 15, 30, 60, 120, 240, 480, 960, 1440]) await dispatcher.run(new Date(outage + offset * minute).toISOString())
  const failed = await deliveries(endpointId)
  expect(failed.filter(item => lost.some(row => row.id === item.responseId)).map(item => item.status)).toEqual(Array(5).fill('failed'))
  expect(failed.find(item => item.responseId === lost[0].id)!.attempts).toBe(11)
  const endpoint = (await accepted<{ endpoints: Array<{ id: string; state: string; disabledReason: string; failed: number }> }>(await f.call('/api/app/webhooks'))).endpoints.find(item => item.id === endpointId)!
  expect(endpoint).toMatchObject({ state: 'disabled', failed: 5 })
  // INTEG-015: the one ledger lists the five failed deliveries by response ID, each with its own idempotency key and every attempt's reason.
  const broken = (await ledger('failed')).filter(item => item.kind === 'webhook' && lost.some(row => row.id === item.responseId))
  expect(broken).toHaveLength(5)
  expect(new Set(broken.map(item => item.idempotencyKey)).size).toBe(5)
  for (const item of broken) {
    expect(item.subject).toBe('response.created')
    expect(item.attempts.filter(attempt => attempt.outcome === 'failed')).toHaveLength(11)
    expect(item.attempts.at(-1)).toMatchObject({ httpStatus: 503, reason: expect.stringContaining('503') })
  }
  expect(endpoint.disabledReason).toMatch(/24 hours/)
  expect((await accepted<{ alerts: Array<{ kind: string; message: string }> }>(await f.call('/api/app/webhooks/alerts'))).alerts).toEqual([expect.objectContaining({ kind: 'disabled', message: expect.stringContaining('disabled') })])
  const afterDisable = received.length
  const unsent = await submit('after-disable')
  await dispatcher.run(new Date(outage + 1500 * minute).toISOString())
  expect(received).toHaveLength(afterDisable)
  expect(unsent.state).toBe('released')
  expect((await f.call(`/api/app/webhooks/${endpointId}/test`, {})).status).toBe(409)

  // The receiver is repaired: resuming and replaying the five failed events confirms each once, with no duplicate delivery.
  answers.set('/hook', () => new Response(null, { status: 204 }))
  await accepted(await f.call(`/api/app/webhooks/${endpointId}/resume`, {}))
  const before = received.length
  for (const item of failed.filter(entry => lost.some(row => row.id === entry.responseId))) await accepted(await f.call(`/api/app/webhooks/deliveries/${item.id}/replay`, {}))
  const resent = received.slice(before).filter(item => item.eventType === 'response.created')
  expect(resent.map(item => JSON.parse(item.body).responseId).sort()).toEqual(lost.map(row => row.id).sort())
  expect(new Set(resent.map(item => item.eventId)).size).toBe(5)
  const repaired = (await ledger('confirmed')).filter(item => lost.some(row => row.id === item.responseId))
  expect(repaired.map(item => item.idempotencyKey).sort()).toEqual(broken.map(item => item.idempotencyKey).sort())
  expect((await env.DB.prepare("SELECT count(*) AS n FROM response_event_deliveries WHERE event_type = 'response.created' AND response_id IN (?,?,?,?,?)").bind(...lost.map(row => row.id)).first<{ n: number }>())!.n).toBe(5)
  expect((await accepted<{ responses: unknown[] }>(await f.call(`/api/app/webhooks/${endpointId}/undelivered`))).responses.map(item => JSON.stringify(item))).toEqual([JSON.stringify({ responseId: unsent.id, status: 'pending' })])
  await dispatcher.run(new Date(Date.now() + minute).toISOString())
  expect((await deliveries(endpointId)).filter(item => item.eventType === 'response.created' && item.status === 'confirmed')).toHaveLength(8)
  expect((await accepted<{ alerts: unknown[] }>(await f.call('/api/app/webhooks/alerts'))).alerts).toEqual([])

  // Erasure removes the response's deliveries and queues one deletion notice that names only the response.
  await f.services.responses.eraseReleasedResponse({ workspaceId: f.workspaceId, responseId: first.id, operatorId: f.owner.operatorId })
  expect((await env.DB.prepare("SELECT count(*) AS n FROM response_event_deliveries WHERE response_id=? AND event_type='response.created'").bind(first.id).first<{ n: number }>())!.n).toBe(0)
  await dispatcher.run(new Date(Date.now() + minute).toISOString())
  expect(JSON.parse(received.at(-1)!.body)).toMatchObject({ type: 'response.deleted', responseId: first.id })
  expect((await env.DB.prepare("SELECT response_id AS responseId, status FROM response_event_deliveries WHERE event_type='response.deleted'").first())).toEqual({ responseId: null, status: 'confirmed' })

  // The secret rotates (the old one stops verifying) and removal discards the endpoint with its ledger.
  const rotated = await accepted<{ secret: string }>(await f.call(`/api/app/webhooks/${endpointId}/rotate`, {}))
  expect(rotated.secret).not.toBe(secret)
  await submit('after-rotation'); await dispatcher.run(new Date(Date.now() + minute).toISOString())
  expect(received.at(-1)!.signature).toBe(await expectedSignature(rotated.secret, received.at(-1)!.body))
  expect(received.at(-1)!.signature).not.toBe(await expectedSignature(secret, received.at(-1)!.body))
  expect((await f.call(`/api/app/webhooks/${endpointId}`, undefined, { method: 'DELETE' })).status).toBe(204)
  expect((await env.DB.prepare('SELECT count(*) AS n FROM response_event_deliveries WHERE endpoint_id=?').bind(endpointId).first<{ n: number }>())!.n).toBe(0)
  network.mockRestore()
})
