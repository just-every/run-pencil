import { eraseResponseAndImportCustody } from '../../src/core/features/importing/erasure'
import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { foundationFixture } from './foundation-fixture'
import { createPencilPlatform } from '../../src/core/platform/runtime'
import { FlowRepository } from '../../src/core/features/flows/repository'
import { FlowService } from '../../src/core/features/flows/service'
import { ResponseRepository } from '../../src/core/features/responses/repository'
import { defaultFlowPolicies } from '../../src/core/shared/flowPolicies'
import { visiblePath } from '../../src/core/shared/flowPath'
declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(() => applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__))
contract(['FLOW-016','RESP-024'], 'publication freezes branch and review policies while prior sessions and receipts retain their original settings', async () => {
  const f = await foundationFixture('snapshot-policy')
  await f.add({ kind: 'question', questionType: 'rating', prompt: 'Rating', required: true })
  await f.add({ kind: 'completion', questionType: null, prompt: 'First matching completion' })
  await f.add({ kind: 'completion', questionType: null, prompt: 'Last matching completion' })
  const draft = await f.draft(), [question, first, last] = draft.steps
  await f.services.flows.replaceDraftBranchRules({ ...f.flow, expectedVersion: draft.flow.draftVersion, rules: [
    { sourceStepId: question.id, predicateKind: 'greater_than_or_equal', expectedValue: 3, destinationStepId: first.id, position: 0 },
    { sourceStepId: question.id, predicateKind: 'greater_than_or_equal', expectedValue: 4, destinationStepId: last.id, position: 1 },
    { sourceStepId: question.id, predicateKind: 'equals', expectedValue: 2, destinationStepId: last.id, position: 2 },
  ] })
  await f.publish()
  const original = await f.start()
  expect(original.flow.reviewBeforeSubmit).toBe(false)
  expect(visiblePath(original.flow, { [question.id]: 2 }).at(-1)!.id).toBe(last.id)
  const originalRow = await env.DB.prepare('SELECT policy_snapshot_json FROM flow_revisions WHERE id = ?').bind(original.revisionId).first<{ policy_snapshot_json: string }>()
  expect(JSON.parse(originalRow!.policy_snapshot_json)).toEqual(defaultFlowPolicies)
  const platform = createPencilPlatform('http://localhost', env)
  const changedPolicy = { ...defaultFlowPolicies, 'flow.branch-selection.v1': 'last-matching-rule' as const }
  const changed = new FlowService(new FlowRepository(platform.database, env.DB), new ResponseRepository(platform.database, env.DB, eraseResponseAndImportCustody), changedPolicy)
  const preview = await changed.previewDraft({ ...f.flow, answers: { [question.id]: 5 } })
  expect(preview.screens[0].nextStepId).toBe(last.id)
  const reviewDraft = await f.draft()
  await f.services.flows.updateFormSettings({...f.flow,expectedVersion:reviewDraft.flow.draftVersion,settings:{...reviewDraft.formSettings!,reviewBeforeSubmit:true}})
  await changed.publishDraft({ ...f.flow, expectedVersion: (await f.draft()).flow.draftVersion })
  const next = await f.start()
  expect(next.flow.reviewBeforeSubmit).toBe(true)
  expect(original.flow.reviewBeforeSubmit).toBe(false)
  expect(next.flow.branchSelection).toBe('last-matching-rule')
  expect(visiblePath(next.flow, { [question.id]: 5 }).at(-1)!.id).toBe(last.id)
  expect(visiblePath(next.flow, { [question.id]: 2 }).at(-1)!.id).toBe(last.id)
  await f.mature(original.sessionId); await f.mature(next.sessionId)
  expect(await f.final(original, [{ stepId: question.id, value: 5 }])).toMatchObject({ completionStepId: first.id })
  expect(await f.final(next, [{ stepId: question.id, value: 5 }])).toMatchObject({ completionStepId: last.id })
  expect(await f.final(original, [{ stepId: question.id, value: 1 }])).toMatchObject({ completionStepId: first.id, idempotent: true })
  expect(await env.DB.prepare('SELECT policy_snapshot_json FROM flow_revisions WHERE id = ?').bind(original.revisionId).first()).toEqual(originalRow)
}, 60_000)
