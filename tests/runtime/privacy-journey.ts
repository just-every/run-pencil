import { seedPrivacyForm } from './privacy-fixture'
import { env } from 'cloudflare:test'
import { expect } from 'vitest'
import { actionsHttp } from './actions-fixture'
import { matureLoad } from './load-time-fixture'
import { resumeBearer } from '../../src/core/features/resuming/credentials'

type Fixture = Awaited<ReturnType<typeof actionsHttp>>
export async function privacyRequestJourney(f: Fixture, receiver: string) {
  const mailbox = ['synthetic-pencil-privacy', 'example.test'].join('@'), phone = '+61412345678'
  const accepted = async (response: Response, status = 200): Promise<any> => {
    expect(response.status, await response.clone().text()).toBe(status)
    return response.status === 204 ? undefined : response.json()
  }
  const call = async (path: string, body?: unknown, method?: string) => accepted(await f.call(path, body, { method }))
  await env.DB.prepare("UPDATE oa_operators SET role='admin' WHERE id=?").bind(f.lead.operatorId).run()
  await env.DB.prepare('UPDATE oa_sessions SET operator_version=(SELECT version FROM oa_operators WHERE id=operator_id) WHERE operator_id=?').bind(f.lead.operatorId).run()
  await env.DB.prepare("UPDATE oa_operators SET role='member' WHERE id=?").bind(f.owner.operatorId).run()
  await env.DB.prepare('UPDATE oa_sessions SET operator_version=(SELECT version FROM oa_operators WHERE id=operator_id) WHERE operator_id=?').bind(f.owner.operatorId).run()
  const foreign = await actionsHttp({}, 'privacy-foreign-' + crypto.randomUUID().slice(0, 8))
  await foreign.respond('Short', mailbox)
  const foreignId = (await env.DB.prepare('SELECT id FROM responses WHERE workspace_id=?').bind(foreign.workspaceId).first<{id:string}>())!.id
  const contact = await accepted(await f.call('/api/app/distribution/contacts', { name: 'Privacy request person', email: mailbox, mobile: phone, fields: { reference: 'synthetic-pencil-private-contact' } }), 201)
  const flows: Array<{ id: string; slug: string; steps: any[]; responseId: string; session: any; answers: any[]; book: string }> = []
  for (let index = 0; index < 3; index++) {
    const flow = await seedPrivacyForm(f.workspaceId, index), slug = flow.slug, base = `/api/app/flows/${flow.id}`
    const session = await accepted(await f.call(`/api/public/flows/${slug}/sessions`, { source: 'direct', deviceClass: 'desktop' }), 201)
    await matureLoad(session, 5000)
    const answers = session.flow.steps.filter((step: any) => step.kind === 'question').map((step: any) => ({ stepId: step.id, value: step.questionType === 'email' ? mailbox : step.questionType === 'phone' ? { number: phone } : `synthetic-pencil-private-answer-${index}` }))
    const submitted = await accepted(await f.call(`/api/public/flows/${slug}/responses`, { ...session, answers, idempotencyKey: 'synthetic-pencil-privacy-' + index, honeypot: '' }), 201)
    const book = 'synthetic-pencil-privacy-' + index
    await call(base + '/google-sheet', { spreadsheetId: book, tab: 'Synthetic responses' }, 'PUT')
    flows.push({ ...flow, slug, responseId: submitted.responseId, session, answers, book, steps: session.flow.steps })
  }
  const first = flows[0], base = `/api/app/flows/${first.id}`
  // Explicitly saved data whose delivery address is already gone still belongs in the request.
  const saved = await accepted(await f.call(`/api/public/flows/${first.slug}/sessions`, { source: 'direct', deviceClass: 'mobile' }), 201)
  const emailStep = first.steps.find(step => step.questionType === 'email'), phoneStep = first.steps.find(step => step.questionType === 'phone')
  const saveInput = { ...saved, commandKey: 'synthetic-pencil-save', email: mailbox, currentStepId: phoneStep.id, answers: [{ stepId: emailStep.id, value: ['synthetic-pencil-other-save', 'example.test'].join('@') }] }
  await call(`/api/public/flows/${first.slug}/sessions/save`, saveInput)
  const resumeToken = await resumeBearer(env.SESSION_SECRET, saved.sessionId, saveInput.commandKey)
  expect((await env.DB.prepare('SELECT delivery_email FROM respondent_saves WHERE session_id=?').bind(saved.sessionId).first())?.delivery_email).toBeNull()
  const now = new Date().toISOString()
  await env.DB.prepare(`INSERT INTO response_payments(response_id,step_id,completion_step_id,provider,livemode,state,attempt,amount,currency,lines_json,checkout_session_id,payment_intent_id,return_token_hash,state_changed_at,created_at,updated_at) VALUES(?,?,?,'stripe',0,'paid',1,4000,'usd','[]','synthetic-pencil-checkout','synthetic-pencil-intent','synthetic-pencil-return',?,?,?)`)
    .bind(first.responseId, emailStep.id, first.steps.find(step => step.kind === 'completion').id, now, now, now).run()
  // A different respondent and another workspace stay outside the selection.
  const controlMailbox = ['synthetic-pencil-control', 'example.test'].join('@')
  const control = await accepted(await f.call(`/api/public/flows/${first.slug}/sessions`, { source: 'direct', deviceClass: 'desktop' }), 201)
  await matureLoad(control, 5000)
  const controlAnswers = first.answers.map(answer => ({ ...answer, value: answer.stepId === emailStep.id ? controlMailbox : answer.stepId === phoneStep.id ? { number: '+61499999999' } : 'synthetic-pencil-control-answer' }))
  const controlResponse = await accepted(await f.call(`/api/public/flows/${first.slug}/responses`, { ...control, answers: controlAnswers, idempotencyKey: 'synthetic-pencil-control', honeypot: '' }), 201)
  await call(base + '/google-sheet/sync', {})
  const sheet = async (book: string) => ((await (await fetch(receiver + '/__control/state')).json()) as any).sheets[book] as string[][]
  for (const flow of flows) expect((await sheet(flow.book)).flat()).toContain(mailbox)
  const member = f.as(f.owner.token)
  for (const action of ['lookup', 'export', 'erase']) {
    expect((await member('/api/app/privacy/' + action, { identifier: mailbox, ...(action === 'erase' ? { confirm: true } : {}) })).status).toBe(403)
    expect((await f.call('/api/app/privacy/' + action, { identifier: mailbox, ...(action === 'erase' ? { confirm: true } : {}) }, { auth: false })).status).toBe(401)
  }
  expect((await f.call('/api/app/privacy/erase', { identifier: mailbox, confirm: false })).status).toBe(400)
  expect((await f.call('/api/app/privacy/erase', { identifier: mailbox, confirm: true }, { origin: 'https://untrusted.invalid' })).status).toBe(403)
  expect((await f.call('/api/app/privacy/lookup', { identifier: 'Privacy request person' })).status).toBe(400)
  const lookup = await call('/api/app/privacy/lookup', { identifier: mailbox.toUpperCase() })
  expect(lookup.counts).toEqual({ responses: 3, partials: 1, contacts: 1, paymentReferences: 1 })
  expect(lookup.forms.map((form: any) => form.id).sort()).toEqual(flows.map(flow => flow.id).sort())
  expect((await call('/api/app/privacy/lookup', { identifier: '+61 (412) 345-678' })).counts).toEqual(lookup.counts)
  const exported = await f.call('/api/app/privacy/export', { identifier: mailbox })
  expect(exported.headers.get('Content-Disposition')).toContain('attachment;')
  expect(exported.headers.get('Cache-Control')).toBe('no-store')
  const bundle = await accepted(exported), text = JSON.stringify(bundle)
  expect(bundle.responses.map((row: any) => row.id).sort()).toEqual(flows.map(flow => flow.responseId).sort())
  for (let index = 0; index < 3; index++) expect(text).toContain(`synthetic-pencil-private-answer-${index}`)
  expect(bundle.contacts[0].fields.reference).toBe('synthetic-pencil-private-contact')
  expect(bundle.partials[0].answers).toEqual(saveInput.answers)
  expect(bundle.paymentReferences[0]).toMatchObject({ checkoutSessionId: 'synthetic-pencil-checkout', paymentIntentId: 'synthetic-pencil-intent', amount: 4000 })
  for (const forbidden of [resumeToken, saved.sessionToken, foreignId, 'synthetic-pencil-return', controlMailbox, 'synthetic-pencil-google-access', 'synthetic-pencil-google-refresh']) expect(text).not.toContain(forbidden)
  expect(bundle.integrations.filter((row: any) => row.name === 'Google Sheets' && row.supportsDeletion)).toHaveLength(3)
  expect(bundle.integrations).toContainEqual(expect.objectContaining({ name: 'Stripe', supportsDeletion: false }))
  const beforeEpoch = (await env.DB.prepare('SELECT epoch FROM restore_erasure_checkpoint WHERE singleton=1').first<{ epoch: number }>())?.epoch ?? 0
  const erased = await call('/api/app/privacy/erase', { identifier: phone, confirm: true })
  expect(erased).toMatchObject({ completed: true, counts: lookup.counts })
  for (const flow of flows) {
    await call(`/api/app/flows/${flow.id}/google-sheet/sync`, {})
    expect((await sheet(flow.book)).flat()).not.toContain(mailbox)
    expect((await call(`/api/app/flows/${flow.id}/results`)).completedResponses).toBe(flow.id === first.id ? 1 : 0)
    expect((await call(`/api/app/flows/${flow.id}/ledger`)).responses.map((row: any) => row.id)).not.toContain(flow.responseId)
    const replay = await f.call(`/api/public/flows/${flow.slug}/responses`, { ...flow.session, answers: flow.answers, idempotencyKey: 'synthetic-pencil-privacy-' + flows.indexOf(flow), honeypot: '' }, { auth: false })
    expect(replay.status).toBe(400)
  }
  const captures = ((await (await fetch(receiver + '/__control/state')).json()) as any).requests
  expect(captures.filter((row: any) => row.path.includes(':clear') && flows.some(flow => row.path.includes(flow.book)))).toHaveLength(3)
  expect((await sheet(first.book)).flat()).toContain('synthetic-pencil-control-answer')
  expect(await env.DB.prepare('SELECT id FROM responses WHERE id=?').bind(controlResponse.responseId).first()).toBeTruthy()
  expect(await env.DB.prepare('SELECT id FROM responses WHERE id=?').bind(foreignId).first()).toBeTruthy()
  expect(await env.DB.prepare('SELECT id FROM distribution_contacts WHERE id=?').bind(contact.id).first()).toBeNull()
  expect(await env.DB.prepare('SELECT response_id FROM response_payments WHERE response_id=?').bind(first.responseId).first()).toBeNull()
  expect((await call(`/api/public/flows/${first.slug}/resume`, { token: resumeToken })).state).toBe('unavailable')
  expect((await f.call(`/api/public/flows/${first.slug}/sessions/save`, saveInput, { auth: false })).status).toBe(400)
  expect((await call('/api/app/privacy/lookup', { identifier: mailbox })).counts).toEqual({ responses: 0, partials: 0, contacts: 0, paymentReferences: 0 })
  expect((await call('/api/app/privacy/erase', { identifier: mailbox, confirm: true })).counts.responses).toBe(0)
  expect((await env.DB.prepare('SELECT epoch FROM restore_erasure_checkpoint WHERE singleton=1').first<{ epoch: number }>())!.epoch).toBeGreaterThan(beforeEpoch)
  const audits = (await env.DB.prepare("SELECT subject_id,details_json FROM audit_entries WHERE workspace_id=? AND kind IN('privacy.erased','privacy.exported')").bind(f.workspaceId).all()).results
  expect(audits.length).toBeGreaterThanOrEqual(3)
  expect(JSON.stringify(audits)).not.toContain(mailbox)
  // Revoked credentials cannot use the new private doors or restart erased work.
  await env.DB.prepare('UPDATE oa_sessions SET revoked_at=? WHERE id=?').bind(Date.now(), f.owner.sessionId).run()
  for (const action of ['lookup', 'export', 'erase']) expect((await member('/api/app/privacy/' + action, { identifier: controlMailbox, ...(action === 'erase' ? { confirm: true } : {}) })).status).toBe(401)
  expect(await env.DB.prepare('SELECT id FROM responses WHERE id=?').bind(controlResponse.responseId).first()).toBeTruthy()
}
