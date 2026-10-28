import { applyD1Migrations, createScheduledController, env, SELF, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect, vi } from 'vitest'
import { contract } from '../../src/test/contract'
import worker from '../../src/core/app/worker'
import { analysisHttp, ai, answer, theme } from './analysis-fixture'
import { matureLoad } from './load-time-fixture'
import { devKeyHeaders } from '../helpers/dev-key.mjs'

declare const __PENCIL_CORE_MIGRATIONS__:D1Migration[]
beforeAll(()=>applyD1Migrations(env.DB,__PENCIL_CORE_MIGRATIONS__))
const day=86_400_000
const tick=(at:number)=>worker.scheduled(createScheduledController({scheduledTime:at,cron:'15 * * * *'}),env)

contract(["GOV-003","GOV-008","DATA-002","PART-002","BASE-DATA-002"],'owner opt-in gives old responses and private saves seven days of notice, hold preserves expiry, and release erases with DATA-002 effects',async()=>{
  vi.useFakeTimers({toFake:['Date']})
  try {
    const now=Date.now(),f=await analysisHttp(),other=await analysisHttp({AI_ENABLED:'false'})
    await env.DB.prepare('UPDATE oa_sessions SET expires_at=?').bind(Date.parse('2099-01-01T00:00:00.000Z')).run()
    const path=`/api/app/flows/${f.flowId}/retention`
    const current=async()=>{const r=await f.call(path);expect(r.status).toBe(200);return r.json() as Promise<any>}
    const set=async(days:number|null,legalHold=false)=>{
      const r=await f.call(path,{days,legalHold,version:(await current()).version,confirmAutomaticDeletion:days!==null && !legalHold},'PUT')
      expect(r.status,await r.clone().text()).toBe(200);return r.json() as Promise<any>
    }
    expect((await SELF.fetch(`http://localhost${path}`,{headers:{Host:'localhost',Origin:'http://localhost',...devKeyHeaders}})).status).toBe(401)
    expect((await other.call(path)).status).toBe(404)
    expect((await f.call(path,{days:30,legalHold:false,version:0,confirmAutomaticDeletion:false},'PUT')).status).toBe(403)
    expect((await current()).days).toBeNull()
    await env.DB.prepare("UPDATE oa_operators SET role='member' WHERE id=?").bind(f.operatorId).run()
    await env.DB.prepare('UPDATE oa_sessions SET operator_version=(SELECT version FROM oa_operators WHERE id=operator_id) WHERE operator_id=?').bind(f.operatorId).run()
    expect((await f.call(path)).status).toBe(403)
    expect((await f.call(path,{days:null,legalHold:true,version:0,confirmAutomaticDeletion:false},'PUT')).status).toBe(403)
    await env.DB.prepare("UPDATE oa_operators SET role='owner' WHERE id=?").bind(f.operatorId).run()
    await env.DB.prepare('UPDATE oa_sessions SET operator_version=(SELECT version FROM oa_operators WHERE id=operator_id) WHERE operator_id=?').bind(f.operatorId).run()
    const ids:string[]=[]
    const start=async()=>{const r=await f.call(`/api/public/flows/${f.slug}/sessions`,{deviceClass:'desktop',source:'direct'});expect(r.status).toBe(201);return r.json() as Promise<any>}
    for(let i=0;i<6;i++){
      const session=await start();if(i<5)await matureLoad(session)
      const submitted=await f.call(`/api/public/flows/${f.slug}/responses`,{...session,idempotencyKey:crypto.randomUUID(),answers:[{stepId:f.questions.improve,value:`Private retention story ${i}`} ]})
      expect(submitted.status,await submitted.clone().text()).toBe(201)
      ids.push((await submitted.json() as {responseId:string}).responseId)
    }
    const old=new Date(now-40*day).toISOString()
    await env.DB.prepare('UPDATE responses SET completed_at=? WHERE flow_id=?').bind(old,f.flowId).run()
    await ai.reset();await ai.script(answer({outcome:'findings',reason:'',themes:[theme('Private stories',ids.slice(0,5),[{responseId:ids[0],questionId:f.questions.improve,start:0,end:7,text:'Private'}])],recommendations:[]}))
    const analysis=await f.request();expect(analysis.state,JSON.stringify(analysis)).toBe('completed')
    const saved=await start()
    const save=await f.call(`/api/public/flows/${f.slug}/sessions/save`,{sessionId:saved.sessionId,sessionToken:saved.sessionToken,commandKey:crypto.randomUUID(),email:'retention-save@example.test',currentStepId:f.questions.name,answers:[{stepId:f.questions.improve,value:'Private unfinished retention story'}]})
    expect(save.status,await save.clone().text()).toBe(200)
    await env.DB.prepare('UPDATE respondent_saves SET created_at=?,expires_at=? WHERE session_id=?').bind(old,old,saved.sessionId).run()
    await env.DB.prepare('UPDATE respondent_sessions SET expires_at=? WHERE id=?').bind(old,saved.sessionId).run()
    const kept=await other.respond('No automatic deletion without a schedule')
    await env.DB.prepare('UPDATE responses SET completed_at=? WHERE id=?').bind(old,kept).run()
    expect(await env.DB.prepare('SELECT count(*) n FROM responses WHERE flow_id=?').bind(f.flowId).first()).toEqual({n:6})
    expect((await env.DB.prepare('SELECT device_class FROM responses WHERE flow_id=?').bind(f.flowId).all()).results).toEqual(ids.map(()=>({device_class:'desktop'})))
    const enabled=await set(30)
    expect(enabled.notices).toMatchObject({responses:6,saves:1})
    expect(Date.parse(enabled.notices.earliestDeletion)).toBeGreaterThanOrEqual(now+7*day)
    expect((await f.call(path,{days:1,legalHold:false,version:0,confirmAutomaticDeletion:true},'PUT')).status).toBe(409)
    const importInput={definition:JSON.stringify({title:'Retention custody',fields:[{ref:'notes',type:'long_text',title:'Notes'}]}),csv:'Notes,Submit Date\nImported retention private story,2026-01-01 10:03:00\n',plannedAt:new Date(now).toISOString()}
    const reviewed=await f.call('/api/app/imports/review',importInput);expect(reviewed.status).toBe(200)
    const review=await reviewed.json() as {fingerprint:string;flowId:string}
    const committed=await f.call('/api/app/imports/commit',{...importInput,fingerprint:review.fingerprint,acknowledged:true});expect(committed.status).toBe(200)
    let job=await committed.json() as {id:string;state:string}
    while(job.state!=='completed'){const r=await f.call(`/api/app/imports/${job.id}/resume`,{});expect(r.status).toBe(200);job=await r.json() as typeof job}
    const importPolicy=await f.call(`/api/app/flows/${review.flowId}/retention`,{days:30,legalHold:false,version:0,confirmAutomaticDeletion:true},'PUT');expect(importPolicy.status,await importPolicy.clone().text()).toBe(200)
    await tick(now+6*day)
    expect(await env.DB.prepare('SELECT count(*) n FROM responses WHERE flow_id=?').bind(f.flowId).first()).toEqual({n:6})
    await set(30,true)
    const manual=await start();await matureLoad(manual)
    const manualResult=await f.call(`/api/public/flows/${f.slug}/responses`,{...manual,idempotencyKey:crypto.randomUUID(),answers:[{stepId:f.questions.improve,value:'Explicit erasure remains available under hold'}]})
    expect(manualResult.status).toBe(201)
    const manualId=(await manualResult.json() as {responseId:string}).responseId
    expect(await env.DB.prepare('SELECT device_class FROM responses WHERE id=?').bind(manualId).first()).toEqual({device_class:'desktop'})
    expect((await f.call(`/api/app/responses/${manualId}`,undefined,'DELETE')).status).toBe(204)
    expect(await env.DB.prepare('SELECT device_class FROM responses WHERE id=?').bind(manualId).first()).toBeNull()
    await tick(now+60*day)
    expect(await env.DB.prepare('SELECT count(*) n FROM responses WHERE flow_id=?').bind(review.flowId).first()).toEqual({n:0})
    expect(await env.DB.prepare('SELECT count(*) n FROM ik_d1_erasure_journal WHERE destination=?').bind(f.workspaceId).first<{n:number}>()).toMatchObject({n:1})
    expect(await env.DB.prepare('SELECT count(*) n FROM responses WHERE flow_id=?').bind(f.flowId).first()).toEqual({n:6})
    expect((await env.DB.prepare('SELECT device_class FROM responses WHERE flow_id=?').bind(f.flowId).all()).results).toEqual(ids.map(()=>({device_class:'desktop'})))
    expect(await env.DB.prepare('SELECT answers_json FROM respondent_saves WHERE session_id=?').bind(saved.sessionId).first()).not.toBeNull()
    expect(await env.DB.prepare('SELECT id FROM respondent_sessions WHERE id=?').bind(saved.sessionId).first()).not.toBeNull()
    vi.setSystemTime(now+60*day)
    const released=await set(30)
    expect(Date.parse(released.notices.earliestDeletion)).toBe(now+67*day)
    await tick(now+67*day-1)
    expect(await env.DB.prepare('SELECT id FROM responses WHERE id=?').bind(ids[0]).first()).not.toBeNull()
    await tick(now+67*day)
    await tick(now+67*day)
    expect(await env.DB.prepare('SELECT count(*) n FROM responses WHERE flow_id=?').bind(f.flowId).first()).toEqual({n:0})
    expect((await env.DB.prepare('SELECT device_class FROM responses WHERE id IN (SELECT value FROM json_each(?))').bind(JSON.stringify(ids)).all()).results).toEqual([])
    for(const table of ['response_answers','response_outbox'])expect(await env.DB.prepare(`SELECT count(*) n FROM ${table} WHERE response_id IN (SELECT value FROM json_each(?))`).bind(JSON.stringify(ids)).first()).toEqual({n:0})
    expect(await env.DB.prepare('SELECT session_id FROM respondent_saves WHERE session_id=?').bind(saved.sessionId).first()).toBeNull()
    expect(await env.DB.prepare('SELECT id FROM respondent_sessions WHERE id=?').bind(saved.sessionId).first()).toBeNull()
    expect(await env.DB.prepare('SELECT id FROM responses WHERE id=?').bind(kept).first()).not.toBeNull()
    const laterBackup = await f.call('/api/app/backup/export',{})
    expect(laterBackup.status).toBe(200)
    const laterArchive = await laterBackup.json() as {payload:{tables:Array<{name:string;rows:unknown[]}>}}
    const archivedResponses = JSON.stringify(laterArchive.payload.tables.find(table=>table.name==='responses')!.rows)
    for(const id of ids)expect(archivedResponses).not.toContain(id)
    expect(archivedResponses).toContain(kept)
    expect(await f.detail(analysis.id)).toMatchObject({redacted:true,stale:true,evidenceCount:0})
    expect(await env.DB.prepare('SELECT summary FROM analysis_runs WHERE id=?').bind(analysis.id).first()).toEqual({summary:null})
    for(const table of ['analysis_evidence','analysis_quotes','analysis_theme_members'])expect(await env.DB.prepare(`SELECT count(*) n FROM ${table} WHERE response_id IN (SELECT value FROM json_each(?))`).bind(JSON.stringify(ids)).first()).toEqual({n:0})
    expect((await (await f.call(`/api/app/flows/${f.flowId}/results`)).json() as any).completedResponses).toBe(0)
    expect(await env.DB.prepare("SELECT count(*) n FROM audit_entries WHERE workspace_id=? AND kind='retention.response-erased' AND actor_operator_id IS NULL AND subject_id IS NULL").bind(f.workspaceId).first()).toEqual({n:7})
    const mail=await env.DB.prepare('SELECT message FROM rer_mail_development_outbox').all()
    expect(JSON.stringify(mail.results)).not.toContain('retention-save@example.test')
  } finally {vi.useRealTimers()}
})
