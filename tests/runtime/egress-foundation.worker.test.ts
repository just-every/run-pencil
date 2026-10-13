import { fixtureExport } from '../helpers/report-download'
import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect, vi } from 'vitest'
import { contract } from '../../src/test/contract'
import { foundationFixture } from './foundation-fixture'
import worker from '../../src/core/app/worker'
import { maintainPencil } from '../../src/core/app/maintenance'
import type { WorkerBindings } from '../../src/core/app/environment'
declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(() => applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__))
contract(['BASE-DATA-004', 'BASE-DATA-005', 'BASE-SECRET-001'], 'Worker collection and maintenance require no author or marketplace; only declared magic-link data reaches the configured mail endpoint', async () => {
  const f = await foundationFixture('egress-observation')
  await f.add({ kind: 'question', questionType: 'long_text', prompt: 'Private answers' })
  await f.add({ kind: 'completion', questionType: null, prompt: 'Done' })
  await f.publish()
  const secret = 'synthetic-runtime-mail-secret'
  const bindings = { ...env, APP_ORIGIN: 'https://pencil.example.test', PENCIL_BUILD_ID: 'synthetic-build', SEED_ADMIN_EMAIL: 'owner@aurora-coffee.test', SESSION_SECRET: 'synthetic-test-session-secret-at-least-32-characters', MAIL_PROVIDER: 'resend', MAIL_API_KEY: secret, MAIL_FROM: 'no-reply@example.test', PENCIL_LOCAL_DEVELOPMENT: 'false', SEED_SAMPLE_DATA: 'false' } as WorkerBindings
  const outbound = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Unexpected egress: synthetic network is blocked'))
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
  const run = (path: string, body?: unknown) => worker.fetch(new Request(`https://pencil.example.test${path}`, { method: body ? 'POST' : 'GET', headers: { Origin: 'https://pencil.example.test', 'CF-Connecting-IP': '192.0.2.1', 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) }), bindings, {} as ExecutionContext)
  try {
    expect((await run('/health')).status).toBe(200)
    expect((await run(`/api/public/flows/${f.slug}`)).status).toBe(200)
    const session = await f.start(); await f.mature(session.sessionId)
    await f.final(session, [{ stepId: session.flow.steps[0].id, value: 'Private answer must never leave through mail' }])
    expect((await fixtureExport(env.DB, f.scope.workspaceId, f.flow.flowId, {})).responses).toHaveLength(1)
    await maintainPencil(bindings, Date.now())
    expect(outbound).not.toHaveBeenCalled()
    // Test transport only: no real provider, inbox or external request.
    outbound.mockResolvedValueOnce(Response.json({ id: 'synthetic-mail-receipt' }))
    expect((await run('/auth/magic-link', { email: 'owner@aurora-coffee.test' })).status).toBe(202)
    expect(outbound).toHaveBeenCalledTimes(1)
    const [url, options] = outbound.mock.calls[0]
    expect(url).toBe('https://api.resend.com/emails')
    const payload = JSON.parse(String(options!.body))
    expect(Object.keys(payload).sort()).toEqual(['from','headers','html','subject','text','to'])
    expect(payload.to).toEqual(['owner@aurora-coffee.test'])
    expect(payload.text).toContain('https://pencil.example.test/auth/confirm?token=')
    expect(payload.html).toContain('https://pencil.example.test/auth/confirm?token=')
    expect(JSON.stringify(payload)).not.toContain(secret)
    expect(JSON.stringify(payload)).not.toContain('Private answer must never leave')
    outbound.mockRejectedValueOnce(new Error(secret))
    const failed = await run('/auth/magic-link', { email: 'owner@aurora-coffee.test' })
    expect(await failed.text()).not.toContain(secret)
    expect(JSON.stringify(errors.mock.calls)).not.toContain(secret)
    expect(outbound.mock.calls.map(([url]) => url)).toEqual(['https://api.resend.com/emails','https://api.resend.com/emails'])
  } finally { outbound.mockRestore(); errors.mockRestore() }
}, 60_000)
