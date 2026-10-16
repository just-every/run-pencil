import { expect } from 'vitest'
import { contract } from '../src/test/contract'
import type { BuilderDraft } from '../src/core/app/api'
import { emittedWorker } from './helpers/emitted-worker.mjs'

contract(['OPER-003', 'NOTIFY-002', 'NOTIFY-003', 'NOTIFY-004', 'BASE-SECRET-001'], 'Managed mail uses its assigned sender for sign-in, response notifications and digests, queues rate limits and shows rejected mail to its owner', async () => {
  const origin = 'https://forms.example.test', relay = 'https://run.example.test/api/managed-mail/send'
  const bindings = { APP_ORIGIN: origin, SEED_ADMIN_EMAIL: 'owner@example.test',
    SESSION_SECRET: 'synthetic-managed-session-secret-at-least-32-characters',
    SETUP_TOKEN: 'synthetic-managed-setup-token-at-least-32-characters',
    MAIL_PROVIDER: 'rer', MAIL_FROM: 'Studio <apps@relay.example.test>', MAIL_RELAY_URL: relay,
    MAIL_API_KEY: 'synthetic-relay-credential', PENCIL_LOCAL_DEVELOPMENT: 'false', SEED_SAMPLE_DATA: 'false' }
  let relayStatus = 202
  const sends: Array<{ url: string; method: string; headers: Headers; body: string }> = []
  const runtime = await emittedWorker(bindings, async (request: Request) => {
    sends.push({ url: request.url, method: request.method,
      headers: request.headers, body: await request.text() })
    return new Response('{"error":"private provider detail"}', { status: relayStatus,
      headers: relayStatus === 302 ? { Location: 'https://elsewhere.example.test/capture' }
        : relayStatus === 429 ? { 'Retry-After': '60' } : {} })
  })
  const db = await runtime.getD1Database('DB')
  const worker = await runtime.getWorker()
  let cookie = '', serial = 0
  const request = (path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST') => runtime.dispatchFetch(origin + path, {
    redirect: 'manual', method, headers: { Host: new URL(origin).host, Origin: origin, Cookie: cookie,
      'Content-Type': 'application/json', 'CF-Connecting-IP': `192.0.2.${++serial}` },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  async function json<T>(path: string, body?: unknown): Promise<T> {
    const response = await request(path, body)
    expect(response.status, path).toBeLessThan(300)
    return response.json() as Promise<T>
  }
  try {
    const bootstrap = await request('/auth/bootstrap', { token: bindings.SETUP_TOKEN, displayName: 'Studio owner' })
    expect(bootstrap.status, bootstrap.status === 303 ? '' : await bootstrap.text()).toBe(303)
    cookie = bootstrap.headers.get('set-cookie')!.split(';')[0]
    expect((await request('/auth/magic-link', { email: bindings.SEED_ADMIN_EMAIL })).status).toBe(202)
    expect(sends).toHaveLength(1)
    const [sent] = sends
    expect(sent).toMatchObject({ url: relay, method: 'POST' })
    expect(await json('/__test/fetch-options')).toEqual(['manual'])
    // Workerd adds routing and length headers at the network edge.
    expect(Object.fromEntries([...sent.headers].filter(([name]) => !['host', 'cf-worker', 'content-length'].includes(name)))).toEqual({
      authorization: `Bearer ${bindings.MAIL_API_KEY}`, 'content-type': 'application/json',
    })
    const message = JSON.parse(sent.body)
    expect(Object.keys(message).sort()).toEqual(['html', 'subject', 'text', 'to'])
    expect(message).toMatchObject({ to: bindings.SEED_ADMIN_EMAIL, subject: expect.any(String),
      text: expect.stringContaining('/auth/confirm?token='), html: expect.any(String) })
    expect(sent.body).not.toContain(bindings.MAIL_API_KEY)

    const flow = await json<{ id: string }>('/api/app/flows', { title: 'Studio feedback', slug: 'managed-feedback' })
    const path = `/api/app/flows/${flow.id}`, draft = () => json<BuilderDraft>(`${path}/draft`)
    for (const step of [{ kind: 'question', questionType: 'short_text', prompt: 'How can we help?', required: true },
      { kind: 'completion', questionType: null, prompt: 'Thank you' }]) {
      await json(`${path}/draft/steps`, { expectedVersion: (await draft()).flow.draftVersion, step })
    }
    const current = await draft()
    await json(`${path}/publish`, { expectedVersion: current.flow.draftVersion })
    async function submit() {
      const session = await json<{ sessionId: string; sessionToken: string }>('/api/public/flows/managed-feedback/sessions', { deviceClass: 'desktop', source: 'direct' })
      await db.prepare('UPDATE respondent_sessions SET created_at=? WHERE id=?').bind(new Date(Date.now() - 5000).toISOString(), session.sessionId).run()
      await json('/api/public/flows/managed-feedback/responses', { sessionId: session.sessionId,
        sessionToken: session.sessionToken, idempotencyKey: crypto.randomUUID(),
        answers: [{ stepId: current.steps[0].id, value: 'PRIVATE-ANSWER-NEVER-MAILED' }] })
    }
    const state = () => json<{ mode: string; senderError: string | null; daily?: { nextOpening: string }; deliveries: Array<{ id: string; status: string; attempts: number; availableAt: string; reason: string | null; day?: string }> }>(`${path}/notifications`)
    expect(await state()).toMatchObject({ mode: 'immediately', senderError: null })
    const tick = (time: number) => worker.scheduled({ scheduledTime: time })
    await submit()
    sends.length = 0
    relayStatus = 429
    const start = Date.now()
    await tick(start)
    expect(sends).toHaveLength(1)
    const pending = (await state()).deliveries[0]
    expect(pending).toMatchObject({ status: 'pending', attempts: 1, reason: expect.stringContaining('retry scheduled') })
    const due = await db.prepare('SELECT available_at FROM notification_deliveries WHERE id=?').bind(pending.id).first<{ available_at: string }>()
    expect(Date.parse(due!.available_at)).toBeGreaterThan(start)
    await tick(Date.parse(due!.available_at) - 1)
    expect(sends).toHaveLength(1)
    relayStatus = 202
    await tick(Date.parse(due!.available_at))
    expect(sends).toHaveLength(2)
    expect((await state()).deliveries[0]).toMatchObject({ status: 'sent', attempts: 2 })
    for (const sent of sends) {
      expect(sent.url).toBe(relay)
      const payload = JSON.parse(sent.body)
      expect(Object.keys(payload).sort()).toEqual(['html', 'subject', 'text', 'to'])
      expect(payload.to).toBe(bindings.SEED_ADMIN_EMAIL)
      expect(sent.body).not.toContain('PRIVATE-ANSWER-NEVER-MAILED')
    }
    await submit()
    relayStatus = 401
    await tick(Date.now())
    const visible = await state()
    expect(visible.deliveries).toContainEqual(expect.objectContaining({ status: 'failed', attempts: 1,
      reason: expect.stringContaining('Mail provider rejected this operator notification.') }))
    expect(JSON.stringify(visible)).toContain('rer: provider_rejected')
    expect(JSON.stringify(visible)).not.toMatch(/private provider detail|synthetic-relay-credential/)
    expect((await request('/health')).status).toBe(200)
    await submit()
    relayStatus = 302
    const beforeRedirect = sends.length
    await tick(Date.now())
    expect(sends).toHaveLength(beforeRedirect + 1)
    expect(sends.every(sent => sent.url === relay)).toBe(true)
    const redirects = await json<string[]>('/__test/fetch-options')
    expect(redirects).toHaveLength(beforeRedirect + 2) // Includes the original sign-in request.
    expect(redirects.every(value => value === 'manual')).toBe(true)
    expect((await state()).deliveries).toContainEqual(expect.objectContaining({ status: 'failed', attempts: 1,
      reason: expect.stringContaining('rer: provider_redirected') }))

    expect((await request(`${path}/notifications`, { mode: 'daily' }, 'PUT')).status).toBe(200)
    const daily = await state()
    expect(daily).toMatchObject({ mode: 'daily', senderError: null })
    await submit()
    relayStatus = 202
    const beforeDigest = sends.length
    await tick(Date.parse(daily.daily!.nextOpening))
    expect(sends).toHaveLength(beforeDigest + 1)
    const digest = JSON.parse(sends.at(-1)!.body)
    expect(digest).toMatchObject({ to: bindings.SEED_ADMIN_EMAIL, subject: expect.stringContaining('daily digest (1)') })
    expect(Object.keys(digest).sort()).toEqual(['html', 'subject', 'text', 'to'])
    expect(sends.at(-1)!.body).not.toContain('PRIVATE-ANSWER-NEVER-MAILED')
    expect((await state()).deliveries).toContainEqual(expect.objectContaining({ status: 'sent', attempts: 1, day: expect.any(String) }))
    console.log(`Emitted Worker mail: MAIL_PROVIDER=rer; configured sender=${bindings.MAIL_FROM}; senderError=null; immediate sent after 429 due retry; daily digest sent; relay owns From (no from override); sign-in POST + exact relay payload; redirect=manual; 302 rejected/provider_redirected (0 followed); 401 owner-visible rejection; private details excluded.`)
  } finally { await runtime.dispose() }
}, 30_000)
