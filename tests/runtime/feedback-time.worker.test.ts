import { applyD1Migrations,env,type D1Migration } from 'cloudflare:test'
import { beforeAll,expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { analysisHttp } from './analysis-fixture'
import { when } from '../../src/core/features/analysis/ui/analysisApi'
declare const __PENCIL_CORE_MIGRATIONS__:D1Migration[]
beforeAll(()=>applyD1Migrations(env.DB,__PENCIL_CORE_MIGRATIONS__))
contract(['WS-001','ANLY-010'],'current workspace zone regroups historical AI days across DST and non-hour boundaries without changing frozen evidence or date-only answers',async()=>{
 const f=await analysisHttp({AI_ENABLED:'false'});await f.respond('Some text');const run=await f.request()
 const stamps=['2026-11-01T03:45:00.000Z','2026-11-01T05:30:00.000Z','2026-11-01T06:30:00.000Z','2026-11-01T18:20:00.000Z']
 for(const [i,stamp] of stamps.entries())await env.DB.prepare(`INSERT INTO analysis_calls(id,workspace_id,run_id,feature,provider,provider_origin,model,attempt,outcome,cost_source,day,created_at,input_tokens,output_tokens,cost_microusd) VALUES(?,?,?,'analysis','direct','https://example.test','model',?,'answered','not-reported','2000-01-01',?,?,?,?)`).bind(crypto.randomUUID(),f.workspaceId,run.id,i+1,stamp,i===0?null:10,i===0?null:20,i===0?null:100).run()
 const before=await f.detail(run.id)
 for(const [zone,counts] of [['America/New_York',[['2026-11-01',3],['2026-10-31',1]]],['Asia/Kathmandu',[['2026-11-02',1],['2026-11-01',3]]],['Australia/Adelaide',[['2026-11-02',1],['2026-11-01',3]]]] as const) {
  await f.services.workspace.updateSettings({workspaceId:f.workspaceId,timeZone:zone,sendingWindowStart:'09:00',sendingWindowEnd:'17:00'})
  const overview=await (await f.call('/api/app/analysis')).json() as any
  expect(overview.timeZone).toBe(zone);expect(overview.usage.map((r:any)=>[r.day,r.calls])).toEqual(counts)
  expect(overview.usage.reduce((n:number,r:any)=>n+(r.costMicrousd??0),0)).toBe(300);expect(overview.usage.reduce((n:number,r:any)=>n+r.unreportedCalls,0)).toBe(1)
  const detail=await f.detail(run.id);expect(detail.evidenceCutoff).toBe(before.evidenceCutoff);expect(detail.timeZone).toBe(zone)
  const expected=new Intl.DateTimeFormat(undefined,{timeZone:zone,day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(stamps[0]))
  expect(when(stamps[0],detail.timeZone)).toBe(expected)
 }
 expect((await env.DB.prepare('SELECT day FROM analysis_calls WHERE run_id=?').bind(run.id).all()).results.every(r=>r.day==='2000-01-01')).toBe(true)
})
