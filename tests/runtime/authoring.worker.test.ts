import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect, it } from 'vitest'
import { ulid } from 'ulid'
import { foundationFixture } from './foundation-fixture'
import { contract } from '../../src/test/contract'
import { flowTemplates } from '../../src/core/features/flows/templates'
declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(async () => { await applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__) })

for (const template of flowTemplates) it(`${template.title} creates, duplicates, publishes and counts one real response`, async () => {
  const f = await foundationFixture(`template-${template.id}`)
  const created = await f.services.flows.createDraftFlow({ ...f.scope, title: template.title, slug: `ready-${template.id}`, template: template.id })
  const flow = { ...f.scope, flowId: created.id }
  const draft = await f.services.flows.getBuilderDraft(f.scope.workspaceId, created.id)
  expect(draft.flow.hasUnpublishedChanges).toBe(false)
  expect(draft.steps.filter(step => step.kind === 'question').length).toBeGreaterThan(0)
  expect((await f.services.flows.publishDraft({ ...flow, expectedVersion: draft.flow.draftVersion })).kind).toBe('published')
  expect((await f.services.flows.getBuilderDraft(f.scope.workspaceId, created.id)).flow.hasUnpublishedChanges).toBe(false)
  const session = await f.services.responses.startPublicSession({ slug: created.slug, deviceClass: 'desktop', source: 'direct', clientAddress: created.slug })
  await f.mature(session.sessionId)
  const answers = draft.steps.filter(step => step.kind === 'question').map(step => ({ stepId: step.id, value: step.questionType === 'single_choice' ? draft.choices.find(choice => choice.stepId === step.id)!.id : step.questionType === 'rating' || step.questionType === 'nps' ? 9 : step.questionType === 'email' ? 'synthetic@example.test' : 'Synthetic enquiry' }))
  const receipt = await f.services.responses.submitPublicResponse({ slug: created.slug, sessionId: session.sessionId, sessionToken: session.sessionToken, idempotencyKey: `template-${template.id}`, answers, clientAddress: created.slug })
  expect(receipt.disposition).toBe('released')
  expect(await f.services.flows.getFlowResults(f.scope.workspaceId, created.id)).toMatchObject({ completedResponses: 1 })
  const copy = await f.services.flows.duplicateFlow({ ...flow, title: `${template.title} copy`, slug: `copy-${template.id}` })
  const copied = await f.services.flows.getBuilderDraft(f.scope.workspaceId, copy.id)
  expect(copied.steps.map(step => step.prompt)).toEqual(draft.steps.map(step => step.prompt))
  expect(copied.steps.every(step => !draft.steps.some(original => original.id === step.id))).toBe(true)
  expect((await f.services.flows.listDashboard(f.scope.workspaceId)).find(item => item.id === copy.id)).toMatchObject({ status: 'draft', completedResponses: 0 })
})

it('one save commits content, new choices and paths together; stale and invalid saves change nothing', async () => {
  const f = await foundationFixture('one-save')
  await f.add({ kind: 'question', questionType: 'short_text', prompt: 'Original prompt' })
  await f.add({ kind: 'completion', questionType: null, prompt: 'Done' })
  const before = await f.draft()
  const choiceId = ulid()
  const input = { ...f.flow, expectedVersion: before.flow.draftVersion, stepId: before.steps[0].id, prompt: 'Choose a path', required: true, questionType: 'single_choice' as const, choices: [{ newId: choiceId, value: 'continue', label: 'Continue' }], rules: [{ sourceStepId: before.steps[0].id, predicateKind: 'equals' as const, expectedValue: choiceId, destinationStepId: before.steps[1].id, position: 0 }] }
  const result = await f.services.flows.updateBuilderDraft(input)
  expect(result).toMatchObject({ kind: 'updated', draftVersion: before.flow.draftVersion + 1 })
  const saved = await f.draft()
  expect(saved.steps[0].prompt).toBe('Choose a path')
  expect(saved.choices[0]).toMatchObject({ id: choiceId, label: 'Continue' })
  expect(saved.branchRules[0]).toMatchObject({ expectedValue: choiceId })
  expect(await f.services.flows.updateBuilderDraft({ ...input, prompt: 'Stale overwrite' })).toMatchObject({ kind: 'conflict', latestVersion: saved.flow.draftVersion })
  expect(await f.draft()).toEqual(saved)
  await expect(f.services.flows.updateBuilderDraft({ ...input, expectedVersion: saved.flow.draftVersion, prompt: 'Invalid overwrite', choices: [{ id: choiceId, value: 'continue', label: 'Changed' }], rules: [{ ...input.rules[0], expectedValue: ulid() }] })).rejects.toThrow('Answer paths are invalid')
  expect(await f.draft()).toEqual(saved)
  await f.publish()
  const published = await f.draft()
  expect(published.flow.hasUnpublishedChanges).toBe(false)
  await f.services.flows.updateBuilderDraft({ ...input, expectedVersion: published.flow.draftVersion, choices: [{ id: choiceId, value: 'continue', label: 'Renamed choice' }] })
  expect((await f.draft()).flow.hasUnpublishedChanges).toBe(true)
  expect((await f.services.flows.listDashboard(f.scope.workspaceId)).find(item => item.id === f.flow.flowId)?.hasUnpublishedChanges).toBe(true)
  await f.publish()
  expect((await f.draft()).flow.hasUnpublishedChanges).toBe(false)
})

contract(['FLOW-004', 'FLOW-014'], 'duplicate labels refuse the whole content, choices and paths transaction with plain wording', async () => {
  const f = await foundationFixture('duplicate-labels')
  await f.add({ kind: 'question', questionType: 'short_text', prompt: 'Original prompt' })
  await f.add({ kind: 'completion', questionType: null, prompt: 'Done' })
  const before = await f.draft()
  const firstId = ulid()
  await expect(f.services.flows.updateBuilderDraft({ ...f.flow, expectedVersion: before.flow.draftVersion, stepId: before.steps[0].id, prompt: 'Changed prompt', helperText: 'Changed explanation', required: true, nextStepId: before.steps[1].id, questionType: 'single_choice', choices: [{ newId: firstId, value: 'first', label: 'Same' }, { newId: ulid(), value: 'second', label: ' SAME ' }], rules: [{ sourceStepId: before.steps[0].id, destinationStepId: before.steps[1].id, position: 0, predicateKind: 'equals', expectedValue: firstId }] })).rejects.toThrow('Each choice needs a different label.')
  expect(await f.draft()).toEqual(before)
})
