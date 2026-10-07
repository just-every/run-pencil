import { applyD1Migrations, env, SELF, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect, it } from 'vitest'
import { createPencilServices } from '../../src/core/app/services'
import { createPencilPlatform } from '../../src/core/platform/runtime'
import { foundationFixture } from './foundation-fixture'

declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(() => applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__))
const publicRead = (slug: string) => SELF.fetch(`http://localhost/api/public/flows/${slug}`)

it('reads one coherent graph across an owner restore and observes restored bytes on the next request', async () => {
  const f = await foundationFixture('public-owner-restore')
  await f.add({ kind: 'question', questionType: 'single_choice', prompt: 'Original "question"', required: true, choices: [{ value: 'yes', label: 'Original choice' }] })
  await f.add({ kind: 'completion', questionType: null, prompt: 'Original done' })
  const draft = await f.draft()
  await f.services.flows.replaceDraftBranchRules({ ...f.flow, expectedVersion: draft.flow.draftVersion, rules: [{ sourceStepId: draft.steps[0].id, predicateKind: 'equals', expectedValue: draft.choices[0].id, destinationStepId: draft.steps[1].id, position: 0 }] })
  await f.publish()
  const original = await f.services.flows.getPublicFlow(f.slug)
  let crossed = false
  const restore = async () => {
    if (crossed) return
    crossed = true
    await env.DB.batch([
      env.DB.prepare('UPDATE flows SET title = ? WHERE id = ?').bind('Restored flow', f.flow.flowId),
      env.DB.prepare('UPDATE flow_revisions SET title = ?, policy_snapshot_json = ? WHERE id = ?').bind('Restored revision', JSON.stringify({ 'flow.branch-selection.v1': 'last-matching-rule', 'response.identity.v1': 'anonymous-public-link', 'flow.response-admission.v1': 'independent-direct-completions' }), original.revision.id),
      env.DB.prepare('UPDATE flow_steps SET prompt = ?, required = 0 WHERE revision_id = ? AND stable_id = ?').bind('Restored "question"\nNew line', original.revision.id, original.steps[0].id),
      env.DB.prepare('UPDATE choice_options SET label = ? WHERE step_id IN (SELECT id FROM flow_steps WHERE revision_id = ?)').bind('Restored choice', original.revision.id),
      env.DB.prepare('UPDATE flow_branch_rules SET position = 1 WHERE revision_id = ?').bind(original.revision.id),
    ])
  }
  const statement = (target: D1PreparedStatement, query: string): D1PreparedStatement => new Proxy(target, { get(value, property) {
    if (property === 'bind') return (...values: unknown[]) => statement(value.bind(...values), query)
    if (property === 'raw') return async () => {
      const rows = await value.raw()
      // Commit a real restore after the flow read returns, before any subsequent
      // independently issued reads. No query result or stored value is mocked.
      if (query.includes('from "flows"')) await restore()
      return rows
    }
    const member = Reflect.get(value, property)
    return typeof member === 'function' ? member.bind(value) : member
  } })
  const binding = new Proxy(env.DB, { get(target, property) {
    if (property === 'prepare') return (query: string) => statement(target.prepare(query), query)
    const member = Reflect.get(target, property)
    return typeof member === 'function' ? member.bind(target) : member
  } })
  const services = createPencilServices(createPencilPlatform('http://localhost', { ...env, DB: binding }))
  expect(await services.flows.getPublicFlow(f.slug)).toEqual(original)
  expect(crossed).toBe(true)
  const restored = await (await publicRead(f.slug)).json<typeof original>()
  expect(restored).toMatchObject({ flow: { title: 'Restored flow' }, revision: { id: original.revision.id }, branchSelection: 'last-matching-rule' })
  expect(restored.steps[0]).toMatchObject({ id: original.steps[0].id, prompt: 'Restored "question"\nNew line', required: false })
  expect(restored.steps[1]).toEqual(original.steps[1])
  expect(restored.choices[0]).toMatchObject({ id: original.choices[0].id, label: 'Restored choice' })
  expect(restored.branchRules[0]).toMatchObject({ ...original.branchRules[0], position: 1 })
})

