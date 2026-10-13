import { expect, vi } from 'vitest'
import { contract } from '../../test/contract'
import { deploymentConfigurationErrors } from '../platform/config/runtime'
import worker, { createWorkerApp } from './worker'
import type { WorkerBindings } from './environment'
import type { PencilServices } from './services'
import type { PencilPlatform } from '../platform/runtime'

contract('OPER-003', 'refuses every missing required mail variable outside explicit loopback development', () => {
  const complete = { APP_ORIGIN: 'https://pencil.example', SEED_ADMIN_EMAIL: 'owner@example.test', SESSION_SECRET: 'synthetic-session-secret-at-least-32-characters', MAIL_PROVIDER: 'resend', MAIL_API_KEY: 'synthetic-config', MAIL_FROM: 'no-reply@example.test' }
  expect(deploymentConfigurationErrors('https://pencil.example/health', complete as WorkerBindings)).toEqual([])
  for (const name of ['MAIL_PROVIDER', 'MAIL_API_KEY', 'MAIL_FROM']) {
    expect(deploymentConfigurationErrors('https://pencil.example/health', { ...complete, [name]: '' } as WorkerBindings)).toContain(`${name} is required`)
  }
})

contract('BASE-SECRET-001', 'redacts arbitrary bootstrap and health exceptions in responses and logs', async () => {
  const sentinel = 'synthetic-private-database-message'
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
    const services = { responses: { enforcePublicRequestRateLimit: async () => {} }, workspace: { checkHealth: async () => { throw new Error(sentinel) } } } as unknown as PencilServices
    const health = await createWorkerApp(services, { configuration: {} } as PencilPlatform).request('https://pencil.test/health')
    expect(health.status).toBe(503)
    expect(await health.text()).not.toContain(sentinel)
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(sentinel)
    const bindings = { MAIL_PROVIDER: 'local', PENCIL_LOCAL_DEVELOPMENT: 'true', SEED_SAMPLE_DATA: 'true', DB: { prepare: () => { throw new Error(sentinel) } } } as unknown as WorkerBindings
    const initialization = await worker.fetch(new Request('http://localhost/health'), bindings, {} as ExecutionContext)
    expect(initialization.status).toBe(503)
    expect(await initialization.text()).not.toContain(sentinel)
  } finally { consoleError.mockRestore() }
})
