import { env } from 'cloudflare:test'
import { expect, vi } from 'vitest'
import type { ActionHealthReport } from '../../src/core/features/actions/health'
import type { WorkerBindings } from '../../src/core/app/environment'
import { createWorkerApp } from '../../src/core/app/worker'
import { createPencilPlatform } from '../../src/core/platform/runtime'
import { actionsHttp } from './actions-fixture'

type Fixture = Awaited<ReturnType<typeof actionsHttp>>

export async function readHealth(f: Fixture, actionId: string) {
  const response = await f.call(`/api/app/actions/${actionId}/health`)
  expect(response.status).toBe(200)
  return await response.json() as ActionHealthReport
}

async function retained(actionId: string) {
  return Promise.all(['actions', 'action_events', 'action_task_deliveries', 'action_task_attempts', 'action_reminders', 'action_reminder_attempts'].map(table => {
    const condition = table === 'actions' ? 'id=?' : table === 'action_reminder_attempts'
      ? 'reminder_id IN (SELECT id FROM action_reminders WHERE action_id=?)' : 'action_id=?'
    return env.DB.prepare(`SELECT * FROM ${table} WHERE ${condition} ORDER BY 1`).bind(actionId).all().then(result => result.results)
  }))
}

export async function taskFailureHealth(f: Fixture, actionId: string, state: 'failed' | 'unknown') {
  const stored = await env.DB.prepare('SELECT id FROM action_task_attempts WHERE action_id=? ORDER BY ordinal').bind(actionId).all<{id: string}>()
  const before = await retained(actionId), alreadyMocked = vi.isMockFunction(globalThis.fetch), outbound = vi.spyOn(globalThis, 'fetch'), calls = outbound.mock.calls.length
  let report: ActionHealthReport
  try {
    report = await readHealth(f, actionId)
    expect(await readHealth(f, actionId)).toEqual(report)
    expect(outbound).toHaveBeenCalledTimes(calls)
  } finally { if (!alreadyMocked) outbound.mockRestore() }
  expect(await retained(actionId)).toEqual(before)
  expect(report.task.delivery).toMatchObject({ actionId, idempotencyKey: `pencil-action-${actionId}`, state, stale: false })
  expect(report.task.delivery!.attempts.map(item => item.id)).toEqual(stored.results.map(item => item.id))
  expect(report.task.delivery!.attempts[0].explanation).toMatch(state === 'failed' ? /server error/ : /may have created/)
  expect(report.task.repairPlan).toEqual([expect.stringContaining('explicit operator retry')])
  return report
}