it('serves a fresh publication while existing sessions retain their graph and revision-specific closure', async () => {
  const f = await foundationFixture('public-fresh-publication')
  await f.add({ kind: 'question', questionType: 'short_text', prompt: 'First version', required: true })
  await f.add({ kind: 'completion', questionType: null, prompt: 'Done' })
  await f.publish()
  const old = await f.start()
  const oldClosed = await f.start()
  const draft = await f.draft()
  await f.services.flows.updateBuilderDraft({ ...f.flow, expectedVersion: draft.flow.draftVersion, stepId: draft.steps[0].id, prompt: 'Second version', required: true })
  await f.publish()
  const current = await (await publicRead(f.slug)).json<typeof old.flow>()
  expect(current.revision.id).not.toBe(old.revisionId)
  expect(current.steps[0].prompt).toBe('Second version')
  await f.mature(old.sessionId)
  const receipt = await f.final(old, [{ stepId: old.flow.steps[0].id, value: 'Retained old answer' }])
  expect(await env.DB.prepare('SELECT revision_id AS revisionId FROM responses WHERE id = ?').bind(receipt.responseId).first()).toEqual({ revisionId: old.revisionId })
  await env.DB.prepare('UPDATE flow_revisions SET deadline_at = ? WHERE id = ?').bind(new Date(Date.now() - 1_000).toISOString(), old.revisionId).run()
  await expect(f.final(oldClosed, [{ stepId: oldClosed.flow.steps[0].id, value: 'Closed old answer' }])).rejects.toMatchObject({ code: 'FLOW_CLOSED' })
  expect((await publicRead(f.slug)).status).toBe(200)
  expect((await f.start()).revisionId).toBe(current.revision.id)
})

it('counts only this revision’s released responses and observes release, erasure and manual closure without cached admission', async () => {
  const f = await foundationFixture('public-live-target')
  await f.add({ kind: 'question', questionType: 'short_text', prompt: 'Target answer', required: true })
  await f.add({ kind: 'completion', questionType: null, prompt: 'Done' })
  await f.services.flows.publishDraft({ ...f.flow, expectedVersion: (await f.draft()).flow.draftVersion, targetCompletedResponses: 1 })
  expect((await publicRead(f.slug)).status).toBe(200)
  const session = await f.start()
  const receipt = await f.final(session, [{ stepId: session.flow.steps[0].id, value: 'Quarantined answer' }])
  expect(receipt.disposition).toBe('quarantined')
  expect((await publicRead(f.slug)).status).toBe(200)
  await f.services.responses.releaseQuarantinedResponse({ ...f.scope, responseId: receipt.responseId!, operatorId: f.operatorId })
  expect((await publicRead(f.slug)).status).toBe(409)
  await expect(f.start()).rejects.toMatchObject({ code: 'FLOW_CLOSED' })
  await f.services.responses.eraseReleasedResponse({ ...f.scope, responseId: receipt.responseId!, operatorId: f.operatorId })
  expect((await publicRead(f.slug)).status).toBe(200)
  expect((await f.start()).revisionId).toBe(session.revisionId)
  await f.services.flows.closeFlow(f.scope.workspaceId, f.flow.flowId, f.operatorId)
  expect((await publicRead(f.slug)).status).toBe(409)
  await f.services.flows.archiveFlow(f.scope.workspaceId, f.flow.flowId, f.operatorId)
  expect((await publicRead(f.slug)).status).toBe(404)
})

it('refuses missing, malformed, unpublished and deadline-closed flows without creating a respondent session', async () => {
  const f = await foundationFixture('public-unpublished')
  const sessions = () => env.DB.prepare('SELECT COUNT(*) AS count FROM respondent_sessions').first()
  const before = await sessions()
  for (const slug of [f.slug, 'does-not-exist']) expect((await publicRead(slug)).status).toBe(404)
  expect((await publicRead('invalid_slug')).status).toBe(400)
  await f.add({ kind: 'question', questionType: 'short_text', prompt: 'Deadline', required: true })
  await f.add({ kind: 'completion', questionType: null, prompt: 'Done' })
  await f.publish()
  const published = await f.services.flows.getPublicFlow(f.slug)
  await env.DB.prepare('UPDATE flow_revisions SET deadline_at = ? WHERE id = ?').bind(new Date(Date.now() - 1_000).toISOString(), published.revision.id).run()
  expect((await publicRead(f.slug)).status).toBe(409)
  expect(await sessions()).toEqual(before)
})
