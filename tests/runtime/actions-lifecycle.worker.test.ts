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

contract(['ACT-001', 'ACT-008'], 'an operator turns results into an owned action with frozen figures and no response data; accepting contacts nobody', async () => {
  const f = await actionsHttp()
  await f.respond('Short', 'RESPONDENT-CANARY-a17 the barista was lovely'); await f.respond('Too long', 'RESPONDENT-CANARY-b28 queue out the door'); await f.respond('Too long', 'RESPONDENT-CANARY-c39 waited ages')
  const outbound: unknown[] = [], original = globalThis.fetch
  globalThis.fetch = (async (...args: Parameters<typeof fetch>) => { outbound.push(args[0]); return original(...args) }) as typeof fetch
  let action: Detail
  try { action = await f.create() } finally { globalThis.fetch = original }
  expect(outbound).toEqual([])
  expect(action).toMatchObject({ state: 'planned', verdict: null, source: 'manual', analysisId: null, owner: { id: f.owner.operatorId, displayName: 'Owning operator' }, reviewDate: '2026-12-01' })
  expect(action.metric).toEqual({ name: 'Visitors saying the wait was short', unit: 'percent', direction: 'increase', baselineValue: 33, baselineSource: 'Revision 1 results', baselineObservedAt: '2026-10-12T09:00:00.000Z' })
  expect(action.evidence.figures).toEqual({ flowTitle: expect.stringContaining('Café visit'), revisionNumber: 1, completedResponses: 3, starts: 3, question: { prompt: 'How was the wait?', questionType: 'single_choice', reached: 3, answered: 3, counts: [{ label: 'Short', count: 1, of: 3 }, { label: 'Too long', count: 2, of: 3 }], countLabel: 'One answer per response.' } })
  // The figures stay as they were when results change.
  await f.respond('Short', 'RESPONDENT-CANARY-d40 later visit')
  const reread = await (await f.call(`/api/app/actions/${action.id}`)).json() as Detail
  expect(reread.evidence.figures.question.counts).toEqual(action.evidence.figures.question.counts)
  expect(reread.history.map(event => [event.kind, event.toState, event.operator])).toEqual([['created', 'planned', 'Lead operator']])
  // No response identifier, answer text or cohort filter is stored with the action or its audit rows.
  const responses = (await env.DB.prepare('SELECT id FROM responses WHERE flow_id = ?').bind(f.flowId).all<{ id: string }>()).results.map(row => row.id)
  const stored = JSON.stringify([await rows('actions', 'id', action.id), await rows('action_evidence', 'action_id', action.id), await rows('action_events', 'action_id', action.id), await rows('audit_entries', 'subject_id', action.id)])
  for (const forbidden of [...responses, 'RESPONDENT-CANARY', 'barista']) expect(stored).not.toContain(forbidden)
  expect((await rows('audit_entries', 'subject_id', action.id)).map(row => [row.kind, row.details_json])).toEqual([['action.created', '{"actions":1}']])
  // ACT-008: an action written by hand from results evidence has no analysis link; the browser can name only an analysis of this workspace.
  expect((await f.call('/api/app/actions', f.input({ analysisId: 'analysis-1' }))).status).toBe(404)
  expect((await f.call('/api/app/actions', f.input({ source: 'analysis' }))).status).toBe(400)
  await expect(env.DB.prepare("UPDATE actions SET source = 'analysis' WHERE id = ?").bind(action.id).run()).rejects.toThrow(/CHECK/)
  // Revision-level evidence without a question.
  const revisionOnly = await f.create({ evidence: { flowId: f.flowId, revisionId: f.revisionId } })
  expect(revisionOnly.evidence.figures).toEqual({ flowTitle: expect.any(String), revisionNumber: 1, completedResponses: 4, starts: 4 })
  const list = await (await f.call('/api/app/actions')).json() as { actions: Array<{ id: string; owner: unknown; metric: unknown; reviewDate: string; reviewDue: boolean }> }
  expect(list.actions.map(item => item.id).sort()).toEqual([action.id, revisionOnly.id].sort())
})

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

contract(['ACT-001', 'ACT-002'], 'action routes answer 401 without a session, 403 cross-origin and 404 for unknown or other-workspace actions, and refuse a non-operator owner', async () => {
  const f = await actionsHttp(), other = await actionsHttp()
  const action = await f.create(), foreign = await other.create()
  const before = await (await f.call(`/api/app/actions/${action.id}`)).json()
  const cases: Array<[string, Response, number]> = [
    ['list without a session', await f.call('/api/app/actions', undefined, { auth: false }), 401],
    ['read without a session', await f.call(`/api/app/actions/${action.id}`, undefined, { auth: false }), 401],
    ['create without a session', await f.call('/api/app/actions', f.input(), { auth: false }), 401],
    ['transition without a session', await f.call(`/api/app/actions/${action.id}/transitions`, { to: 'in_progress' }, { auth: false }), 401],
    ['create cross-origin', await f.call('/api/app/actions', f.input(), { origin: 'https://attacker.example.test' }), 403],
    ['transition cross-origin', await f.call(`/api/app/actions/${action.id}/transitions`, { to: 'in_progress' }, { origin: 'https://attacker.example.test' }), 403],
    ['edit cross-origin', await f.call(`/api/app/actions/${action.id}`, { title: 'x', expectedVersion: 1 }, { method: 'PATCH', origin: 'https://attacker.example.test' }), 403],
    ['read unknown action', await f.call('/api/app/actions/unknown-action'), 404],
    ['transition unknown action', await f.call('/api/app/actions/unknown-action/transitions', { to: 'in_progress' }), 404],
    ['read another workspace action', await f.call(`/api/app/actions/${foreign.id}`), 404],
    ['transition another workspace action', await f.call(`/api/app/actions/${foreign.id}/transitions`, { to: 'in_progress' }), 404],
    ['edit another workspace action', await f.call(`/api/app/actions/${foreign.id}`, { title: 'x', expectedVersion: 1 }, { method: 'PATCH' }), 404],
    ['measure another workspace action', await f.call(`/api/app/actions/${foreign.id}/measurements`, { flowId: f.flowId, observedValue: 1, unit: 'percent', observedAt: '2026-11-01T00:00:00Z' }), 404],
    ['create with an owner from another workspace', await f.call('/api/app/actions', f.input({ ownerOperatorId: other.owner.operatorId })), 400],
    ['create with an unknown owner', await f.call('/api/app/actions', f.input({ ownerOperatorId: 'not-an-operator' })), 400],
    ['edit to an owner from another workspace', await f.call(`/api/app/actions/${action.id}`, { ownerOperatorId: other.owner.operatorId, expectedVersion: 1 }, { method: 'PATCH' }), 400],
    ['create from another workspace flow', await f.call('/api/app/actions', f.input({ evidence: { flowId: other.flowId, revisionId: other.revisionId } })), 404],
  ]
  expect(cases.map(([name, response]) => [name, response.status])).toEqual(cases.map(([name, , status]) => [name, status]))
  expect(await (await f.call(`/api/app/actions/${action.id}`)).json()).toEqual(before)
  expect((await (await other.call(`/api/app/actions/${foreign.id}`)).json() as Detail).state).toBe('planned')
  expect((await (await f.call('/api/app/actions')).json() as { actions: Array<{ id: string }> }).actions.map(item => item.id)).toEqual([action.id])
})
