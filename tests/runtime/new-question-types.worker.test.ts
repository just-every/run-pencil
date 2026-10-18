import { contactScoresScenario } from './contact-scores-scenario'
import { fixtureExport } from '../helpers/report-download'
import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { foundationFixture } from './foundation-fixture'
declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(() => applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__))
const types = ['dropdown', 'yes_no', 'nps', 'number', 'date', 'consent'] as const
const settings = (type: typeof types[number]) => type === 'consent' ? { statement: 'I agree to the published statement.' } : type === 'number' ? { min: -2, max: 2, decimalPlaces: 2 } : type === 'date' ? { earliest: '2024-02-01', latest: '2024-03-01' } : type === 'nps' ? { lowLabel: 'Low', highLabel: 'High' } : {}
contract(['FLOW-003', 'FLOW-005', 'FLOW-019', 'RESP-003', 'LEDG-004', 'FIELD-013', 'FIELD-015', 'FIELD-016', 'FIELD-003', 'FIELD-004'], 'publishes, previews, submits, duplicates and losslessly exports each new type', async () => {
  for (const type of types) {
    const f = await foundationFixture(`new-type-${type.replaceAll('_', '-')}`)
    await f.add({ kind: 'question', questionType: type, prompt: type, required: true, questionSettings: settings(type), ...(type === 'dropdown' ? { choices: [{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }] } : {}) })
    await f.add({ kind: 'completion', questionType: null, prompt: 'Matched' })
    await f.add({ kind: 'completion', questionType: null, prompt: 'Default' })
    let draft = await f.draft()
    const unchanged = draft
    if (['number', 'date', 'consent', 'nps'].includes(type)) {
      await expect(f.services.flows.updateBuilderDraft({ ...f.flow, expectedVersion: draft.flow.draftVersion, stepId: draft.steps[0].id, prompt: type, required: true, questionSettings: type === 'number' ? { min: '0' } : type === 'date' ? { earliest: '2023-02-29' } : type === 'consent' ? { statement: false } : { lowLabel: false } })).rejects.toThrow('settings')
      expect(await f.draft()).toEqual(unchanged)
    }
    const q = draft.steps[0], value = type === 'dropdown' ? draft.choices[0].id : type === 'yes_no' ? false : type === 'consent' ? true : type === 'date' ? '2024-02-29' : type === 'number' ? -1.25 : 0
    await f.services.flows.updateBuilderDraft({ ...f.flow, expectedVersion: draft.flow.draftVersion, stepId: q.id, prompt: q.prompt, required: true, nextStepId: draft.steps[2].id })
    draft = await f.draft()
    await f.services.flows.replaceDraftBranchRules({ ...f.flow, expectedVersion: draft.flow.draftVersion, rules: [{ sourceStepId: q.id, predicateKind: type === 'nps' ? 'less_than_or_equal' : type === 'number' || type === 'date' ? 'less_than' : 'equals', expectedValue: type === 'number' ? 0 : type === 'date' ? '2024-03-01' : value, destinationStepId: draft.steps[1].id, position: 0 }] })
    const preview = await f.services.flows.previewDraft({ ...f.flow, answers: { [q.id]: value } })
    expect(preview.complete).toBe(true); expect(preview.screens[0].selectedRuleId).not.toBeNull()
    // Required consent has only one valid value, so its unreachable alternate is removed.
    if (type === 'consent') { draft = await f.draft(); await f.services.flows.deleteDraftStep({ ...f.flow, expectedVersion: draft.flow.draftVersion, stepId: draft.steps[2].id }); draft = await f.draft(); await f.services.flows.updateBuilderDraft({ ...f.flow, expectedVersion: draft.flow.draftVersion, stepId: q.id, prompt: q.prompt, required: true, nextStepId: draft.steps[1].id }) }
    await f.publish()
    const session = await f.start(); await f.mature(session.sessionId)
    await expect(f.final(session, [{ stepId: q.id, value: type === 'yes_no' ? 'false' : type === 'consent' ? false : type === 'date' ? '2023-02-29' : type === 'dropdown' ? 'unknown' : 11.5 }])).rejects.toThrow()
    const response = await f.SELF.fetch(`http://localhost/api/public/flows/${f.slug}/responses`, { method: 'POST', headers: { Origin: 'http://localhost', 'Content-Type': 'application/json', 'CF-Connecting-IP': '198.18.244.23' }, body: JSON.stringify({ sessionId: session.sessionId, sessionToken: session.sessionToken, loadTime: await f.loadTime(session), idempotencyKey: `key-${session.sessionId}`, answers: [{ stepId: q.id, value }] }) })
    expect(response.status).toBe(201)
    const receipt = await response.json() as { responseId: string }
    const retried = await f.final(session, [{ stepId: q.id, value: 'changed retry input' }])
    expect(retried).toMatchObject({ responseId: receipt.responseId, idempotent: true, completionStepId: draft.steps[1].id })
    const exported = await fixtureExport(env.DB, f.scope.workspaceId, f.flow.flowId, {})
    expect(exported.responses).toHaveLength(1); expect(exported.responses[0].id).toBe(receipt.responseId)
    expect(exported.responses[0].answers[0].value).toEqual(type === 'consent' ? { accepted: true, statement: settings(type).statement } : type === 'dropdown' ? 'a' : value)
    expect(JSON.parse(JSON.stringify(exported))).toEqual(exported)
    if (type === 'consent') { const editable = await f.draft(); await f.services.flows.updateBuilderDraft({ ...f.flow, expectedVersion: editable.flow.draftVersion, stepId: q.id, prompt: type, required: true, questionSettings: { statement: 'A later draft statement.' } }); expect((await fixtureExport(env.DB, f.scope.workspaceId, f.flow.flowId, {})).responses[0].answers[0].value).toEqual({ accepted: true, statement: 'I agree to the published statement.' }) }
    if (type === 'nps') { const endpoint = await f.start(); await f.mature(endpoint.sessionId); await f.final(endpoint, [{ stepId: q.id, value: 10 }]); expect((await fixtureExport(env.DB, f.scope.workspaceId, f.flow.flowId, {})).responses.map(row => row.answers[0].value).sort()).toEqual([0, 10]) }
    const copy = await f.services.flows.duplicateFlow({ ...f.flow, title: 'Copy', slug: `new-type-${type.replaceAll('_', '-')}-copy` })
    const copied = await f.services.flows.getBuilderDraft(f.scope.workspaceId, copy.id)
    const original = await f.draft()
    expect(copied.steps.every(step => !original.steps.some(old => old.id === step.id))).toBe(true)
    expect(copied.steps[0].questionSettings).toEqual(original.steps[0].questionSettings)
    expect(copied.choices.every(choice => !original.choices.some(old => old.id === choice.id))).toBe(true)
    if (type === 'dropdown') { expect(copied.branchRules[0].expectedValue).toBe(copied.choices[0].id); expect(copied.branchRules[0].expectedValue).not.toBe(value) }
    expect(copied.branchRules.every(rule => copied.steps.some(step => step.id === rule.sourceStepId) && copied.steps.some(step => step.id === rule.destinationStepId))).toBe(true)
  }
  const f = await foundationFixture('question-precision')
  const textSettings = { minLength:3, maxLength:10, inputMask:'###-####', validationMessage:'Enter your seven-digit reference.' }
  const dateSettings = { displayFormat:'DD/MM/YYYY', separator:'.' }
  const scaleSettings = { min:0, max:6, lowLabel:'Not at all', middleLabel:'Neutral', highLabel:'Completely' }
  await f.add({kind:'question',questionType:'short_text',prompt:'Reference',required:true,questionSettings:textSettings})
  await f.add({kind:'question',questionType:'date',prompt:'Visit date',required:true,questionSettings:dateSettings})
  await f.add({kind:'question',questionType:'rating',prompt:'Confidence',required:true,questionSettings:scaleSettings})
  await f.add({kind:'completion',questionType:null,prompt:'Let us help'})
  await f.add({kind:'completion',questionType:null,prompt:'Thank you'})
  let draft = await f.draft()
  for (const invalid of [{min:0,max:0},{min:0,max:11},{min:0,max:6,lowLabel:'x'.repeat(101)}]) {
    await expect(f.services.flows.updateBuilderDraft({...f.flow,expectedVersion:draft.flow.draftVersion,stepId:draft.steps[2].id,prompt:'Confidence',required:true,questionSettings:invalid})).rejects.toThrow('settings')
  }
  await expect(f.services.flows.updateBuilderDraft({...f.flow,expectedVersion:draft.flow.draftVersion,stepId:draft.steps[0].id,prompt:'Reference',required:true,questionSettings:{pattern:'(a)\\1'}})).rejects.toThrow('settings')
  await f.services.flows.updateBuilderDraft({...f.flow,expectedVersion:draft.flow.draftVersion,stepId:draft.steps[2].id,prompt:'Confidence',required:true,nextStepId:draft.steps[4].id})
  draft = await f.draft()
  await f.services.flows.replaceDraftBranchRules({...f.flow,expectedVersion:draft.flow.draftVersion,rules:[{sourceStepId:draft.steps[2].id,predicateKind:'less_than',expectedValue:2,destinationStepId:draft.steps[3].id,position:0}]})
  await f.publish()
  const session = await f.start(); await f.mature(session.sessionId)
  const values = ['555-0100','2026-07-04',0]
  const answers = (set:unknown[]) => set.map((value,index)=>({stepId:draft.steps[index].id,value}))
  for (const invalid of ['12','12345678901','abc-defg']) await expect(f.final(session,answers([invalid,...values.slice(1)]))).rejects.toThrow('seven-digit')
  await expect(f.final(session,answers([values[0],'2026-02-30',0]))).rejects.toThrow('DD.MM.YYYY')
  const response = await f.SELF.fetch(`http://localhost/api/public/flows/${f.slug}/responses`,{method:'POST',headers:{Origin:'http://localhost','Content-Type':'application/json','CF-Connecting-IP':'198.18.244.24'},body:JSON.stringify({sessionId:session.sessionId,sessionToken:session.sessionToken,loadTime:await f.loadTime(session),idempotencyKey:`key-${session.sessionId}`,answers:answers(values)})})
  expect(response.status).toBe(201)
  expect(await response.json()).toMatchObject({completionStepId:draft.steps[3].id})
  const ledger = await f.services.reporting.ledger(f.scope.workspaceId,f.flow.flowId,{})
  expect(ledger.total).toBe(1)
  expect(ledger.responses[0].answers.map(answer=>answer.displayValue)).toEqual(['555-0100','04.07.2026','0'])
  const exported = await fixtureExport(env.DB,f.scope.workspaceId,f.flow.flowId,{})
  expect(exported.responses[0].answers.map(answer=>answer.value)).toEqual(values)
  const questions = await f.services.reporting.questions(f.scope.workspaceId,f.flow.flowId,ledger.responses[0].revisionId)
  expect(questions.find(question=>question.id===draft.steps[2].id)?.distribution).toEqual(Array.from({length:7},(_,value)=>({value,label:value===0?'0 · Not at all':value===3?'3 · Neutral':value===6?'6 · Completely':String(value),count:value===0?1:0})))

  await contactScoresScenario()

}, 60_000)
