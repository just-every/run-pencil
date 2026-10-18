import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { foundationFixture } from './foundation-fixture'
import { interpolateAnswerRecall } from '../../src/core/shared/answerRecall'

declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(() => applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__))
contract('LOGIC-001', 'published recall validates references, stays on the taken path and survives duplication without changing stored answers', async () => {
  const f=await foundationFixture('answer-recall')
  await f.add({kind:'question',questionType:'yes_no',prompt:'Tell us your name?',required:true})
  await f.add({kind:'question',questionType:'short_text',prompt:'Your name',required:true})
  await f.add({kind:'question',questionType:'single_choice',prompt:'Preferred service',required:true,choices:[{value:'appointments',label:'Appointments'},{value:'delivery',label:'Delivery'}]})
  await f.add({kind:'completion',questionType:null,prompt:'Thank you'})
  let d=await f.draft(); const [gate,name,service,done]=d.steps
  const save=async(stepId:string,prompt:string,extra={})=>f.services.flows.updateBuilderDraft({...f.flow,expectedVersion:(await f.draft()).flow.draftVersion,stepId,prompt,required:true,...extra})
  await save(service.id,`How can we help {{${name.id}}}?`,{helperText:`Earlier: {{${name.id}}}`,choices:d.choices.map(c=>({id:c.id,value:c.value,label:`${c.label} for {{${name.id}}}`}))})
  await save(done.id,`Thank you {{${name.id}}}: {{${service.id}}}`)
  await f.services.flows.replaceDraftBranchRules({...f.flow,expectedVersion:(await f.draft()).flow.draftVersion,rules:[{sourceStepId:gate.id,predicateKind:'equals',expectedValue:false,destinationStepId:service.id,position:0}]})
  for(const [destination,prompt] of [[gate.id,`Future {{${name.id}}}`],[service.id,'Missing {{deleted-question}}'],[service.id,`Current {{${service.id}}}`]] as const) {
    const before=(await f.draft()).steps.find(s=>s.id===destination)!
    await save(destination,prompt)
    await expect(f.publish()).rejects.toMatchObject({details:expect.arrayContaining([expect.objectContaining({stepId:destination,reason:expect.stringContaining('Recall reference')})])})
    await save(destination,before.prompt)
  }
  await f.publish()
  const response=await f.SELF.fetch(`http://localhost/api/public/flows/${f.slug}`,{headers:{'CF-Connecting-IP':'198.18.244.88'}})
  expect(response.status).toBe(200)
  const flow=await response.json() as import('../../src/core/app/api').PublicFlow
  const answers={[gate.id]:true,[name.id]:'<script>alert(1)</script>',[service.id]:d.choices[0].id}
  expect(interpolateAnswerRecall(flow.steps.find(s=>s.id===service.id)!.prompt,flow,answers,service.id)).toBe('How can we help <script>alert(1)</script>?')
  expect(interpolateAnswerRecall(`{{${name.id}}}`,flow,{...answers,[name.id]:`{{${gate.id}}}`},service.id)).toBe(`{{${gate.id}}}`)
  expect(interpolateAnswerRecall(`{{${name.id}}}`,flow,{...answers,[gate.id]:false},service.id)).toBe('')
  const session=await f.start(); await f.mature(session.sessionId)
  await f.final(session,[{stepId:gate.id,value:true},{stepId:name.id,value:'Jo'},{stepId:service.id,value:d.choices[0].id}])
  const ledger=await f.services.reporting.ledger(f.scope.workspaceId,f.flow.flowId,{})
  expect(ledger.responses[0].answers.find(a=>a.stepId===name.id)?.value).toBe('Jo')
  const copy=await f.services.flows.duplicateFlow({...f.flow,title:'Copied recall',slug:'copied-recall'})
  d=await f.services.flows.getBuilderDraft(f.scope.workspaceId,copy.id)
  expect(d.steps.find(s=>s.position===2)?.prompt).toBe(`How can we help {{${d.steps[1].id}}}?`)
  await f.services.flows.publishDraft({workspaceId:f.scope.workspaceId,flowId:copy.id,expectedVersion:d.flow.draftVersion})
})
