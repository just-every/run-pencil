import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { foundationFixture } from './foundation-fixture'
import { fixtureExport } from '../helpers/report-download'
import { conditionTests, type Condition } from '../../src/core/shared/conditions'
declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(() => applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__))

contract(["LOGIC-006","LOGIC-008","LOGIC-009"], 'publishes correlated AND OR conditions, handles blank and negative operands and preserves immutable routing and copies', async () => {
  const f = await foundationFixture('enterprise-leads')
  await f.add({ kind: 'question', questionType: 'number', prompt: 'Company size', required: true })
  await f.add({ kind: 'question', questionType: 'single_choice', prompt: 'Your role', required: true, choices: ['Decision maker', 'Partner', 'Other'].map(label => ({ label, value: label })) })
  await f.add({ kind: 'question', questionType: 'short_text', prompt: 'Anything else?', required: false })
  for (const prompt of ['Book a consultation', 'We will be in touch', 'Request received']) await f.add({ kind: 'completion', questionType: null, prompt })
  let draft = await f.draft()
  const [size, role, comment, enterprise, ordinary, blank] = draft.steps
  const [decision, partner, other] = draft.choices
  const test = (stepId: string, operator: Extract<Condition,{kind:'test'}>['operator'], value?: import('../../src/core/shared/conditions').ConditionValue): Condition => ({ kind: 'test', stepId, operator, ...(value !== undefined ? { value } : {}) })
  const tree: Condition = { kind: 'group', join: 'or', conditions: [{ kind: 'group', join: 'and', conditions: [test(size.id, 'greater_than_or_equal', 50), test(role.id, 'not_equals', other.id)] }, test(role.id, 'equals', partner.id)] }
  await f.services.flows.updateBuilderDraft({ ...f.flow, expectedVersion: draft.flow.draftVersion, stepId: role.id, prompt: role.prompt, required: true, nextStepId: comment.id }); draft = await f.draft()
  await f.services.flows.updateBuilderDraft({ ...f.flow, expectedVersion: draft.flow.draftVersion, stepId: comment.id, prompt: comment.prompt, required: false, nextStepId: ordinary.id }); draft = await f.draft()
  const rules = [{ sourceStepId: role.id, destinationStepId: enterprise.id, position: 0, predicateKind: 'equals' as const, expectedValue: null, condition: tree }, { sourceStepId: comment.id, destinationStepId: blank.id, position: 0, predicateKind: 'equals' as const, expectedValue: null, condition: test(comment.id, 'is_blank') }]
  for (const condition of [test(comment.id, 'is_blank'), test('deleted-hidden-field', 'is_blank'), test(role.id, 'equals', 'missing-choice'), { kind: 'group', join: 'and', conditions: Array.from({length:21}, () => test(size.id, 'greater_than', 0)) } as Condition]) {
    await expect(f.services.flows.replaceDraftBranchRules({ ...f.flow, expectedVersion: draft.flow.draftVersion, rules: [{ ...rules[0], condition }] })).rejects.toMatchObject({ details: expect.arrayContaining([expect.objectContaining({ stepId: role.id, reason: expect.stringMatching(/branch/i) })]) })
    expect((await f.draft()).flow.draftVersion).toBe(draft.flow.draftVersion)
  }
  await f.services.flows.replaceDraftBranchRules({ ...f.flow, expectedVersion: draft.flow.draftVersion, rules })
  const preview = await f.services.flows.previewDraft({ ...f.flow, answers: { [size.id]: 100, [role.id]: decision.id } })
  expect(preview.screens.at(-1)?.stepId).toBe(enterprise.id)
  expect(preview.screens[1].evaluations[0].trace).toMatchObject({ matched: true, children: [{ matched: true, children: [{ value: 100, matched: true }, { value: decision.id, matched: true }] }, { matched: false }] })
  await f.publish()
  for (const [count, choice, text, end] of [[100, decision.id, undefined, enterprise.id], [100, other.id, 'Call next week', ordinary.id], [10, partner.id, undefined, enterprise.id], [10, other.id, undefined, blank.id]] as const) {
    const session = await f.start(); await f.mature(session.sessionId)
    const answers = [{ stepId: size.id, value: count }, { stepId: role.id, value: choice }, ...(text === undefined ? [] : [{ stepId: comment.id, value: text }])]
    const response = await f.SELF.fetch(`http://localhost/api/public/flows/${f.slug}/responses`, { method: 'POST', headers: { Origin: 'http://localhost', 'Content-Type': 'application/json', 'CF-Connecting-IP': '198.18.219.15' }, body: JSON.stringify({ sessionId: session.sessionId, sessionToken: session.sessionToken, loadTime: await f.loadTime(session), idempotencyKey: `condition-${session.sessionId}`, answers }) })
    expect(response.status, await response.clone().text()).toBe(201)
    expect(await response.json()).toMatchObject({ completionStepId: end })
  }
  const pinned = await f.start()
  draft = await f.draft()
  const revised: Condition = { kind:'group', join:'or', conditions:[{kind:'group',join:'and',conditions:[test(size.id,'greater_than_or_equal',200),test(role.id,'not_equals',other.id)]},test(role.id,'equals',partner.id)] }
  await f.services.flows.replaceDraftBranchRules({ ...f.flow, expectedVersion:draft.flow.draftVersion, rules:[{...rules[0],condition:revised},rules[1]] })
  await f.publish()
  const newVisitor = await f.start()
  for (const [session, end] of [[pinned,enterprise.id],[newVisitor,blank.id]] as const) {
    await f.mature(session.sessionId)
    expect(await f.final(session,[{stepId:size.id,value:100},{stepId:role.id,value:decision.id}])).toMatchObject({completionStepId:end})
  }
  draft = await f.draft()
  const template = await f.services.templates.save({ ...f.flow, operatorId:f.operatorId, name:'Consultation rules',source:'published',expectedVersion:draft.flow.draftVersion })
  const reused = await f.services.templates.create({ workspaceId:f.scope.workspaceId,templateId:template.id,title:'Renewal inquiries',slug:'renewal-conditional-inquiries' })
  const reusedDraft = await f.services.flows.getBuilderDraft(f.scope.workspaceId,reused.id)
  expect(conditionTests(reusedDraft.branchRules[0].condition!).every(test=>reusedDraft.steps.some(step=>step.id===test.stepId))).toBe(true)
  await f.services.flows.publishDraft({...f.scope,flowId:reused.id,expectedVersion:reusedDraft.flow.draftVersion})
  const copied = await f.services.flows.duplicateFlow({ ...f.flow, title: 'Partner inquiries', slug: 'partner-inquiries' })
  const copy = await f.services.flows.getBuilderDraft(f.scope.workspaceId, copied.id)
  expect(conditionTests(copy.branchRules[0].condition!).every(test => copy.steps.some(step => step.id === test.stepId))).toBe(true)
  expect(conditionTests(copy.branchRules[0].condition!).some(test => test.value === other.id || test.value === partner.id)).toBe(false)
  await f.services.flows.publishDraft({ ...f.scope, flowId: copied.id, expectedVersion: copy.flow.draftVersion })
  expect((await fixtureExport(env.DB, f.scope.workspaceId, f.flow.flowId, {})).responses).toHaveLength(6)
}, 60_000)

