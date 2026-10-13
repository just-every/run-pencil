import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import worker from '../../src/core/app/worker'
import type { WorkerBindings } from '../../src/core/app/environment'
declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(() => applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__))

contract(['WS-003', 'OPER-003'], 'native startup still names every missing required variable while absent deferred adapters do not block health', async () => {
  const configured: WorkerBindings = { ...env, APP_ORIGIN: 'https://pencil.example.test',
    PENCIL_BUILD_ID: 'synthetic-configuration-build', SEED_ADMIN_EMAIL: 'owner@example.test',
    SESSION_SECRET: 'synthetic-runtime-session-secret-at-least-32-characters',
    SETUP_TOKEN: 'synthetic-runtime-setup-token-at-least-32-characters',
    MAIL_PROVIDER: 'resend', MAIL_API_KEY: 'synthetic-mail-key', MAIL_FROM: 'no-reply@example.test',
    PENCIL_LOCAL_DEVELOPMENT: 'false', SEED_SAMPLE_DATA: 'false' }
  const run = (bindings: WorkerBindings) => worker.fetch(new Request('https://pencil.example.test/health',
    { headers: { 'CF-Connecting-IP': '198.18.172.51' } }), bindings, {} as ExecutionContext)
  const before = await env.DB.prepare('SELECT * FROM workspaces').all().then(result => result.results)
  for (const variable of ['APP_ORIGIN', 'PENCIL_BUILD_ID', 'SEED_ADMIN_EMAIL', 'MAIL_PROVIDER', 'MAIL_API_KEY', 'MAIL_FROM', 'SESSION_SECRET'] as const) {
    const response = await run({ ...configured, [variable]: undefined })
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ status: 'not-ready', message: `Invalid deployment configuration: ${variable} is required.` })
    expect(await env.DB.prepare('SELECT * FROM workspaces').all().then(result => result.results)).toEqual(before)
  }
  expect((await run(configured)).status).toBe(200)
})
