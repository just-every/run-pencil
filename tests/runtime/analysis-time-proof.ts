import { env } from 'cloudflare:test'
import { expect } from 'vitest'
import { ai,answer,analysisHttp } from './analysis-fixture'

export async function verifyHistoricalUsageZones() {
 const f=await analysisHttp();await f.respond('Some text');const run=await f.request()
 const stamps=['2026-11-01T03:45:00.000Z','2026-11-01T05:30:00.000Z','2026-11-01T06:30:00.000Z','2026-11-01T18:20:00.000Z']
 for(const [i,stamp] of stamps.entries())await env.DB.prepare(`INSERT INTO analysis_calls(id,workspace_id,run_id,feature,provider,provider_origin,model,attempt,outcome,cost_source,day,created_at,input_tokens,output_tokens,cost_microusd) VALUES(?,?,?,'analysis','direct','https://example.test','model',?,'answered','not-reported','2000-01-01',?,?,?,?)`).bind(crypto.randomUUID(),f.workspaceId,run.id,i+1,stamp,i===0?null:10,i===0?null:20,i===0?null:100).run()
 const draft=await f.services.flows.getBuilderDraft(f.workspaceId,f.flowId),step=draft.steps.find(s=>s.kind==='question')!
 await ai.script(answer({proposal:'What would improve your next visit?'}))
 const rewrite=await f.call(`/api/app/flows/${f.flowId}/rewrites`,{stepId:step.id,source:step.prompt,expectedVersion:draft.flow.draftVersion,style:'sharper'})
 expect(rewrite.status).toBe(201)
 await env.DB.prepare('UPDATE draft_ai_calls SET created_at=? WHERE workspace_id=?').bind(stamps[0],f.workspaceId).run()
 const before=await f.detail(run.id)
 // ICU versions use different canonical spellings for Kathmandu/Katmandu.
 const nepalZone=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Kathmandu'}).resolvedOptions().timeZone
 for(const [zone,counts] of [['America/New_York',[['2026-11-01',3],['2026-10-31',1]]],[nepalZone,[['2026-11-02',1],['2026-11-01',3]]],['Australia/Adelaide',[['2026-11-02',1],['2026-11-01',3]]]] as const) {
  await f.services.workspace.updateSettings({workspaceId:f.workspaceId,timeZone:zone,sendingWindowStart:'09:00',sendingWindowEnd:'17:00'})
  const overview=await (await f.call('/api/app/analysis')).json() as any
  expect(overview.timeZone).toBe(zone);expect(overview.usage.filter((r:any)=>r.feature==='analysis').map((r:any)=>[r.day,r.calls])).toEqual(counts)
  expect(overview.usage.reduce((n:number,r:any)=>n+(r.costMicrousd??0),0)).toBe(300);expect(overview.usage.reduce((n:number,r:any)=>n+r.unreportedCalls,0)).toBe(2)
  expect(overview.usage.find((r:any)=>r.feature==='draft-rewrite')).toMatchObject({day:zone==='America/New_York'?'2026-10-31':'2026-11-01',calls:1,inputTokens:1200,outputTokens:300,unreportedCalls:1})
  const detail=await f.detail(run.id);expect(detail.evidenceCutoff).toBe(before.evidenceCutoff);expect(detail.timeZone).toBe(zone)

 }

}
