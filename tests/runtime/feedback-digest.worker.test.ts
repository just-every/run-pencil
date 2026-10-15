import { applyD1Migrations,env,type D1Migration } from 'cloudflare:test'
import { afterEach,beforeAll,expect,vi } from 'vitest'
import { contract } from '../../src/test/contract'
import { analysisHttp } from './analysis-fixture'
import { DigestDispatcher } from '../../src/core/features/notifications/digest-dispatcher'
import { baseMailSender } from '../../src/core/platform/mail/base.server'
import { digestCaptureClaim } from '../helpers/notification-digest-capture'
import { runScheduledMaintenance } from '../../src/core/app/maintenance'
import type { WorkerBindings } from '../../src/core/app/environment'
import { ResponseRepository } from '../../src/core/features/responses/repository'
import { eraseResponseAndImportCustody } from '../../src/core/features/importing/erasure'
declare const __PENCIL_CORE_MIGRATIONS__:D1Migration[]
beforeAll(()=>applyD1Migrations(env.DB,__PENCIL_CORE_MIGRATIONS__))
const owned:string[]=[]
afterEach(async()=>{vi.useRealTimers();vi.restoreAllMocks();for(const id of owned.splice(0))await env.DB.prepare('UPDATE digest_preferences SET enabled=0 WHERE flow_id=?').bind(id).run()})
const clock=(at:string)=>vi.setSystemTime(new Date(at))
const tick=()=>runScheduledMaintenance({scheduledTime:Date.now(),cron:'* * * * *',noRetry(){}} as ScheduledController,{...env,AI_ENABLED:'false',APP_ORIGIN:'http://localhost'} as WorkerBindings)
async function fixture(zone='UTC',start='09:00',end='17:00') {
 const f=await analysisHttp({AI_ENABLED:'false'});owned.push(f.flowId)
 await f.services.workspace.updateSettings({workspaceId:f.workspaceId,timeZone:zone,sendingWindowStart:start,sendingWindowEnd:end})
 await env.DB.prepare('UPDATE oa_sessions SET expires_at=? WHERE operator_id=?').bind(Date.now()+30*86400_000,f.operatorId).run()
 return f
}
const deliveries=(flowId:string)=>env.DB.prepare('SELECT * FROM digest_deliveries WHERE flow_id=? ORDER BY cutoff_end').bind(flowId).all<any>()
const members=(id:string)=>env.DB.prepare('SELECT response_id FROM digest_members WHERE delivery_id=? ORDER BY response_id').bind(id).all<{response_id:string}>()
contract(['NOTIFY-003','WS-001','WS-002','NOTIFY-004'],'Daily freezes independent local-day cohorts, catches missed openings without empty mail, preserves commit recipients and releases, and crosses DST, zone edits and overnight windows once',async()=>{
 vi.useFakeTimers({toFake:['Date']});clock('2026-10-31T12:00:00.000Z')
 const f=await fixture('America/New_York'),g=await fixture('Asia/Kathmandu','22:00','06:00')
 const old=await f.respond('Off historical answer')
 expect((await f.call(`/api/app/flows/${f.flowId}/notifications`,{mode:'daily'},'PUT')).status).toBe(200)
 await g.services.notifications.preferences.set(g.workspaceId,g.flowId,g.operatorId,'daily')
 const second=crypto.randomUUID();await env.DB.prepare('INSERT INTO operators(id,workspace_id,email,display_name,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(second,f.workspaceId,`${second}@example.test`,'Second',new Date().toISOString(),new Date().toISOString()).run()
 const first=await f.respond('Private selected answer'),held=await f.respond('Held answer',{quarantine:true}),independent=await g.respond('Other flow answer')
 await f.services.notifications.preferences.set(f.workspaceId,f.flowId,second,'daily')
 const snapshot=await env.DB.prepare('SELECT payload_json FROM response_outbox WHERE response_id=?').bind(first).first<{payload_json:string}>()
 expect(JSON.parse(snapshot!.payload_json).digestOperatorIds.map((r:any)=>r.operatorId)).toEqual([f.operatorId])
 const captures=async()=> (await env.DB.prepare("SELECT message FROM rer_mail_development_outbox WHERE json_extract(message,'$.headers.X-Pencil-Digest-Claim') IS NOT NULL").all<{message:string}>()).results.map(r=>JSON.parse(r.message))
 clock('2026-10-31T13:00:00.000Z');await Promise.all([tick(),tick()])
 const day1=(await deliveries(f.flowId)).results;expect(day1.map(r=>[r.operator_id,r.status]).sort()).toEqual([[f.operatorId,'sent'],[second,'empty']].sort())
 const sent1=day1.find(r=>r.operator_id===f.operatorId)!;expect((await members(sent1.id)).results).toEqual([{response_id:first}])
 expect((await captures()).filter(m=>m.deliveryId===sent1.idempotency_key)).toHaveLength(1)
 // Exactly the cutoff belongs to the next day. Release uses its release commit, never its original submitted time.
 const boundary=await f.respond('Boundary'), repo=new ResponseRepository(f.platform.database,env.DB,eraseResponseAndImportCustody)
 clock('2026-11-01T13:59:00.000Z');expect(await repo.releaseQuarantinedResponse({workspaceId:f.workspaceId,responseId:held,operatorId:f.operatorId,now:new Date().toISOString()})).toBe(true)
 // A request timestamp before an already frozen opening, but transaction committed afterwards, is still picked up once.
 const late=await f.respond('Committed after first opening')
 await env.DB.prepare('UPDATE response_outbox SET created_at=? WHERE response_id=?').bind('2026-10-31T12:59:59.000Z',late).run()
 clock('2026-11-02T14:00:00.000Z');await tick();await tick()
 const all=(await deliveries(f.flowId)).results,secondDay=all.find(r=>r.day==='2026-11-01'&&r.operator_id===f.operatorId)!
 expect(secondDay.cutoff_end).toBe('2026-11-01T14:00:00.000Z');expect(Date.parse(secondDay.cutoff_end)-Date.parse(secondDay.cutoff_start)).toBe(25*3600_000)
 expect((await members(secondDay.id)).results.map(r=>r.response_id).sort()).toEqual([boundary,held,late].sort())
 expect(all.filter(r=>r.day==='2026-11-02').every(r=>r.status==='empty')).toBe(true)
 expect((await env.DB.prepare('SELECT COUNT(*) n FROM digest_members WHERE response_id=?').bind(old).first())).toEqual({n:0})
 // The other flow's overnight window holds delivery until its current opening; its cohort is independent.
 clock('2026-11-02T16:15:00.000Z');await tick()
 expect((await env.DB.prepare('SELECT COUNT(*) n FROM digest_members WHERE response_id=?').bind(independent).first())).toEqual({n:1})
 const mail=await captures();expect(mail.length).toBeGreaterThan(1)
 for(const message of mail) {
  expect(message.headers['Auto-Submitted']).toBe('auto-generated');expect(message.from).toBe('no-reply@pencil.test')
  expect(JSON.stringify(message)).not.toMatch(/Private selected answer|Held answer|Boundary|Other flow answer|Committed after first opening/)
  expect(message.text).toContain('/results');expect(message.html).not.toMatch(/https?:[^" ]+\.(png|gif)|token=|session=/)
 }
 // A zone/window edit keeps the pending cutoff frozen and never reuses an already consumed local day.
 const frozen=await env.DB.prepare('SELECT next_opening FROM digest_preferences WHERE flow_id=? AND operator_id=?').bind(f.flowId,f.operatorId).first()
 await f.services.workspace.updateSettings({workspaceId:f.workspaceId,timeZone:'Asia/Kathmandu',sendingWindowStart:'22:00',sendingWindowEnd:'06:00'})
 expect(await env.DB.prepare('SELECT next_opening FROM digest_preferences WHERE flow_id=? AND operator_id=?').bind(f.flowId,f.operatorId).first()).toEqual(frozen)
 const changed=await f.respond('After zone change');clock('2026-11-04T16:15:00.000Z');await tick()
 expect((await env.DB.prepare('SELECT COUNT(*) n FROM digest_members WHERE response_id=? AND delivery_id IN(SELECT id FROM digest_deliveries WHERE operator_id=?)').bind(changed,f.operatorId).first())).toEqual({n:1})
})
contract(['NOTIFY-003','DIST-006','DATA-002','NOTIFY-004','BASE-OPS-005','BASE-DATA-003'],'digest retries retain their frozen day and key, unknown requires consent, erasure stops sends and retains anonymous audit facts, and local capture requires a live durable claim',async()=>{
 vi.useFakeTimers({toFake:['Date']});clock('2026-10-01T08:00:00.000Z')
 const f=await fixture();await f.services.notifications.preferences.set(f.workspaceId,f.flowId,f.operatorId,'daily');const response=await f.respond('Private retry answer')
 const send=vi.fn(async()=>({status:'rate_limited' as const,provider:'sendgrid',providerMessageId:null,code:'provider_rate_limited'}))
 const dispatcher=new DigestDispatcher(env.DB,{send},'https://forms.example.test','no-reply@example.test')
 for(const minutes of [0,1,5,15,30,60]) {clock(new Date(Date.parse('2026-10-01T09:00:00Z')+minutes*60_000).toISOString());await dispatcher.run()}
 expect(send).toHaveBeenCalledTimes(6)
 let row=(await deliveries(f.flowId)).results[0];expect(row).toMatchObject({status:'failed',attempts:6,day:'2026-10-01'})
 expect(new Set(send.mock.calls.map(c=>(c as unknown as [{deliveryId:string}])[0].deliveryId)).size).toBe(1)
 const cohort=(await members(row.id)).results
 await f.services.notifications.preferences.retry(f.workspaceId,f.operatorId,row.id,false)
 send.mockImplementation(async()=>{throw new Error('Unknown provider result')});await dispatcher.run();row=(await deliveries(f.flowId)).results[0];expect(row.status).toBe('unknown')
 clock('2026-10-02T09:00:00.000Z');await dispatcher.run();expect(send).toHaveBeenCalledTimes(7)
 await expect(f.services.notifications.preferences.retry(f.workspaceId,f.operatorId,row.id,false)).rejects.toThrow('duplicate')
 await f.services.notifications.preferences.retry(f.workspaceId,f.operatorId,row.id,true)
 // A subsequent rejection does not resolve an older unknown outcome.
 send.mockImplementation(async()=>({status:'rejected',provider:'sendgrid',providerMessageId:null,code:'provider_rejected'}) as never);await dispatcher.run()
 expect((await deliveries(f.flowId)).results[0].status).toBe('unknown');expect((await members(row.id)).results).toEqual(cohort)
 await f.services.notifications.preferences.retry(f.workspaceId,f.operatorId,row.id,true)
 clock('2026-10-02T18:00:00.000Z');await dispatcher.run();expect(send).toHaveBeenCalledTimes(8)
 await f.services.notifications.preferences.set(f.workspaceId,f.flowId,f.operatorId,'off');clock('2026-10-03T09:00:00.000Z');await dispatcher.run();expect(send).toHaveBeenCalledTimes(8)
 await f.services.responses.eraseReleasedResponse({workspaceId:f.workspaceId,operatorId:f.operatorId,responseId:response});expect((await members(row.id)).results).toEqual([])
 await f.services.notifications.preferences.set(f.workspaceId,f.flowId,f.operatorId,'daily');const erased=await f.respond('Erase before capture')
 const local=new DigestDispatcher(env.DB,baseMailSender({kind:'local-development'},env.DB,digestCaptureClaim),'http://localhost','no-reply@pencil.test',async workspaceId=>{
  await f.services.responses.eraseReleasedResponse({workspaceId,operatorId:f.operatorId,responseId:erased})
  return {businessName:'Saved brand',accentColor:'#123456'}
 })
 clock('2026-10-04T09:00:00.000Z');await local.run()
 const empty=(await deliveries(f.flowId)).results.find(r=>r.day==='2026-10-04')!;expect(empty.status).toBe('empty')
 expect(await env.DB.prepare("SELECT id FROM rer_mail_development_outbox WHERE json_extract(message,'$.deliveryId')=?").bind(empty.idempotency_key).first()).toBeNull()
 await expect(baseMailSender({kind:'local-development'},env.DB,digestCaptureClaim).send({deliveryId:empty.idempotency_key,from:'no-reply@pencil.test',to:[`${f.operatorId}@operators.example.test`],subject:'Synthetic forged',text:'No capture',headers:{'X-Pencil-Digest-Claim':'forged','X-Pencil-Digest-Attempt':'1','X-Pencil-Digest-Count':'1'}})).rejects.toThrow()
 expect((await env.DB.prepare("SELECT id FROM invitation_participants WHERE delivery_status='bounced'").all()).results).toEqual([])
 const audits=()=>env.DB.prepare("SELECT id,kind,actor_operator_id,subject_type,subject_id,details_json,created_at FROM audit_entries WHERE workspace_id=? AND kind='digest.delivery' ORDER BY created_at,id").bind(f.workspaceId).all<any>()
 const priorAudits=(await audits()).results
 expect(priorAudits.some(a=>JSON.parse(a.details_json).status==='failed')).toBe(true)
 expect(priorAudits.some(a=>JSON.parse(a.details_json).status==='unknown')).toBe(true)
 await f.respond('Private recipient-erasure answer')
 const peer=crypto.randomUUID(),at=new Date().toISOString()
 await env.DB.prepare('INSERT INTO operators(id,workspace_id,email,display_name,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(peer,f.workspaceId,`${peer}@example.test`,'Retained peer',at,at).run()
 const duringRemoval=new DigestDispatcher(env.DB,{async send(){
  await f.services.auth.removeOperator({workspaceId:f.workspaceId,actorOperatorId:peer,targetOperatorId:f.operatorId})
  return {status:'accepted',provider:'sendgrid',providerMessageId:'synthetic-private-provider-receipt',code:null}
 }},'https://forms.example.test','no-reply@example.test')
 clock('2026-10-05T09:00:00.000Z');await duringRemoval.run();await duringRemoval.run()
 expect((await f.call('/api/app/operators')).status).toBe(401)
 expect((await deliveries(f.flowId)).results).toEqual([])
 const retained=(await audits()).results
 expect(retained).toEqual([...priorAudits,expect.objectContaining({kind:'digest.delivery',actor_operator_id:null,subject_type:'digest',subject_id:null,details_json:JSON.stringify({status:'sent'}),created_at:new Date().toISOString()})])
 expect(retained.every(a=>a.actor_operator_id===null&&a.subject_id===null&&Object.keys(JSON.parse(a.details_json)).join()==='status')).toBe(true)
 expect(JSON.stringify(retained)).not.toMatch(/Private|operators\.example\.test|synthetic-private-provider-receipt/)
})
