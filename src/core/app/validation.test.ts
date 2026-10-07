import { expect, it, vi } from 'vitest'
import type { PencilPlatform } from '../platform/runtime'
import type { PencilServices } from './services'
import { createWorkerApp } from './worker'

const domainCalls: ReturnType<typeof vi.fn>[] = []
function services() {
  domainCalls.length = 0
  const feature = () => new Proxy({}, { get(_target, key) {
    if (key === 'then') return undefined
    const call = vi.fn().mockResolvedValue(undefined); domainCalls.push(call); return call
  } })
  return {
    flows: feature(), reporting: feature(), workspace: feature(),
    auth: new Proxy(feature(), { get(target, key) { return key === 'native' ? { previewLink: vi.fn().mockResolvedValue(null) } : key === 'getSession' ? vi.fn().mockResolvedValue({ workspaceId: 'workspace', operatorId: 'operator' }) : Reflect.get(target, key) } }),
    responses: new Proxy(feature(), { get(target, key) { return key === 'enforcePublicRequestRateLimit' ? vi.fn().mockResolvedValue(undefined) : Reflect.get(target, key) } }),
  } as unknown as PencilServices
}
const platform = { configuration: { appOrigin: 'https://pencil.test', isLocalDevelopment: true } } as PencilPlatform

const failures = [
  ['POST', '/auth/magic-link', { email: 'private-invalid-address' }],
  ['PUT', '/api/app/workspace', { timeZone: 'private-secret' }],
  ['POST', '/api/app/operators', { email: 'private-secret', displayName: '' }],
  ['DELETE', '/api/app/operators/not-an-operator-id', undefined],
  ['DELETE', '/api/app/operators/01J00000000000000000000002', { ignored: 'private-secret' }],
  ['POST', '/api/app/flows', { title: '', slug: 'private-secret' }],
  ['POST', '/api/app/flows/legacy-flow/duplicate', { title: '', slug: 'private-secret' }],
  ['PUT', '/api/app/flows/legacy-flow/draft', { stepId: 'step', prompt: 'private-secret' }],
  ['POST', '/api/app/flows/legacy-flow/draft/steps', { expectedVersion: 0, step: { kind: 'invalid', prompt: 'private-secret' } }],
  ['POST', '/api/app/flows/legacy-flow/draft/steps/step/duplicate', { expectedVersion: -1 }],
  ['DELETE', '/api/app/flows/legacy-flow/draft/steps/step', { expectedVersion: -1 }],
  ['PUT', '/api/app/flows/legacy-flow/draft/order', { expectedVersion: 0, orderedStepIds: 'private-secret' }],
  ['PUT', '/api/app/flows/legacy-flow/draft/branches', { expectedVersion: 0, rules: 'private-secret' }],
  ['POST', '/api/app/flows/legacy-flow/draft/preview', { answers: 'private-secret' }],
  ['POST', '/api/app/flows/legacy-flow/publish', { expectedVersion: 0, deadlineAt: 'private-secret' }],
  ['POST', '/api/app/flows/legacy-flow/close', { ignored: 'private-secret' }],
  ['POST', '/api/app/flows/legacy-flow/reopen', { ignored: 'private-secret' }],
  ['POST', '/api/app/flows/legacy-flow/archive', { ignored: 'private-secret' }],
  ['POST', '/api/app/responses/legacy-response/release', { ignored: 'private-secret' }],
  ['DELETE', '/api/app/responses/legacy-response/quarantine', { ignored: 'private-secret' }],
  ['DELETE', '/api/app/responses/legacy-response', { ignored: 'private-secret' }],
  ['POST', '/auth/signout', { ignored: 'private-secret' }],
  ['POST', '/api/public/flows/valid-slug/sessions', { deviceClass: 'private-secret' }],
  ['POST', '/api/public/flows/valid-slug/sessions/advance', { sessionId: 'session', sessionToken: 'private-secret', stepId: 'step' }],
  ['POST', '/api/public/flows/valid-slug/responses', { sessionId: 'session', sessionToken: 'x'.repeat(64), answers: [], idempotencyKey: 'short' }],
  ['POST', '/api/public/flows/valid-slug/responses', { sessionId: 'session', sessionToken: 'x'.repeat(64), answers: [{ stepId: 'step', value: { unexpected: 'private-secret' } }], idempotencyKey: 'synthetic-boundary-key' }],
  ['POST', '/api/public/flows/valid-slug/responses', { sessionId: 'session', sessionToken: 'x'.repeat(64), answers: [{ stepId: 'step', value: 'x'.repeat(5001) }], idempotencyKey: 'synthetic-boundary-key' }],
  ['GET', '/api/app/dashboard?status=private-secret', undefined],
  ['GET', '/api/app/dashboard?status=open&status=closed', undefined],
  ['GET', '/api/app/flows/legacy-flow/results?revisionId=', undefined],
  ['GET', '/api/app/flows/legacy-flow/ledger?offset=Infinity&answerValue=private-secret', undefined],
  ['GET', '/api/app/flows/legacy-flow/questions?revisionId=', undefined],
  ['GET', '/api/app/flows/legacy-flow/responses/export?from=private-secret', undefined],
  ['GET', '/auth/local-inbox?email=private-secret', undefined],
  ['GET', `/api/app/flows/${'x'.repeat(201)}/draft`, undefined],
  ['GET', '/api/app/flows/%00/draft', undefined],
  ['GET', '/api/public/flows/not%20a%20slug', undefined],
  ['GET', `/api/app/revisions/${'x'.repeat(201)}/quarantine`, undefined],
] as const

