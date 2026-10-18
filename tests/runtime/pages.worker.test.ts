import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { foundationFixture } from './foundation-fixture'
import { fixtureExport } from '../helpers/report-download'
import { validateSavedAnswers } from '../../src/core/features/resuming/answers'
import { FlowRepository } from '../../src/core/features/flows/repository'
import { createDatabase } from '../../src/core/platform/db/repository'
import { publicSteps } from '../../src/core/features/flows/serialization'
import { visiblePath } from '../../src/core/shared/flowPath'
import { responseScreens } from '../../src/core/shared/screenLayout'
declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(()=>applyD1Migrations(env.DB,__PENCIL_CORE_MIGRATIONS__))

contract('FIELD-008','collects conditional classic pages with server required-on-path, branching, revision pinning and saved page custody',async()=>{
  const f=await foundationFixture('client-intake-pages')
  for(const step of [
    {questionType:'yes_no',prompt:'Need installation?',required:true},
    {questionType:'short_text',prompt:'Installation address',required:true},
    {questionType:'number',prompt:'Number of locations',required:false},
    {questionType:'short_text',prompt:'Project name',required:true},
    {questionType:'email',prompt:'Work email',required:false},
    {questionType:'consent',prompt:'Confirm request',required:true,questionSettings:{statement:'Please contact me about this request.'}},
  ] as const) await f.add({kind:'question',...step})
  await f.add({kind:'completion',questionType:null,prompt:'Request received'})
  let draft=await f.draft();const [install,address,quantity,project,email,consent,done]=draft.steps
  for(const [head,tail,title] of [[install,quantity,'Services'],[project,email,'Project details'],[consent,consent,'Confirmation']] as const){
    await f.services.flows.updateScreen({...f.flow,stepId:head.id,expectedVersion:(await f.draft()).flow.draftVersion,layout:{kind:'page',title,questionIds:draft.steps.filter(step=>step.position>=head.position&&step.position<=tail.position).map(step=>step.id)}})
  }
  draft=await f.draft()
  await f.services.flows.updateBuilderDraft({...f.flow,expectedVersion:draft.flow.draftVersion,stepId:address.id,prompt:address.prompt,required:true,questionSettings:{showWhen:{kind:'test',stepId:install.id,operator:'equals',value:true}}})
  draft=await f.draft()
  await f.services.flows.updateBuilderDraft({...f.flow,expectedVersion:draft.flow.draftVersion,stepId:quantity.id,prompt:quantity.prompt,required:false,questionSettings:{showWhen:{kind:'test',stepId:install.id,operator:'equals',value:true}}})
  draft=await f.draft()
  await f.services.flows.replaceDraftBranchRules({...f.flow,expectedVersion:draft.flow.draftVersion,rules:[{sourceStepId:quantity.id,destinationStepId:consent.id,position:0,predicateKind:'equals',expectedValue:null,condition:{kind:'test',stepId:install.id,operator:'equals',value:false}}]})
  await f.publish()
  const hidden=await f.start();await f.mature(hidden.sessionId)
  const response=await f.final(hidden,[{stepId:install.id,value:false},{stepId:address.id,value:'Do not retain hidden data'},{stepId:project.id,value:'Also off path'},{stepId:consent.id,value:true}])
  expect(response).toMatchObject({completionStepId:done.id})
  const exported=await fixtureExport(env.DB,f.scope.workspaceId,f.flow.flowId,{})
  expect(JSON.stringify(exported)).not.toContain('Do not retain hidden data')
  expect(JSON.stringify(exported)).not.toContain('Also off path')
  const visible=await f.start();await f.mature(visible.sessionId)
  await expect(f.final(visible,[{stepId:install.id,value:true},{stepId:project.id,value:'Office relocation'},{stepId:consent.id,value:true}])).rejects.toThrow(/Installation address/)
  expect(await f.final(visible,[{stepId:install.id,value:true},{stepId:address.id,value:'45 Market Street'},{stepId:project.id,value:'Office relocation'},{stepId:consent.id,value:true}])).toMatchObject({completionStepId:done.id})
  const repository = new FlowRepository(createDatabase(env.DB),env.DB)
  const rawSteps=await repository.getSteps(visible.revisionId)
  const raw={steps:rawSteps,choices:await repository.getChoices(rawSteps.map(step=>step.id)),rules:await repository.getBranchRules(visible.revisionId)}
  const graph={steps:publicSteps(raw.steps),choices:[],branchRules:[]}
  expect(responseScreens(graph.steps,visiblePath(graph,{[install.id]:true})).map(screen=>screen.steps.length)).toEqual([3,2,1,1])
  expect(validateSavedAnswers(raw,null,install.id,[{stepId:install.id,value:true}])).toEqual([{stepId:install.id,value:true}])
  expect(()=>validateSavedAnswers(raw,null,project.id,[{stepId:install.id,value:true}])).toThrow(/required/)
  const copy=await f.services.flows.duplicateFlow({...f.flow,title:'Retail requests',slug:'retail-page-requests'})
  const copied=await f.services.flows.getBuilderDraft(f.scope.workspaceId,copy.id)
  expect(copied.steps[0].questionSettings?.screen).toMatchObject({questionIds:copied.steps.slice(0,3).map(step=>step.id)})
  await f.services.flows.publishDraft({...f.scope,flowId:copy.id,expectedVersion:copied.flow.draftVersion})
  const pinned=await f.start()
  draft=await f.draft()
  await f.services.flows.updateScreen({...f.flow,stepId:install.id,expectedVersion:draft.flow.draftVersion,layout:{kind:'page',title:'New services heading',questionIds:[install.id,address.id,quantity.id]}})
  expect((await f.services.flows.getPublicFlow(f.slug)).steps[0].questionSettings?.screen).toMatchObject({title:'Services'})
  await f.publish()
  expect((await f.services.flows.getPublicFlow(f.slug)).steps[0].questionSettings?.screen).toMatchObject({title:'New services heading'})
  await f.mature(pinned.sessionId)
  expect(await f.final(pinned,[{stepId:install.id,value:false},{stepId:consent.id,value:true}])).toMatchObject({completionStepId:done.id})
},60_000)

contract('FIELD-008','refuses broken visibility and screen membership before publication without replacing a revision',async()=>{
  const f=await foundationFixture('invalid-intake-pages')
  for(const prompt of ['Ready?','Reason','Later'])await f.add({kind:'question',questionType:'yes_no',prompt,required:true})
  await f.add({kind:'completion',questionType:null,prompt:'Done'})
  let draft=await f.draft();const [head,child,later]=draft.steps
  await f.services.flows.updateScreen({...f.flow,expectedVersion:draft.flow.draftVersion,stepId:head.id,layout:{kind:'page',title:'Intake',questionIds:[head.id,child.id]}})
  for(const stepId of [later.id,'deleted-question']){
    draft=await f.draft()
    await f.services.flows.updateBuilderDraft({...f.flow,expectedVersion:draft.flow.draftVersion,stepId:child.id,prompt:child.prompt,required:true,questionSettings:{showWhen:{kind:'test',stepId,operator:'equals',value:true}}})
    await expect(f.publish()).rejects.toMatchObject({details:expect.arrayContaining([expect.objectContaining({stepId:child.id,reason:expect.stringContaining('Visibility condition')})])})
  }
  draft=await f.draft()
  await expect(f.services.flows.updateScreen({...f.flow,expectedVersion:draft.flow.draftVersion,stepId:head.id,layout:{kind:'page',title:'Bad order',questionIds:[head.id,later.id]}})).rejects.toThrow(/consecutive/)
  expect((await f.draft()).revision.number).toBe(1)
})
