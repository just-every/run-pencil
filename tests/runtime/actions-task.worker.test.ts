import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { afterEach, beforeAll, expect, vi } from 'vitest'
import { contract } from '../../src/test/contract'
import { createWorkerApp } from '../../src/core/app/worker'
import { createPencilPlatform } from '../../src/core/platform/runtime'
import type { WorkerBindings } from '../../src/core/app/environment'
import { actionsHttp, everyStoredValue } from './actions-fixture'
declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(() => applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__))
afterEach(() => { vi.restoreAllMocks() })

const receiver = (env as unknown as { TASK_RECEIVER_ORIGIN: string }).TASK_RECEIVER_ORIGIN
type Captured = { path: string; authorization: string | null; idempotencyKey: string | null; contentType: string | null; body: string }
type Receiver = { tasks: Record<string, string>; requests: Captured[] }
const reset = async (mode: string, delayMilliseconds = 0) => { await fetch(`${receiver}/__control/reset`, { method: 'POST', body: JSON.stringify({ mode, delayMilliseconds }) }) }
const received = async () => await (await fetch(`${receiver}/__control/state`)).json() as Receiver
type Attempt = { ordinal: number; outcome: string | null; outcomeClass: string | null; httpStatus: number | null; remoteTaskId: string | null }
type Status = { available: boolean; message?: string; payload?: Record<string, any>; payloadSha256?: string; delivery: null | { state: string; idempotencyKey: string; remoteTaskId: string | null; stale: boolean; attempts: Attempt[] } }

async function configured(key = `TASK-KEY-CANARY-${crypto.randomUUID()}`) {
  const f = await actionsHttp({ TASK_PROVIDER: 'webhook', TASK_WEBHOOK_URL: `${receiver}/tasks`, TASK_API_KEY: key } as Partial<WorkerBindings>)
  const action = await f.create()
  const preview = async () => await (await f.call(`/api/app/actions/${action.id}/task`)).json() as Status
  const confirm = async (sha?: string) => { const response = await f.call(`/api/app/actions/${action.id}/task/confirm`, { payloadSha256: sha ?? (await preview()).payloadSha256 }); return { status: response.status, body: await response.json() as Status & { message?: string } } }
  const retry = async () => { const response = await f.call(`/api/app/actions/${action.id}/task/retry`, {}); return { status: response.status, body: await response.json() as Status } }
  return { f, key, action, preview, confirm, retry }
}

contract(['ACT-003', 'ACT-004', 'ACT-007'], 'a 500 fails visibly, keeps the local action and a retry on the same key creates one task', async () => {
  await reset('fail-once-500')
  const t = await configured()
  const failed = await t.confirm()
  expect(failed.body.delivery).toMatchObject({ state: 'failed', remoteTaskId: null })
  expect(failed.body.delivery!.attempts).toEqual([expect.objectContaining({ outcome: 'failed', outcomeClass: '5xx', httpStatus: 500 })])
  expect(await (await t.f.call(`/api/app/actions/${t.action.id}`)).json()).toMatchObject({ id: t.action.id, state: 'planned' })
  const retried = await t.retry()
  expect(retried.body.delivery).toMatchObject({ state: 'confirmed', remoteTaskId: 'task-1' })
  const state = await received()
  expect(Object.keys(state.tasks)).toHaveLength(1)
  expect(state.requests.map(request => request.idempotencyKey)).toEqual([`pencil-action-${t.action.id}`, `pencil-action-${t.action.id}`])
})

contract(['ACT-003', 'ACT-007'], 'a connection dropped after the receiver stored the task is unknown; retry on the same key returns the existing task', async () => {
  await reset('store-then-drop-once')
  const t = await configured()
  const unknown = await t.confirm()
  expect(unknown.body.delivery).toMatchObject({ state: 'unknown', remoteTaskId: null })
  expect(unknown.body.delivery!.attempts).toEqual([expect.objectContaining({ outcome: 'unknown', outcomeClass: 'network' })])
  expect(Object.keys((await received()).tasks)).toHaveLength(1)
  const retried = await t.retry()
  expect(retried.body.delivery).toMatchObject({ state: 'confirmed', remoteTaskId: 'task-1' })
  const state = await received()
  expect(state.tasks).toEqual({ [`pencil-action-${t.action.id}`]: 'task-1' })
  expect(new Set(state.requests.map(request => request.idempotencyKey))).toEqual(new Set([`pencil-action-${t.action.id}`]))
  expect(state.requests.map(request => request.body)).toEqual([state.requests[0].body, state.requests[0].body])
})

