import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import type { ActionState } from '../../src/core/features/actions/model'
import { actionsHttp, rows } from './actions-fixture'
declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(() => applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__))

// CONTRACT.md ACT-002, written out here so the server's table is checked against the contract, not against itself.
const actionStates: ActionState[] = ['planned', 'in_progress', 'ready_for_review', 'effective', 'ineffective', 'closed']
const legalTransitions: Record<ActionState, ActionState[]> = { planned: ['in_progress', 'closed'], in_progress: ['ready_for_review', 'closed'], ready_for_review: ['effective', 'ineffective', 'in_progress', 'closed'], effective: ['closed'], ineffective: ['closed'], closed: [] }
type Detail = { id: string; state: ActionState; version: number; verdict: string | null; history: Array<{ kind: string; fromState: string | null; toState: string | null; note: string | null; changes: Record<string, unknown> | null; operator: string | null; createdAt: string }>; [key: string]: any }

contract('ACT-002', 'the server enforces the lifecycle: every legal move is recorded, every illegal move answers 409 and changes nothing', async () => {
  const f = await actionsHttp()
  await f.respond('Short', 'fine')
  const read = async (id: string) => await (await f.call(`/api/app/actions/${id}`)).json() as Detail
  // Reach every state, then try every target from it.
  const paths: Record<ActionState, ActionState[]> = { planned: [], in_progress: ['in_progress'], ready_for_review: ['in_progress', 'ready_for_review'], effective: ['in_progress', 'ready_for_review', 'effective'], ineffective: ['in_progress', 'ready_for_review', 'ineffective'], closed: ['closed'] }
  let legal = 0, illegal = 0
  for (const from of actionStates) for (const to of actionStates) {
    const action = await f.create()
    for (const step of paths[from]) expect((await f.call(`/api/app/actions/${action.id}/transitions`, { to: step, note: `to ${step}` })).status).toBe(200)
    const before = await read(action.id)
    expect(before.state).toBe(from)
    const response = await f.call(`/api/app/actions/${action.id}/transitions`, { to, note: `Operator note for ${to}` })
    const after = await read(action.id)
    if (legalTransitions[from].includes(to)) {
      legal++
      expect(response.status, `${from} -> ${to}`).toBe(200)
      expect(after.state).toBe(to)
      expect(after.version).toBe(before.version + 1)
      expect(after.history.at(-1)).toMatchObject({ kind: 'transition', fromState: from, toState: to, note: `Operator note for ${to}`, operator: 'Lead operator' })
      expect(Date.parse(after.history.at(-1)!.createdAt)).not.toBeNaN()
      expect(after.verdict).toBe(to === 'effective' || to === 'ineffective' ? to : before.verdict)
    } else {
      illegal++
      expect(response.status, `${from} -> ${to}`).toBe(409)
      expect((await response.json() as { message: string }).message).toMatch(/cannot move to/)
      expect(after).toEqual(before)
    }
  }
  expect(legal + illegal).toBe(36)
  // A note is optional; closing from effective keeps the human verdict.
  const kept = await f.create()
  for (const to of ['in_progress', 'ready_for_review', 'effective', 'closed']) expect((await f.call(`/api/app/actions/${kept.id}/transitions`, { to })).status).toBe(200)
  expect(await read(kept.id)).toMatchObject({ state: 'closed', verdict: 'effective' })
  // Edits are recorded in the same history, with the operator and time.
  const edited = await f.create()
  const editResponse = await f.call(`/api/app/actions/${edited.id}`, { title: 'Open a second till at lunch', ownerOperatorId: f.lead.operatorId, reviewDate: '2027-01-15', expectedVersion: edited.version }, { method: 'PATCH' })
  expect(editResponse.status).toBe(200)
  const afterEdit = await read(edited.id)
  expect(afterEdit.history.at(-1)).toMatchObject({ kind: 'edited', operator: 'Lead operator', changes: { title: { from: 'Shorten the wait at the counter', to: 'Open a second till at lunch' }, ownerOperatorId: { from: f.owner.operatorId, to: f.lead.operatorId }, reviewDate: { from: '2026-12-01', to: '2027-01-15' } } })
  expect((await f.call(`/api/app/actions/${edited.id}`, { title: 'Stale edit', expectedVersion: edited.version }, { method: 'PATCH' })).status).toBe(409)
  const audit = (await rows('audit_entries', 'subject_id', edited.id)).map(row => [row.kind, row.details_json])
  expect(audit).toEqual([['action.created', '{"actions":1}'], ['action.edited', '{"fields":3}']])
})
