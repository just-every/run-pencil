import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { foundationFixture } from './foundation-fixture'
import { startExport, exportPart } from '../../src/core/features/reporting/export'
import { fixtureExport } from '../helpers/report-download'
import { analysableQuestions, evidenceResponses } from '../../src/core/features/analysis/evidence'
import { FormImports, type ImportActor } from '../../src/core/features/importing/service'

declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(() => applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__))
contract('FIELD-010', 'Other write-ins and exclusive None survive native collection, branches, reports, search, exports and reviewed imports', async () => {
  const f = await foundationFixture('other-choices')
  for (const type of ['multiple_choice', 'single_choice', 'dropdown'] as const) await f.add({ kind: 'question', questionType: type, prompt: type, required: true, choices: [{ value:'a',label:'Alpha' },{value:'b',label:'Beta'},{value:'other',label:'Other'},...(type === 'multiple_choice' ? [{value:'none',label:'None of the above'}] : [])] })
  await f.add({kind:'completion',questionType:null,prompt:'Thank you'})
  let d = await f.draft()
  for (const step of d.steps.filter(step => step.kind === 'question')) {
    const choices = d.choices.filter(choice => choice.stepId === step.id)
    await f.services.flows.updateBuilderDraft({...f.flow,expectedVersion:(await f.draft()).flow.draftVersion,stepId:step.id,prompt:step.prompt,required:true,questionSettings:{otherChoiceId:choices[2].id,...(step.questionType === 'multiple_choice' ? {noneChoiceId:choices[3].id,minSelections:2,maxSelections:3} : {})}})
  }
  d = await f.draft()
  const [multi,single,dropdown,done] = d.steps, ids = (id:string) => d.choices.filter(choice => choice.stepId === id).map(choice => choice.id)
  await f.services.flows.replaceDraftBranchRules({...f.flow,expectedVersion:d.flow.draftVersion,rules:[{sourceStepId:multi.id,predicateKind:'any_of',expectedValue:[ids(multi.id)[3]],destinationStepId:done.id,position:0},{sourceStepId:single.id,predicateKind:'equals',expectedValue:ids(single.id)[2],destinationStepId:done.id,position:0}]})
  await f.publish()
  const session = await f.start(); await f.mature(session.sessionId)
  const submit = async (answers: Array<{stepId:string;value:unknown}>) => f.SELF.fetch(`http://localhost/api/public/flows/${f.slug}/responses`,{method:'POST',headers:{Origin:'http://localhost','Content-Type':'application/json','CF-Connecting-IP':'198.18.244.87'},body:JSON.stringify({...session,idempotencyKey:`key-${session.sessionId}`,answers})})
  for (const value of [{choiceIds:[ids(multi.id)[0],ids(multi.id)[2]],otherText:' '},[ids(multi.id)[0],ids(multi.id)[3]],{choiceIds:[ids(multi.id)[0],ids(multi.id)[2]],otherText:'x'.repeat(201)}]) {
    const response=await submit([{stepId:multi.id,value}]); expect(response.status).toBe(400)
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM responses WHERE flow_id=?').bind(f.flow.flowId).first()).toEqual({n:0})
  }
  const other={choiceIds:[ids(multi.id)[0],ids(multi.id)[2]],otherText:'Accessible appointments'}
  const singleOther={choiceIds:[ids(single.id)[2]],otherText:'Evening service'}
  const receipt=await submit([{stepId:multi.id,value:other},{stepId:single.id,value:singleOther}]); expect(receipt.status).toBe(201)
  const responseId=(await receipt.json() as {responseId:string}).responseId
  const noneSession=await f.start(); await f.mature(noneSession.sessionId)
  await f.final(noneSession,[{stepId:multi.id,value:[ids(multi.id)[3]]}])
  const dropdownSession=await f.start(); await f.mature(dropdownSession.sessionId)
  await f.final(dropdownSession,[{stepId:multi.id,value:[ids(multi.id)[0],ids(multi.id)[1]]},{stepId:single.id,value:ids(single.id)[0]},{stepId:dropdown.id,value:{choiceIds:[ids(dropdown.id)[2]],otherText:'Online'}}])
  const ledger=await f.services.reporting.ledger(f.scope.workspaceId,f.flow.flowId,{search:'appointments',answerStepId:multi.id,answerValue:ids(multi.id)[2]})
  expect(ledger.responses.map(row=>row.id)).toEqual([responseId]); expect(ledger.responses[0].answers[0].displayValue).toContain('Other: Accessible appointments')
  const exported=await fixtureExport(env.DB,f.scope.workspaceId,f.flow.flowId,{search:'appointments'})
  expect(exported.responses[0].answers[0].value).toEqual(other)
  const identity={workspaceId:f.scope.workspaceId,flowId:f.flow.flowId,sessionId:'test-export'}
  const start=await startExport(env.DB,'synthetic-export-secret',identity,{search:'appointments'},'csv')
  const part=await exportPart(env.DB,'synthetic-export-secret',identity,start.token,new AbortController().signal)
  const csv=await new Response(part.stream).text()
  expect(csv.split('\r\n')[0]).toContain(`${multi.id}.other_text`); expect(csv).toContain(other.otherText)
  const published=await env.DB.prepare("SELECT id FROM flow_revisions WHERE flow_id=? AND state='published'").bind(f.flow.flowId).first<{id:string}>()
  const report=await f.services.reporting.questions(f.scope.workspaceId,f.flow.flowId,published!.id)
  expect(report.find(q=>q.id===multi.id)?.distribution.map(bucket=>bucket.count)).toEqual([2,1,1,1])
  expect((await analysableQuestions(env.DB,published!.id)).map(q=>q.id)).toContain(multi.id)
  const run=await f.services.analysis.request(f.scope.workspaceId,f.operatorId,{flowId:f.flow.flowId,revisionId:published!.id,questionIds:[multi.id]})
  expect((await evidenceResponses(env.DB,run!,[multi.id])).find(row=>row.id===responseId)?.answers[multi.id]).toBe(other.otherText)
  const duplicate=await f.services.flows.duplicateFlow({...f.flow,title:'Copied',slug:'copied-other'})
  const copy=await f.services.flows.getBuilderDraft(f.scope.workspaceId,duplicate.id)
  for(const step of copy.steps.filter(s=>s.kind==='question')) expect(copy.choices.some(c=>c.stepId===step.id && c.id===step.questionSettings?.otherChoiceId)).toBe(true)
  await f.services.flows.publishDraft({workspaceId:f.scope.workspaceId,flowId:duplicate.id,expectedVersion:copy.flow.draftVersion})
  // Imported write-ins keep stable Other IDs and exact raw text under both supported sources.
  await env.DB.prepare("INSERT INTO oa_sessions(id,token_hash,operator_id,operator_version,kind,created_at,expires_at) VALUES('import-session','import-session',?,1,'native',?,?)").bind(f.operatorId,Date.now(),Date.now()+3600000).run()
  const actor:ImportActor={id:'import-session',workspaceId:f.scope.workspaceId,operatorId:f.operatorId}
  for(const source of ['typeform','google-forms'] as const) {
    const definition=JSON.stringify(source==='typeform'?{title:'Other import',fields:[{id:'pick',type:'multiple_choice',title:'Pick',properties:{choices:[{label:'Alpha'}],allow_other_choice:true},validations:{required:false}}]}:{formId:'other-google',info:{title:'Other import'},items:[{itemId:'i',title:'Pick',questionItem:{question:{questionId:'pick',choiceQuestion:{type:'RADIO',options:[{value:'Alpha'},{value:'Other',isOther:true}]}}}}]})
    const imports=new FormImports(env.DB,actor)
    const input={source,definition,csv:source==='typeform'?'Submit Date (UTC),Pick,Other\n2026-10-10T12:00:00Z,,false':'Timestamp,Pick\n10/10/2026 12:00:00,Evening service',...(source==='google-forms'?{google:{timeZone:'UTC',dateOrder:'MDY' as const}}:{})}
    const review=await imports.review(input); expect(review.rowErrors).toEqual([])
    let job=await imports.commit({...input,plannedAt:review.plannedAt,columns:review.columns},review.fingerprint,true)
    while(job.state!=='completed') job=await imports.resume(job.id)
    const answer=await env.DB.prepare('SELECT a.value_json FROM response_answers a JOIN responses r ON r.id=a.response_id WHERE r.flow_id=?').bind(review.flowId).first<{value_json:string}>()
    expect(JSON.parse(answer!.value_json)).toEqual({choiceIds:[review.questions.find(q=>q.kind==='question')!.settings.otherChoiceId],otherText:source==='typeform'?'false':'Evening service'})
  }
})