contract(['ACT-006'], 'only the confirmed action fields and report link leave: no answer or respondent-visible text, and a changed action must be confirmed again', async () => {
  await reset('ok')
  const t = await configured()
  await t.f.respond('Too long', 'ANSWER-CANARY-9f1 my name is Private Person')
  await t.f.services.flows.createDraftFlow({ workspaceId: t.f.workspaceId, slug: `visible-${t.action.id.toLowerCase()}`, title: 'VISIBLE-CANARY-7c2 respondent title' })
  const shown = await t.preview()
  expect(Object.keys(shown.payload!)).toEqual(['idempotencyKey', 'action'])
  expect(Object.keys(shown.payload!.action).sort()).toEqual(['metric', 'owner', 'rationale', 'reportLink', 'reviewDate', 'title'])
  expect(shown.payload!.action.reportLink).toBe(`http://localhost/app/actions/${t.action.id}`)
  // An edit after reading the task makes that confirmation stale.
  expect((await t.f.call(`/api/app/actions/${t.action.id}`, { rationale: 'Queues peak at lunch.', expectedVersion: t.action.version }, { method: 'PATCH' })).status).toBe(200)
  const stale = await t.confirm(shown.payloadSha256)
  expect(stale.status).toBe(409)
  expect(stale.body.message).toMatch(/changed after you read the task/)
  expect((await received()).requests).toEqual([])
  const fresh = await t.preview()
  expect((await t.confirm(fresh.payloadSha256)).body.delivery).toMatchObject({ state: 'confirmed' })
  const [request] = (await received()).requests
  expect(JSON.parse(request.body)).toEqual(fresh.payload)
  for (const canary of ['ANSWER-CANARY', 'Private Person', 'VISIBLE-CANARY', 'How was the wait', 'Too long']) expect(request.body).not.toContain(canary)
})

contract(['ACT-004'], 'with no adapter configured the external task is unavailable with setup guidance and no request is made, while the action works', async () => {
  await reset('ok')
  const f = await actionsHttp()
  const action = await f.create()
  const status = await (await f.call(`/api/app/actions/${action.id}/task`)).json() as Status
  expect(status).toEqual({ available: false, message: 'External tasks are not set up. Set TASK_PROVIDER=webhook, TASK_WEBHOOK_URL and TASK_API_KEY to create external tasks.', delivery: null })
  const refused = await f.call(`/api/app/actions/${action.id}/task/confirm`, { payloadSha256: 'a'.repeat(64) })
  expect(refused.status).toBe(409)
  expect((await f.call(`/api/app/actions/${action.id}/transitions`, { to: 'in_progress' })).status).toBe(200)
  expect((await received()).requests).toEqual([])
})

contract(['ACT-004', 'ACT-007'], 'redirects are not followed and a plain http URL is refused outside the dev and test runtimes', async () => {
  await reset('redirect')
  const t = await configured()
  const redirected = await t.confirm()
  expect(redirected.body.delivery).toMatchObject({ state: 'failed' })
  expect(redirected.body.delivery!.attempts).toEqual([expect.objectContaining({ outcome: 'failed', outcomeClass: '3xx', httpStatus: 307 })])
  expect((await received()).requests.map(request => request.path)).toEqual(['/tasks'])
  await reset('ok')
  const production = { ...env, APP_ORIGIN: 'https://pencil.example.test', SEED_ADMIN_EMAIL: 'owner@example.test', MAIL_PROVIDER: 'resend', MAIL_API_KEY: 'synthetic-mail-key', MAIL_FROM: 'no-reply@example.test', PENCIL_LOCAL_DEVELOPMENT: 'false', SEED_SAMPLE_DATA: 'false', SETUP_TOKEN: 's'.repeat(32), TASK_PROVIDER: 'webhook', TASK_WEBHOOK_URL: `${receiver}/tasks`, TASK_API_KEY: t.key } as WorkerBindings
  const app = createWorkerApp(undefined, createPencilPlatform('https://pencil.example.test', production))
  const call = (path: string, body?: unknown) => app.request(`https://pencil.example.test${path}`, { method: body ? 'POST' : 'GET', headers: { Origin: 'https://pencil.example.test', Cookie: `__Host-operator_session=${t.f.lead.token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) })
  const status = await (await call(`/api/app/actions/${t.action.id}/task`)).json() as Status
  expect(status).toMatchObject({ available: false, message: 'TASK_WEBHOOK_URL must use https. Plain http is accepted only for a loopback receiver in local development and tests.' })
  expect((await call(`/api/app/actions/${t.action.id}/task/retry`, {})).status).toBe(409)
  expect((await received()).requests).toEqual([])
})
