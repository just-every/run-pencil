import { applyD1Migrations,env,type D1Migration } from 'cloudflare:test'
import { beforeAll,beforeEach,expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { ai,analysisHttp,answer } from './analysis-fixture'
declare const __PENCIL_CORE_MIGRATIONS__:D1Migration[]
beforeAll(()=>applyD1Migrations(env.DB,__PENCIL_CORE_MIGRATIONS__))
beforeEach(()=>ai.reset())
contract(['ANLY-009','ANLY-008','ANLY-010','BASE-INPUT-001'],'rewrite requests preserve the source and draft until explicit guarded acceptance, with real provider calls, failure and usage attribution',async()=>{
 const f=await analysisHttp(),other=await analysisHttp(),draft=async()=>await (await f.call(`/api/app/flows/${f.flowId}/draft`)).json() as any
 const original=await draft(),step=original.steps.find((s:any)=>s.kind==='question')
 const published=await env.DB.prepare('SELECT * FROM flow_steps WHERE revision_id=? ORDER BY id').bind(f.revisionId).all()
 const session=await f.services.responses.startPublicSession({slug:f.slug,deviceClass:'desktop',source:'direct',clientAddress:'rewrite-session'})
 const source={stepId:step.id,expectedVersion:original.flow.draftVersion,source:step.prompt,style:'sharper',context:'Ask about one recent visit.'}
 expect((await other.call(`/api/app/flows/${f.flowId}/rewrites`,source)).status).toBe(409)
 expect((await f.call(`/api/app/flows/${f.flowId}/rewrites`,{...source,style:'automatic-publish'})).status).toBe(400)
 expect((await f.call(`/api/app/flows/${f.flowId}/rewrites`,{...source,source:'wrong source'})).status).toBe(409)
 expect(await ai.requests()).toHaveLength(0)
 for(const style of ['sharper','broader','contextual']) {
  const unchanged=JSON.stringify(await draft())
  await ai.script(answer({proposal:`Proposed ${style} wording?`}))
  const response=await f.call(`/api/app/flows/${f.flowId}/rewrites`,{...source,style});expect(response.status).toBe(201)
  const proposal=await response.json() as any;expect(proposal).toMatchObject({source:step.prompt,state:'ready',proposal:`Proposed ${style} wording?`})
  expect(JSON.stringify(await draft())).toBe(unchanged)
  expect((await f.call(`/api/app/rewrites/${proposal.id}`)).status).toBe(200)
  expect((await other.call(`/api/app/rewrites/${proposal.id}`)).status).toBe(404)
  if(style==='sharper') {expect((await f.call(`/api/app/rewrites/${proposal.id}/decision`,{accept:false})).status).toBe(204);expect(JSON.stringify(await draft())).toBe(unchanged)}
  if(style==='broader') {
   const decisions=await Promise.all([f.call(`/api/app/rewrites/${proposal.id}/decision`,{accept:true}),f.call(`/api/app/rewrites/${proposal.id}/decision`,{accept:true})])
   expect(decisions.map(r=>r.status).sort()).toEqual([204,409])
   const changed=await draft();expect(changed.flow.draftVersion).toBe(original.flow.draftVersion+1);expect(changed.steps.find((s:any)=>s.id===step.id).prompt).toBe(proposal.proposal)
   expect(changed.steps.filter((s:any)=>s.id!==step.id)).toEqual(original.steps.filter((s:any)=>s.id!==step.id));expect(changed.choices).toEqual(original.choices);expect(changed.branchRules).toEqual(original.branchRules)
   // Return the draft through its actual save endpoint to exercise a later-version source conflict.
   expect((await f.call(`/api/app/flows/${f.flowId}/draft`,{stepId:step.id,expectedVersion:changed.flow.draftVersion,prompt:step.prompt,required:step.required},'PUT')).status).toBe(200)
   source.expectedVersion=(await draft()).flow.draftVersion
  }
  if(style==='contextual') {
   const before=await draft()
   expect((await f.call(`/api/app/flows/${f.flowId}/draft`,{stepId:step.id,expectedVersion:before.flow.draftVersion,prompt:'Another operator saved this',required:step.required},'PUT')).status).toBe(200)
   expect((await f.call(`/api/app/rewrites/${proposal.id}/decision`,{accept:true})).status).toBe(409)
   expect((await draft()).steps.find((s:any)=>s.id===step.id).prompt).toBe('Another operator saved this')
  }
 }
 expect((await env.DB.prepare('SELECT * FROM flow_steps WHERE revision_id=? ORDER BY id').bind(f.revisionId).all()).results).toEqual(published.results)
 expect(await env.DB.prepare('SELECT revision_id FROM respondent_sessions WHERE id=?').bind(session.sessionId).first()).toEqual({revision_id:f.revisionId})
 const current=await draft(),input={...source,expectedVersion:current.flow.draftVersion,source:current.steps.find((s:any)=>s.id===step.id).prompt}
 for(const script of [answer({proposal:'x',tool:'publish'}),{status:401,body:{}},{status:200,body:{output:[{type:'function_call',name:'publish'}],usage:{input_tokens:10,output_tokens:2}}}]) {
  await ai.script(script)
  const failed=await (await f.call(`/api/app/flows/${f.flowId}/rewrites`,input)).json() as any
  expect(failed).toMatchObject({state:'failed',proposal:null});expect(JSON.stringify(await draft())).toBe(JSON.stringify(current))
 }
 const calls=await env.DB.prepare('SELECT feature,draft_id AS draftId,input_tokens AS inputTokens,cost_microusd AS cost FROM draft_ai_calls WHERE workspace_id=?').bind(f.workspaceId).all()
 expect(calls.results).toHaveLength(6);expect(calls.results.every(c=>c.feature==='draft-rewrite'&&c.draftId===original.revision.id)).toBe(true)
 expect(calls.results[0]).toMatchObject({inputTokens:1200,cost:null})
 const sent=await ai.requests();expect(sent).toHaveLength(6);expect(sent.every(s=>!JSON.parse(s.body).tools)).toBe(true)
 const off=await analysisHttp({AI_ENABLED:'false'}),offDraft=await off.services.flows.getBuilderDraft(off.workspaceId,off.flowId),offStep=offDraft.steps.find(s=>s.kind==='question')!
 const unavailable=await (await off.call(`/api/app/flows/${off.flowId}/rewrites`,{...source,expectedVersion:offDraft.flow.draftVersion,stepId:offStep.id,source:offStep.prompt})).json() as any
 expect(unavailable).toMatchObject({state:'failed',proposal:null});expect(await ai.requests()).toHaveLength(6)
})
