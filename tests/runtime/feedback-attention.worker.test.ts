import { runScheduledMaintenance } from '../../src/core/app/maintenance'
import type { WorkerBindings } from '../../src/core/app/environment'
import { applyD1Migrations,env,type D1Migration } from 'cloudflare:test'
import { beforeAll,beforeEach,expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { ai,aiBindings,analysisHttp,answer,theme } from './analysis-fixture'
declare const __PENCIL_CORE_MIGRATIONS__:D1Migration[]
beforeAll(()=>applyD1Migrations(env.DB,__PENCIL_CORE_MIGRATIONS__))
beforeEach(()=>ai.reset())
contract(['NOTIFY-001','DASH-002'],'terminal attention is scoped and duplicate-safe across manual retries, autoruns, insufficient evidence and interruption; cards retain the latest actual revision and state',async()=>{
 const f=await analysisHttp(),other=await analysisHttp(), at=new Date().toISOString()
 const dashboard=async()=>await (await f.call('/api/app/dashboard')).json() as any[]
 const card=(await dashboard()).find(r=>r.id===f.flowId);expect(card.analysis).toBeNull()
 const inbox=async()=>await (await f.call('/api/app/analysis-attention')).json() as any
 const second=crypto.randomUUID(),muted=crypto.randomUUID(),inactive=crypto.randomUUID()
 for(const id of [second,muted,inactive])await env.DB.prepare('INSERT INTO operators(id,workspace_id,email,display_name,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(id,f.workspaceId,`${id}@example.test`,'Operator',at,at).run()
 await env.DB.prepare("UPDATE oa_operators SET status='inactive' WHERE id=(SELECT auth_id FROM operator_auth_links WHERE operator_id=?)").bind(inactive).run()
 await f.services.attention.mute(muted,true)
 expect((await f.call('/api/app/analysis-attention/preference',{muted:true},'PUT')).status).toBe(200)
 await f.respond('Only one response')
 const small=await f.request();expect(small.state).toBe('insufficient_evidence')
 expect((await dashboard()).find(r=>r.id===f.flowId).analysis).toMatchObject({id:small.id,state:'insufficient_evidence',revisionId:f.revisionId})
 expect((await inbox()).items).toMatchObject([{runId:small.id,state:'insufficient_evidence',readAt:null}])
 expect((await other.call(`/api/app/analysis-attention/${small.id}/read`,{},'PUT')).status).toBe(404)
 expect((await f.call(`/api/app/analysis-attention/${small.id}/read`,{},'PUT')).status).toBe(200)
 expect((await inbox()).items[0].readAt).toBeTruthy()
 const ids=[(await env.DB.prepare('SELECT id FROM responses WHERE flow_id=?').bind(f.flowId).first<{id:string}>())!.id]
 for(let i=0;i<4;i++)ids.push(await f.respond(`Response ${i}`))
 const queued=await f.request();expect(queued.state).toBe('queued');expect((await inbox()).items).toHaveLength(1)
 expect((await dashboard()).find(r=>r.id===f.flowId)).toMatchObject({completedResponses:5,analysis:{id:queued.id,state:'queued',revisionId:f.revisionId}})
 await env.DB.prepare("UPDATE analysis_runs SET state='running',lease_until=NULL WHERE id=?").bind(queued.id).run()
 expect((await dashboard()).find(r=>r.id===f.flowId).analysis.state).toBe('running')
 await runScheduledMaintenance({scheduledTime:Date.now(),cron:'* * * * *',noRetry(){}} as ScheduledController,{...env,...aiBindings,APP_ORIGIN:'http://localhost'} as WorkerBindings)
 expect((await inbox()).items.find((n:any)=>n.runId===queued.id).state).toBe('failed')
 await ai.script(answer({outcome:'findings',reason:'',themes:[theme('Feedback',ids)],recommendations:[]}))
 expect((await f.call(`/api/app/analysis/${queued.id}/retry`,undefined,'POST')).status).toBe(200)
 expect((await inbox()).items.filter((n:any)=>n.runId===queued.id)).toMatchObject([{state:'completed'}])
 const automatic=await f.services.analysis.request(f.workspaceId,null,{flowId:f.flowId,revisionId:f.revisionId},new Date(),'autorun')
 expect(automatic).toBeTruthy()
 // Exhaust a transport retry through the terminal interruption path, then replay its terminal update.
 await env.DB.prepare("UPDATE analysis_runs SET state='running',lease_until=NULL WHERE id=?").bind(automatic).run()
 await runScheduledMaintenance({scheduledTime:Date.now(),cron:'* * * * *',noRetry(){}} as ScheduledController,{...env,...aiBindings,APP_ORIGIN:'http://localhost'} as WorkerBindings)
 await env.DB.prepare("UPDATE analysis_runs SET state='failed' WHERE id=?").bind(automatic).run()
 expect((await env.DB.prepare('SELECT operator_id FROM analysis_attention WHERE run_id=?').bind(automatic).all()).results).toEqual([{operator_id:second}])
 expect((await dashboard()).find(r=>r.id===f.flowId)).toMatchObject({completedResponses:5,starts:5,audience:card.audience,analysis:{id:automatic,state:'failed',revisionId:f.revisionId}})
 expect((await (await other.call('/api/app/analysis-attention')).json() as any).items).toEqual([])
})