contract(["LOGIC-006","LOGIC-008","LOGIC-009","FLOW-013"], 'refuses destinations made impossible by constraints on an earlier question without publishing', async () => {
  const f = await foundationFixture('correlated-publication')
  await f.add({ kind: 'question', questionType: 'yes_no', prompt: 'Existing customer?', required: true })
  await f.add({ kind: 'question', questionType: 'yes_no', prompt: 'Renewal?', required: true })
  await f.add({ kind: 'completion', questionType: null, prompt: 'Continue' })
  await f.add({ kind: 'completion', questionType: null, prompt: 'Impossible customer' })
  let draft = await f.draft(); const [customer, renewal, done, impossible] = draft.steps
  await f.services.flows.updateBuilderDraft({ ...f.flow, expectedVersion: draft.flow.draftVersion, stepId: customer.id, prompt: customer.prompt, required: true, nextStepId: done.id }); draft = await f.draft()
  await f.services.flows.replaceDraftBranchRules({ ...f.flow, expectedVersion: draft.flow.draftVersion, rules: [
    { sourceStepId: customer.id, destinationStepId: renewal.id, position: 0, predicateKind: 'equals', expectedValue: null, condition: { kind: 'test', stepId: customer.id, operator: 'equals', value: true } },
    { sourceStepId: renewal.id, destinationStepId: impossible.id, position: 0, predicateKind: 'equals', expectedValue: null, condition: { kind: 'test', stepId: customer.id, operator: 'equals', value: false } },
  ] })
  await expect(f.publish()).rejects.toMatchObject({ details: expect.arrayContaining([expect.objectContaining({ stepId: impossible.id, reason: expect.stringContaining('reachable') })]) })
  expect((await f.draft()).revision.number).toBe(1)
  draft = await f.draft()
  const maximum: Condition = {kind:'group',join:'and',conditions:[{kind:'group',join:'or',conditions:[{kind:'group',join:'and',conditions:Array.from({length:20},()=>({kind:'test',stepId:customer.id,operator:'equals',value:true}))}]}]}
  await f.services.flows.replaceDraftBranchRules({...f.flow,expectedVersion:draft.flow.draftVersion,rules:[
    {sourceStepId:customer.id,destinationStepId:renewal.id,position:0,predicateKind:'equals',expectedValue:true},
    {sourceStepId:renewal.id,destinationStepId:impossible.id,position:0,predicateKind:'equals',expectedValue:null,condition:maximum},
  ]})
  await f.publish()
  const session = await f.start(); await f.mature(session.sessionId)
  expect(await f.final(session,[{stepId:customer.id,value:true},{stepId:renewal.id,value:false}])).toMatchObject({completionStepId:impossible.id})

})
