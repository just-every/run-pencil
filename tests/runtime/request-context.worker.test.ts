import { devKeyHeaders } from '../helpers/dev-key.mjs'
import { applyD1Migrations, createExecutionContext, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect, it } from 'vitest'
import worker from '../../src/core/app/worker'
import type { WorkerBindings } from '../../src/core/app/environment'

declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(() => applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__))

const configured = (name: string): WorkerBindings => ({ ...env,
  PENCIL_LOCAL_DEVELOPMENT: 'false', SEED_SAMPLE_DATA: 'false',
  APP_ORIGIN: `https://${name}.example.test`, PENCIL_BUILD_ID: `build-${name}`,
  SEED_ADMIN_EMAIL: `${name}@example.test`, SESSION_SECRET: `synthetic-${name}-session-secret-at-least-32-characters`,
  SETUP_TOKEN: `synthetic-${name}-setup-token-at-least-32-characters`,
  MAIL_PROVIDER: 'resend', MAIL_API_KEY: `synthetic-${name}-mail-key`, MAIL_FROM: `${name}@example.test`,
})
const request = (bindings: WorkerBindings, path = '/health') => worker.fetch(new Request(`${bindings.APP_ORIGIN}${path}`), bindings, createExecutionContext())

it('keeps concurrent and later requests tied to their own configuration and initialization', async () => {
  const first = configured('first')
  const second = configured('second')
  const result = await Promise.all([request(first), request(second), request(first), request(second)])
  for (const [index, response] of result.entries()) {
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ status: 'ok', buildId: index % 2 ? 'build-second' : 'build-first' })
  }
  const invalid = await request({ ...first, MAIL_API_KEY: '' })
  expect(invalid.status).toBe(503)
  expect(await invalid.json()).toMatchObject({ message: expect.stringContaining('MAIL_API_KEY') })
  expect((await request(first, '/__dev/outbox')).status).toBe(404)
  // Warm routes must still recheck current setup state, rather than treating a
  // prior configured request as proof that an operator now exists.
  const uninitialized = await request({ ...first, SETUP_TOKEN: undefined })
  expect(uninitialized.status).toBe(503)
  expect(await uninitialized.json()).toMatchObject({ message: expect.stringContaining('SETUP_TOKEN') })
  expect((await worker.fetch(new Request('http://localhost/__dev/outbox', { headers: { host: 'localhost', ...devKeyHeaders } }), env, createExecutionContext())).status).toBe(200)
  expect((await request({ ...first, SETUP_TOKEN: undefined })).status).toBe(200)
})

it('returns 404 from an empty database without creating a respondent session', async () => {
  const bindings = { ...env, SEED_SAMPLE_DATA: 'false', APP_ORIGIN: 'http://localhost' }
  expect((await request(bindings, '/api/public/flows/no-published-flow')).status).toBe(404)
  expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM respondent_sessions').first()).toEqual({ count: 0 })
})