/** Same action: a real refused task transport, owner removal, no-effect reads, and explicit recovery. */
export async function brokenActionHealth(receiver: string) {
  await fetch(`${receiver}/__control/reset`, { method: 'POST', body: JSON.stringify({ mode: 'fail-once-500' }) })
  const key = 'synthetic-pencil-health-1'
  const f = await actionsHttp({ TASK_PROVIDER: 'webhook', TASK_WEBHOOK_URL: `${receiver}/tasks`, TASK_API_KEY: key } as Partial<WorkerBindings>)
  const departing = await f.operator('Departing health owner')
  const action = await f.create({ ownerOperatorId: departing.operatorId, rationale: 'synthetic-pencil-private-action' })
  const taskPath = `/api/app/actions/${action.id}/task`, healthPath = `/api/app/actions/${action.id}/health`
  const preview = await (await f.call(taskPath)).json() as {payloadSha256: string}
  expect((await f.call(`${taskPath}/confirm`, { payloadSha256: preview.payloadSha256 })).status).toBe(200)
  await f.services.auth.removeOperator({ workspaceId: f.workspaceId, actorOperatorId: f.lead.operatorId, targetOperatorId: departing.operatorId })
  const foreign = await actionsHttp()
  const revoked = await f.operator('Revoked health reader')
  await env.DB.prepare('DELETE FROM oa_sessions WHERE id=?').bind(revoked.sessionId).run()
  const before = await retained(action.id), alreadyMocked = vi.isMockFunction(globalThis.fetch), outbound = vi.spyOn(globalThis, 'fetch'), calls = outbound.mock.calls.length
  let report: ActionHealthReport
  try {
    report = await readHealth(f, action.id)
    expect(await readHealth(f, action.id)).toEqual(report)
    for (const [call, expected] of [
      [() => f.call(healthPath, undefined, { auth: false }), 401],
      [() => foreign.call(healthPath), 404],
      [() => f.as(revoked.token)(healthPath), 401],
    ] as const) {
      const denied = await call()
      expect(denied.status).toBe(expected)
      const body = await denied.text()
      for (const privateValue of [action.id, f.workspaceId, 'synthetic-pencil-private-action', `pencil-action-${action.id}`]) expect(body).not.toContain(privateValue)
    }
    expect(outbound).toHaveBeenCalledTimes(calls)
  } finally { if (!alreadyMocked) outbound.mockRestore() }
  expect(await retained(action.id)).toEqual(before)
  expect(report.task.delivery).toMatchObject({ actionId: action.id, state: 'failed', stale: true })
  const attempt = await env.DB.prepare('SELECT id FROM action_task_attempts WHERE action_id=?').bind(action.id).first<{id: string}>()
  expect(report.task.delivery!.attempts).toEqual([expect.objectContaining({ id: attempt!.id, state: 'failed', httpStatus: 500 })])
  expect(report.reminders).toMatchObject({ actionId: action.id, state: 'no_owner', explanation: expect.stringContaining('no current owner'), repairPlan: [expect.stringContaining('operator must choose')] })
  for (const value of [key, 'synthetic-pencil-private-action', receiver]) expect(JSON.stringify(report)).not.toContain(value)
  // Repairing the owner changes the payload: a retry cannot approve that change.
  expect((await f.call(`/api/app/actions/${action.id}`, { ownerOperatorId: f.owner.operatorId, expectedVersion: action.version }, { method: 'PATCH' })).status).toBe(200)
  expect((await f.call(`${taskPath}/retry`, {})).status).toBe(409)
  expect((await readHealth(f, action.id)).task.repairPlan).toEqual([expect.stringContaining('explicitly confirm it again')])
  const state = await (await fetch(`${receiver}/__control/state`)).json() as {requests: unknown[]}
  expect(state.requests).toHaveLength(1)
  const fresh = await (await f.call(taskPath)).json() as {payloadSha256: string}
  expect(fresh.payloadSha256).not.toBe(preview.payloadSha256)
  expect((await (await f.call(`${taskPath}/confirm`, {payloadSha256: fresh.payloadSha256})).json()).delivery.state).toBe('confirmed')
  const repaired = await readHealth(f, action.id)
  expect(repaired.task.delivery).toMatchObject({state: 'confirmed', attempts: [expect.objectContaining({id: attempt!.id})]})
  expect(repaired.task.repairPlan).toEqual([])
  expect(repaired.reminders.state).toBe('suppressed')
}

export async function reminderFailureHealth(f: Fixture, unknownActionId: string, failedActionId: string) {
  for (const [actionId, state] of [[unknownActionId, 'unknown'], [failedActionId, 'failed']] as const) {
    const occurrences = await env.DB.prepare('SELECT id FROM action_reminders WHERE action_id=? AND status=?').bind(actionId, state).all<{id: string}>()
    expect(occurrences.results).toHaveLength(1)
    const before = await retained(actionId), alreadyMocked = vi.isMockFunction(globalThis.fetch), outbound = vi.spyOn(globalThis, 'fetch'), calls = outbound.mock.calls.length
    try {
      const report = await readHealth(f, actionId)
      expect(report.reminders.occurrences).toEqual([expect.objectContaining({id: occurrences.results[0].id, state, attempts: 1, explanation: expect.stringContaining(state === 'unknown' ? 'may have succeeded' : 'failed'), repairPlan: [expect.stringContaining(state === 'unknown' ? 'unresent' : 'does not replay')]})])
      expect(await readHealth(f, actionId)).toEqual(report)
      expect(outbound).toHaveBeenCalledTimes(calls)
    } finally { if (!alreadyMocked) outbound.mockRestore() }
    expect(await retained(actionId)).toEqual(before)
  }
  // Mail configuration explains schedule failure without exposing the configured sender or credentials.
  const sender = ['synthetic-pencil-sender', 'example.test'].join(String.fromCharCode(64))
  const origin = 'https://forms.example.test'
  const unavailable = createWorkerApp(undefined, createPencilPlatform(origin, {
    ...env, APP_ORIGIN: origin, SEED_ADMIN_EMAIL: sender, MAIL_PROVIDER: 'sendgrid',
    MAIL_API_KEY: 'synthetic-pencil-health-2', MAIL_FROM: sender,
  } as WorkerBindings))
  const response = await unavailable.request(`${origin}/api/app/actions/${failedActionId}/health`, {headers: {Cookie: `__Host-operator_session=${f.lead.token}`}})
  expect(response.status).toBe(200)
  const report = await response.json() as ActionHealthReport
  expect(report.reminders).toMatchObject({actionId: failedActionId, state: 'unavailable', repairPlan: [expect.stringContaining('repair mail configuration')]})
  for (const value of ['synthetic-pencil-health-2', sender]) expect(JSON.stringify(report)).not.toContain(value)
}
