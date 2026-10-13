import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { afterEach, beforeAll, expect, vi } from 'vitest'
import { contract } from '../../src/test/contract'
import worker from '../../src/core/app/worker'
import { serverExtension } from '../../src/ext/index.server'
import type { WorkerBindings } from '../../src/core/app/environment'
import { actionsHttp } from './actions-fixture'
declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(() => applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__))
afterEach(() => { vi.useRealTimers() })

type Detail = { id: string; state: string; verdict: string | null; version: number; reviewDue: boolean; history: unknown[]; measurements: Array<{ observedValue: number; unit: string; difference: number; direction: string; flowId: string; revisionId: string | null; operator: string }> }
const scheduled = (at: string) => worker.scheduled!({ scheduledTime: Date.parse(at), cron: '*/5 * * * *', noRetry() {} } as ScheduledController, env as unknown as WorkerBindings, { waitUntil() {}, passThroughOnException() {} } as unknown as ExecutionContext)

contract('ACT-005', 'an operator records a comparable observed value and sets the verdict; Pencil only shows the difference', async () => {
  const f = await actionsHttp()
  await f.respond('Too long', 'slow')
  const action = await f.create()
  for (const to of ['in_progress', 'ready_for_review']) expect((await f.call(`/api/app/actions/${action.id}/transitions`, { to })).status).toBe(200)
  const later = { flowId: f.flowId, revisionId: f.revisionId, observedValue: 52, observedAt: '2026-11-20T09:00:00Z' }
  const refused = await f.call(`/api/app/actions/${action.id}/measurements`, { ...later, unit: 'responses' })
  expect(refused.status).toBe(400)
  expect((await refused.json() as { message: string }).message).toBe('Record the observed value in percent, the unit of the baseline, so the two can be compared.')
  const recorded = await f.call(`/api/app/actions/${action.id}/measurements`, { ...later, unit: 'percent' })
  expect(recorded.status).toBe(201)
  const measured = await recorded.json() as Detail
  expect(measured.measurements).toEqual([expect.objectContaining({ flowId: f.flowId, revisionId: f.revisionId, observedValue: 52, unit: 'percent', difference: 19, direction: 'desired', operator: 'Lead operator' })])
  // Recording a value never decides the outcome.
  expect(measured).toMatchObject({ state: 'ready_for_review', verdict: null })
  expect((await f.call(`/api/app/actions/${action.id}/transitions`, { to: 'ineffective', note: 'Lunch queues are unchanged.' })).status).toBe(200)
  expect(await (await f.call(`/api/app/actions/${action.id}`)).json()).toMatchObject({ state: 'ineffective', verdict: 'ineffective' })
})

contract('ACT-005', 'a passed review date shows review due; the scheduled handler changes no state, verdict or history', async () => {
  const f = await actionsHttp()
  const action = await f.create({ reviewDate: '2026-12-01' })
  const waiting = await f.create({ reviewDate: '2026-12-01' })
  for (const to of ['in_progress', 'ready_for_review']) expect((await f.call(`/api/app/actions/${waiting.id}/transitions`, { to })).status).toBe(200)
  await f.call(`/api/app/actions/${waiting.id}/measurements`, { flowId: f.flowId, observedValue: 60, unit: 'percent', observedAt: '2026-11-30T09:00:00Z' })
  const read = async (id: string) => await (await f.call(`/api/app/actions/${id}`)).json() as Detail
  const before = [await read(action.id), await read(waiting.id)]
  expect(before.map(item => item.reviewDue)).toEqual([false, false])
  const tables = async () => JSON.stringify(await Promise.all(['actions', 'action_events', 'action_measurements', 'audit_entries'].map(table => env.DB.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all().then(result => result.results))))
  const stored = await tables()
  // Move the clock past the review date (UTC workspace) and let the deployment's scheduled work run.
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-12-02T08:00:00Z'))
  // Maintenance expires sessions by the scheduled time; keep the reading operator's session beyond it.
  await env.DB.prepare('UPDATE oa_sessions SET expires_at = ? WHERE id = ?').bind(Date.parse('2028-01-01T00:00:00Z'), f.lead.sessionId).run()
  await scheduled('2026-12-02T08:00:00Z'); await scheduled('2027-03-01T00:00:00Z')
  expect(await tables()).toBe(stored)
  const after = [await read(action.id), await read(waiting.id)]
  expect(after.map(item => [item.state, item.verdict, item.reviewDue])).toEqual([['planned', null, true], ['ready_for_review', null, true]])
  expect(after.map(item => item.history)).toEqual(before.map(item => item.history))
  const list = await (await f.call('/api/app/actions')).json() as { today: string; actions: Array<{ id: string; reviewDue: boolean }> }
  expect(list.today).toBe('2026-12-02')
  expect(list.actions.filter(item => item.reviewDue).map(item => item.id).sort()).toEqual([action.id, waiting.id].sort())
})

contract('ACT-005', 'extension configuration cannot supply a verdict', async () => {
  const planted = { 'action.measurement.v1': { verdict: 'effective' }, actionVerdict: 'effective', actionPolicies: { 'action.measurement.v1': () => 'effective' } }
  Object.assign(serverExtension, planted)
  try {
    const f = await actionsHttp()
    const action = await f.create()
    for (const to of ['in_progress', 'ready_for_review']) expect((await f.call(`/api/app/actions/${action.id}/transitions`, { to })).status).toBe(200)
    await f.call(`/api/app/actions/${action.id}/measurements`, { flowId: f.flowId, observedValue: 90, unit: 'percent', observedAt: '2026-11-30T09:00:00Z' })
    await env.DB.prepare('UPDATE oa_sessions SET expires_at = ? WHERE id = ?').bind(Date.now() + 2 * 365 * 86400000, f.lead.sessionId).run()
    await scheduled(new Date(Date.now() + 365 * 86400000).toISOString())
    expect(await (await f.call(`/api/app/actions/${action.id}`)).json()).toMatchObject({ state: 'ready_for_review', verdict: null })
    // A request field cannot carry one either: verdicts arrive only as an operator's transition.
    expect((await f.call(`/api/app/actions/${action.id}`, { verdict: 'effective', expectedVersion: 3 }, { method: 'PATCH' })).status).toBe(400)
    expect((await f.call(`/api/app/actions/${action.id}/measurements`, { flowId: f.flowId, observedValue: 90, unit: 'percent', observedAt: '2026-11-30T09:00:00Z', verdict: 'effective' })).status).toBe(400)
    expect(await (await f.call(`/api/app/actions/${action.id}`)).json()).toMatchObject({ state: 'ready_for_review', verdict: null })
  } finally { for (const key of Object.keys(planted)) delete (serverExtension as Record<string, unknown>)[key] }
})
