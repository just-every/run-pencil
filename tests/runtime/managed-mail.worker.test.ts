import { applyD1Migrations, createScheduledController, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect, vi } from 'vitest'
import { contract } from '../../src/test/contract'
import worker from '../../src/core/app/worker'
import type { BuilderDraft } from '../../src/core/app/api'

declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(() => applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__))

contract(['OPER-003', 'NOTIFY-002', 'NOTIFY-004', 'BASE-SECRET-001'], 'Managed mail sends sign-in through Base, queues rate limits and shows rejected mail to its owner', async () => {
  const origin = 'https://forms.example.test', relay = 'https://run.example.test/api/managed-mail/send'
  const bindings = { ...env, APP_ORIGIN: origin, SEED_ADMIN_EMAIL: 'owner@example.test',
    SESSION_SECRET: 'synthetic-managed-session-secret-at-least-32-characters',
    SETUP_TOKEN: 'synthetic-managed-setup-token-at-least-32-characters',
    MAIL_PROVIDER: 'rer', MAIL_FROM: 'noreply@example.test', MAIL_RELAY_URL: relay,
    MAIL_API_KEY: 'synthetic-relay-credential', PENCIL_LOCAL_DEVELOPMENT: 'false', SEED_SAMPLE_DATA: 'false' }
  let cookie = '', serial = 0
  const request = (path: string, body?: unknown) => worker.fetch(new Request(origin + path, {
    method: body === undefined ? 'GET' : 'POST', headers: { Origin: origin, Cookie: cookie,
      'Content-Type': 'application/json', 'CF-Connecting-IP': `192.0.2.${++serial}` },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }), bindings, {} as ExecutionContext)
  async function json<T>(path: string, body?: unknown): Promise<T> {
    const response = await request(path, body)
    expect(response.status, path).toBeLessThan(300)
    return response.json() as Promise<T>
  }
  const send = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"accepted":true}', { status: 202 }))
  try {
    const bootstrap = await request('/auth/bootstrap', { token: bindings.SETUP_TOKEN, displayName: 'Studio owner' })
    expect(bootstrap.status).toBe(303)
    cookie = bootstrap.headers.get('set-cookie')!.split(';')[0]
    expect((await request('/auth/magic-link', { email: bindings.SEED_ADMIN_EMAIL })).status).toBe(202)
    expect(send).toHaveBeenCalledTimes(1)
    const [url, init] = send.mock.calls[0]
    expect(url).toBe(relay)
    expect(init).toMatchObject({ method: 'POST', redirect: 'error', headers: {
      Authorization: `Bearer ${bindings.MAIL_API_KEY}`, 'Content-Type': 'application/json',
    } })
    const message = JSON.parse(String(init!.body))
    expect(Object.keys(message).sort()).toEqual(['html', 'subject', 'text', 'to'])
    expect(message).toMatchObject({ to: bindings.SEED_ADMIN_EMAIL, subject: expect.any(String),
      text: expect.stringContaining('/auth/confirm?token='), html: expect.any(String) })
    expect(String(init!.body)).not.toContain(bindings.MAIL_API_KEY)

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
      await env.DB.prepare('UPDATE respondent_sessions SET created_at=? WHERE id=?').bind(new Date(Date.now() - 5000).toISOString(), session.sessionId).run()
      await json('/api/public/flows/managed-feedback/responses', { sessionId: session.sessionId,
        sessionToken: session.sessionToken, idempotencyKey: crypto.randomUUID(),
        answers: [{ stepId: current.steps[0].id, value: 'PRIVATE-ANSWER-NEVER-MAILED' }] })
    }
    const state = () => json<{ deliveries: Array<{ id: string; status: string; attempts: number; availableAt: string; reason: string | null }> }>(`${path}/notifications`)
    const tick = (time: number) => worker.scheduled(createScheduledController({ scheduledTime: time }), bindings)
    await submit()
    send.mockClear().mockResolvedValue(new Response('{"error":"rate limited"}', { status: 429, headers: { 'Retry-After': '60' } }))
    const start = Date.now()
    await tick(start)
    expect(send).toHaveBeenCalledTimes(1)
    const pending = (await state()).deliveries[0]
    expect(pending).toMatchObject({ status: 'pending', attempts: 1, reason: expect.stringContaining('retry scheduled') })
    const due = await env.DB.prepare('SELECT available_at FROM notification_deliveries WHERE id=?').bind(pending.id).first<{ available_at: string }>()
    expect(Date.parse(due!.available_at)).toBeGreaterThan(start)
    await tick(Date.parse(due!.available_at) - 1)
    expect(send).toHaveBeenCalledTimes(1)
    send.mockResolvedValue(new Response('{"accepted":true}', { status: 202 }))
    await tick(Date.parse(due!.available_at))
    expect(send).toHaveBeenCalledTimes(2)
    expect((await state()).deliveries[0]).toMatchObject({ status: 'sent', attempts: 2 })
    for (const [target, options] of send.mock.calls) {
      expect(target).toBe(relay)
      const payload = JSON.parse(String(options!.body))
      expect(Object.keys(payload).sort()).toEqual(['html', 'subject', 'text', 'to'])
      expect(payload.to).toBe(bindings.SEED_ADMIN_EMAIL)
      expect(String(options!.body)).not.toContain('PRIVATE-ANSWER-NEVER-MAILED')
    }
    await submit()
    send.mockResolvedValue(new Response('{"error":"private provider detail"}', { status: 401 }))
    await tick(Date.now())
    const visible = await state()
    expect(visible.deliveries).toContainEqual(expect.objectContaining({ status: 'failed', attempts: 1,
      reason: expect.stringContaining('Mail provider rejected this operator notification.') }))
    expect(JSON.stringify(visible)).toContain('rer: provider_rejected')
    expect(JSON.stringify(visible)).not.toMatch(/private provider detail|synthetic-relay-credential/)
    expect((await request('/health')).status).toBe(200)
  } finally { send.mockRestore() }
})