it.each(failures)('refuses invalid %s %s before any product operation without echoing submitted values', async (method, path, data) => {
  const app = createWorkerApp(services(), platform)
  const response = await app.request(`https://pencil.test${path}`, { method, headers: { Origin: 'https://pencil.test', 'Content-Type': 'application/json' }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) })
  expect(response.status).toBe(400)
  const body = await response.json() as Record<string, unknown>
  expect(body).toMatchObject({ error: 'VALIDATION_ERROR', message: expect.any(String) })
  expect(JSON.stringify(body)).not.toContain('private-secret')
  expect(Object.keys(body).sort()).toEqual(['error', 'message'])
  expect(domainCalls.every(call => call.mock.calls.length === 0)).toBe(true)
})

it.each(['{ "private-secret":', 'null', '[]'])('rejects malformed or wrong-shape JSON without a product effect: %s', async body => {
  const app = createWorkerApp(services(), platform)
  const response = await app.request('https://pencil.test/api/app/flows', { method: 'POST', headers: { Origin: 'https://pencil.test', 'Content-Type': 'application/json' }, body })
  expect(response.status).toBe(400)
  expect(await response.json()).toMatchObject({ error: 'VALIDATION_ERROR' })
  expect(domainCalls.every(call => call.mock.calls.length === 0)).toBe(true)
})

it('retains empty action requests, opaque legacy IDs and native invalid-link read-only rejection', async () => {
  const app = createWorkerApp(services(), platform)
  for (const body of [undefined, '{}']) {
    expect((await app.request('https://pencil.test/api/app/flows/legacy-flow/close', { method: 'POST', headers: { Origin: 'https://pencil.test', 'Content-Type': 'application/json' }, ...(body ? { body } : {}) })).status).toBe(204)
  }
  expect(domainCalls.filter(call => call.mock.calls.length === 1)).toHaveLength(2)
  domainCalls.length = 0
  const response = await app.request('https://pencil.test/auth/confirm?token=invalid-token')
  expect(response.status).toBe(400)
  expect(response.headers.get('Set-Cookie')).toBeNull()
  expect(await response.text()).toContain('invalid or expired')
  expect(domainCalls).toHaveLength(0)
})
