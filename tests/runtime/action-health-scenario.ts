import { env } from 'cloudflare:test'
import { ulid } from 'ulid'
import { expect, vi } from 'vitest'
import type { ActionHealthReport } from '../../src/core/features/actions/health'
import { actionsHttp } from './actions-fixture'

type Fixture = Awaited<ReturnType<typeof actionsHttp>>
export async function readHealth(f: Fixture, actionId: string) {
  const response = await f.call(`/api/app/actions/${actionId}/health`)
  expect(response.status, await response.clone().text()).toBe(200)
  expect(response.headers.get('cache-control')).toBe('no-store')
  return response.json() as Promise<ActionHealthReport>
}

export async function proveTaskHealthRead(f: Fixture, actionId: string, state: 'failed' | 'unknown') {
  const attempts = (await env.DB.prepare('SELECT id FROM action_task_attempts WHERE action_id=? ORDER BY ordinal').bind(actionId).all<{id: string}>()).results
  const transport = vi.spyOn(globalThis, 'fetch')
  try {
    const report = await readHealth(f, actionId)
    expect(report).toMatchObject({ actionId, task: { available: true, delivery: { id: actionId, state, stale: false, idempotencyKey: `pencil-action-${actionId}` } } })
    expect(report.task.delivery!.attempts.map(attempt => attempt.id)).toEqual(attempts.map(attempt => attempt.id))
    expect(report.task.delivery!.attempts[0]).toMatchObject({ outcome: state, httpStatus: state === 'failed' ? 500 : null })
    expect(report.task.delivery!.attempts[0].explanation).toMatch(state === 'failed' ? /server error/ : /may already exist/)
    expect(report.task.repairPlan.join(' ')).toContain('explicitly retry the unchanged confirmed payload')
    expect(await readHealth(f, actionId)).toEqual(report)
    expect(transport).not.toHaveBeenCalled()
  } finally { transport.mockRestore() }
}

export async function proveBrokenOwnerAndTaskHealth(receiver: string) {
  await fetch(`${receiver}/__control/reset`, {method: 'POST', body: JSON.stringify({mode: 'fail-once-500'})})
  const key = 'synthetic-pencil-health-1'
  const f = await actionsHttp({ TASK_PROVIDER: 'webhook', TASK_WEBHOOK_URL: `${receiver}/tasks`, TASK_API_KEY: key })
  await f.respond('Too long', 'synthetic-pencil-private-answer')
  // Use a route-valid native ID for this owner; the shared action fixture uses UUID operators.
  const ownerId = ulid()
  await env.DB.prepare('INSERT INTO operators(id,workspace_id,email,display_name,is_setup_operator,created_at,updated_at) SELECT ?,workspace_id,replace(email,id,?),display_name,0,created_at,updated_at FROM operators WHERE id=?')
    .bind(ownerId,ownerId,f.owner.operatorId).run()
  await env.DB.prepare('UPDATE oa_sessions SET operator_id=? WHERE id=?').bind(ownerId,f.owner.sessionId).run()
  const action = await f.create({ownerOperatorId:ownerId,rationale: 'synthetic-pencil-private-rationale'})
  const path = `/api/app/actions/${action.id}`
  const preview = await (await f.call(`${path}/task`)).json() as {payloadSha256: string}
  expect((await f.call(`${path}/task/confirm`, {payloadSha256: preview.payloadSha256})).status).toBe(200)
  const attempt = await env.DB.prepare('SELECT id FROM action_task_attempts WHERE action_id=?').bind(action.id).first<{id: string}>()
  // This is the native operator-removal door, not a synthetic broken-schedule row.
  expect((await f.call(`/api/app/operators/${ownerId}`, {}, {method: 'DELETE'})).status).toBe(204)
  const foreign = await actionsHttp()
  const requests = async () => (await (await fetch(`${receiver}/__control/state`)).json() as {requests: Array<{body: string; idempotencyKey: string}>}).requests
  const before = await requests()
  expect(before).toHaveLength(1)
  const transport = vi.spyOn(globalThis, 'fetch')
  try {
    const report = await readHealth(f, action.id)
    expect(report).toMatchObject({ actionId: action.id, task: { delivery: {id: action.id, state: 'failed', stale: true, attempts: [{id: attempt!.id, outcome: 'failed', httpStatus: 500}]} }, reminders: {schedule: {actionId: action.id, state: 'no_owner'}} })
    expect(report.reminders.schedule.explanation).toContain('no current owner')
    expect(report.reminders.schedule.repairPlan).toEqual([expect.stringMatching(/operator.*choose.*current workspace owner/i)])
    expect(report.task.repairPlan.join(' ')).toContain('explicitly confirm it again')
    expect(await readHealth(f, action.id)).toEqual(report)
    for (const [denied, status] of [[await f.call(`${path}/health`, undefined, {auth: false}), 401], [await foreign.call(`${path}/health`), 404], [await f.as(f.owner.token)(`${path}/health`), 401]] as const) {
      expect(denied.status).toBe(status)
      const body = await denied.text()
      for (const privateValue of [action.id, attempt!.id, 'synthetic-pencil-private', `pencil-action-${action.id}`]) expect(body).not.toContain(privateValue)
    }
    const text = JSON.stringify(report)
    for (const privateValue of [key, 'synthetic-pencil-private', 'operators.example.test', 'payloadSha256', 'ownerEmail']) expect(text).not.toContain(privateValue)
    expect(transport).not.toHaveBeenCalled()
  } finally { transport.mockRestore() }
  expect(await requests()).toEqual(before)
  // Repair is explicit and changes the payload. Retry must refuse until a fresh confirmation.
  const detail = await (await f.call(path)).json() as {version: number}
  expect((await f.call(path, {ownerOperatorId: f.lead.operatorId, expectedVersion: detail.version}, {method: 'PATCH'})).status).toBe(200)
  expect((await f.call(`${path}/task/retry`, {})).status).toBe(409)
  expect(await requests()).toEqual(before)
  const current = await (await f.call(`${path}/task`)).json() as {payloadSha256: string}
  expect(current.payloadSha256).not.toBe(preview.payloadSha256)
  expect((await f.call(`${path}/task/confirm`, {payloadSha256: preview.payloadSha256})).status).toBe(409)
  expect(await requests()).toEqual(before)
  const sent = await f.call(`${path}/task/confirm`, {payloadSha256: current.payloadSha256})
  expect(await sent.json()).toMatchObject({delivery: {state: 'confirmed'}})
  const after = await requests()
  expect(after).toHaveLength(2)
  expect(after.map(request => request.idempotencyKey)).toEqual([`pencil-action-${action.id}`, `pencil-action-${action.id}`])
  expect(after[1].body).not.toBe(after[0].body)
  expect((await readHealth(f, action.id)).task.delivery!.attempts.map(item => item.id)).toEqual([attempt!.id])
}
