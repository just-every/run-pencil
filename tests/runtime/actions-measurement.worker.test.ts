import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { afterEach, beforeAll, expect, vi } from 'vitest'
import { contract } from '../../src/test/contract'
import worker from '../../src/core/app/worker'
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
