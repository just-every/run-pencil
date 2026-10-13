import { eraseResponseAndImportCustody } from '../../src/core/features/importing/erasure'
import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { foundationFixture } from './foundation-fixture'
import { FlowService } from '../../src/core/features/flows/service'
import { FlowRepository } from '../../src/core/features/flows/repository'
import { ResponseRepository } from '../../src/core/features/responses/repository'
import { createPencilPlatform } from '../../src/core/platform/runtime'
import { defaultFlowPolicies } from '../../src/core/shared/flowPolicies'

declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(() => applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__))

contract(['FLOW-006', 'FLOW-013', 'FLOW-016'], 'publication rejects impossible screens without writing a revision, remains editable, and validates the policy actually published', async () => {
  const f = await foundationFixture('semantic-publication')
  await f.add({ kind: 'question', questionType: 'rating', prompt: 'Rate the experience', required: true })
  await f.add({ kind: 'completion', questionType: null, prompt: 'First completion' })
  await f.add({ kind: 'completion', questionType: null, prompt: 'Alternate completion' })
  const draft = await f.draft(), [question, first, alternate] = draft.steps
  const rules = [
    { sourceStepId: question.id, predicateKind: 'greater_than_or_equal' as const, expectedValue: 3, destinationStepId: first.id, position: 0 },
    { sourceStepId: question.id, predicateKind: 'greater_than_or_equal' as const, expectedValue: 4, destinationStepId: alternate.id, position: 1 },
  ]
  await f.services.flows.replaceDraftBranchRules({ ...f.flow, expectedVersion: draft.flow.draftVersion, rules })
  const before = await f.draft()
  const revisions = () => env.DB.prepare('SELECT id, state, number FROM flow_revisions WHERE flow_id = ? ORDER BY number').bind(f.flow.flowId).all()
  const storedBefore = await revisions()
  await expect(f.publish()).rejects.toMatchObject({ details: expect.arrayContaining([expect.objectContaining({ stepId: alternate.id, reason: expect.stringContaining('reachable') })]) })
  expect((await revisions()).results).toEqual(storedBefore.results)
  expect(await f.draft()).toEqual(before)

  const platform = createPencilPlatform('http://localhost', env)
  const last = new FlowService(new FlowRepository(platform.database, env.DB), new ResponseRepository(platform.database, env.DB, eraseResponseAndImportCustody), { ...defaultFlowPolicies, 'flow.branch-selection.v1': 'last-matching-rule' })
  // This same authored graph is valid under last-match selection: 3 reaches
  // first, 4/5 reach alternate, and 1/2 use the default first completion.
  await last.publishDraft({ ...f.flow, expectedVersion: before.flow.draftVersion })
  const lastSession = await f.start()
  expect(lastSession.flow.branchSelection).toBe('last-matching-rule')
  await f.mature(lastSession.sessionId)
  expect(await f.final(lastSession, [{ stepId: question.id, value: 5 }])).toMatchObject({ completionStepId: alternate.id })

  // A normal builder edit gives the earlier-policy graph a real second path.
  await f.services.flows.replaceDraftBranchRules({ ...f.flow, expectedVersion: (await f.draft()).flow.draftVersion, rules: [...rules,
    { sourceStepId: question.id, predicateKind: 'equals', expectedValue: 2, destinationStepId: alternate.id, position: 2 },
  ] })
  await f.publish()
  const firstSession = await f.start(), alternateSession = await f.start()
  expect(firstSession.flow.branchSelection).toBe('first-matching-rule')
  await f.mature(firstSession.sessionId)
  await f.mature(alternateSession.sessionId)
  expect(await f.final(firstSession, [{ stepId: question.id, value: 5 }])).toMatchObject({ completionStepId: first.id })
  expect(await f.final(alternateSession, [{ stepId: question.id, value: 2 }])).toMatchObject({ completionStepId: alternate.id })
}, 60_000)
