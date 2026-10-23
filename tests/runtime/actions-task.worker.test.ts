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

contract(['ACT-003', 'ACT-004', 'ACT-007'], 'a 500 fails visibly and a dropped connection is unknown; both keep the local action and a retry on the same key creates one task', async () => {
  for (const mode of ['fail-once-500', 'store-then-drop-once'] as const) {
    await reset(mode)
    const t = await configured()
    const first = await t.confirm()
    if (mode === 'fail-once-500') {
      expect(first.body.delivery).toMatchObject({ state: 'failed', remoteTaskId: null })
      expect(first.body.delivery!.attempts).toEqual([expect.objectContaining({ outcome: 'failed', outcomeClass: '5xx', httpStatus: 500 })])
      expect(await (await t.f.call(`/api/app/actions/${t.action.id}`)).json()).toMatchObject({ id: t.action.id, state: 'planned' })
      // INTEG-015: the failed task is in the delivery ledger with its key and attempt reason, and raises an alert.
      const failedLedger = await (await t.f.call('/api/app/integration-deliveries?state=failed')).json() as { deliveries: unknown[] }
      expect(failedLedger.deliveries).toEqual([expect.objectContaining({ kind: 'task', state: 'failed', idempotencyKey: `pencil-action-${t.action.id}`, actionId: t.action.id, attempts: [expect.objectContaining({ outcome: 'failed', httpStatus: 500, reason: '5xx' })] })])
      expect(JSON.stringify(await (await t.f.call('/api/app/webhooks/alerts')).json())).toContain('external task')
    } else {
      // The receiver stored the task before the connection dropped.
      expect(first.body.delivery).toMatchObject({ state: 'unknown', remoteTaskId: null })
      expect(first.body.delivery!.attempts).toEqual([expect.objectContaining({ outcome: 'unknown', outcomeClass: 'network' })])
      expect(Object.keys((await received()).tasks)).toHaveLength(1)
    }
    const retried = await t.retry()
    expect(retried.body.delivery).toMatchObject({ state: 'confirmed', remoteTaskId: 'task-1' })
    const settled = await (await t.f.call('/api/app/integration-deliveries')).json() as { deliveries: Array<{ actionId: string | null; state: string; attempts: Array<{ outcome: string | null }> }> }
    expect(settled.deliveries.find(item => item.actionId === t.action.id)).toMatchObject({ state: 'confirmed' })
    expect(settled.deliveries.find(item => item.actionId === t.action.id)!.attempts.map(attempt => attempt.outcome).at(-1)).toBe('confirmed')
    expect(await (await t.f.call('/api/app/webhooks/alerts')).json()).toEqual({ alerts: [] })
    const state = await received()
    expect(Object.keys(state.tasks)).toHaveLength(1)
    expect(state.tasks).toEqual({ [`pencil-action-${t.action.id}`]: 'task-1' })
    expect(state.requests.map(request => request.idempotencyKey)).toEqual([`pencil-action-${t.action.id}`, `pencil-action-${t.action.id}`])
    if (mode === 'store-then-drop-once') expect(state.requests.map(request => request.body)).toEqual([state.requests[0].body, state.requests[0].body])
  }
  // The self-serve Todoist path confirms the same displayed command and uses
  // its UUID again when the paid/network edge reports a temporary failure.
  const todo = await actionsHttp({TASK_PROVIDER:'webhook',TASK_WEBHOOK_URL:'https://api.todoist.com/api/v1/sync',TASK_API_KEY:'synthetic-todoist-network-edge-only'} as Partial<WorkerBindings>)
  const action = await todo.create(), path = `/api/app/actions/${action.id}/task`
  const preview = await (await todo.call(path)).json() as Status
  const requests: string[] = []
  const edge = vi.spyOn(globalThis,'fetch').mockImplementation(async (_url,options) => {
    const commands = JSON.parse(new URLSearchParams(String(options!.body)).get('commands')!)
    requests.push(JSON.stringify(commands))
    if(requests.length === 1) return new Response(null,{status:503})
    return Response.json({sync_status:{[commands[0].uuid]:'ok'},temp_id_mapping:{[commands[0].temp_id]:'real-edge-task-123'}})
  })
  try {
    const first = await todo.call(`${path}/confirm`,{payloadSha256:preview.payloadSha256})
    expect((await first.json()).delivery.state).toBe('failed')
    const retry = await todo.call(`${path}/retry`,{})
    expect((await retry.json()).delivery).toMatchObject({state:'confirmed',remoteTaskId:'real-edge-task-123'})
    expect(requests).toHaveLength(2)
    expect(requests[0]).toBe(requests[1])
    expect(JSON.parse(requests[0])).toEqual((preview as Status & {request:{commands:unknown}}).request.commands)
  } finally {edge.mockRestore()}
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

contract(['ACT-004', 'ACT-007'], 'with no adapter configured the external task is unavailable and the action works; redirects are not followed and a plain http URL is refused outside the dev and test runtimes', async () => {
  await reset('ok')
  const bare = await actionsHttp()
  const bareAction = await bare.create()
  expect(await (await bare.call(`/api/app/actions/${bareAction.id}/task`)).json() as Status).toMatchObject({ available: false, delivery: null })
  expect((await bare.call(`/api/app/actions/${bareAction.id}/task/confirm`, { payloadSha256: 'a'.repeat(64) })).status).toBe(409)
  expect((await bare.call(`/api/app/actions/${bareAction.id}/transitions`, { to: 'in_progress' })).status).toBe(200)
  expect((await received()).requests).toEqual([])
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
