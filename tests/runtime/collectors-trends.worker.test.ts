import { matureLoad } from './load-time-fixture'
import { applyD1Migrations, env, SELF, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { developmentInbox } from '../helpers/mail-capture.mjs'
import { devKeyHeaders } from '../helpers/dev-key.mjs'
import type { BuilderDraft, Ledger, WorkspaceSettings } from '../../src/core/app/api'
import type { CollectorService } from '../../src/core/features/collectors'
import type { TrendReport } from '../../src/core/features/reporting'

declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
type Collector = Awaited<ReturnType<CollectorService['create']>>
type Session = { sessionId:string;sessionToken:string;loadTime:string;revisionId:string }
let cookie='',serial=0
const request=(path:string,data?:unknown,method=data===undefined?'GET':'POST')=>SELF.fetch('http://localhost'+path,{method,headers:{Host:'localhost',Origin:'http://localhost',cookie,'content-type':'application/json','CF-Connecting-IP':`198.18.203.${++serial%250}`},...(data===undefined?{}:{body:JSON.stringify(data)}),redirect:'manual'})
async function call<T>(path:string,data?:unknown,method?:string):Promise<T>{const response=await request(path,data,method);expect(response.ok,response.ok?path:`${path}: ${await response.text()}`).toBe(true);return response.status===204?undefined as T:response.json<T>()}
beforeAll(async()=>{
  await applyD1Migrations(env.DB,__PENCIL_CORE_MIGRATIONS__);await call('/health')
  const owner=await env.DB.prepare('SELECT email FROM operators ORDER BY created_at,id LIMIT 1').first<{email:string}>();expect(owner).not.toBeNull()
  await call('/auth/magic-link',{email:owner!.email});const inbox=await developmentInbox(path=>SELF.fetch('http://localhost'+path,{headers:{Host:'localhost',...devKeyHeaders}}),owner!.email)
  const login=await request('/auth/confirm',{token:inbox.messages[0].magicLinkToken});expect(login.status).toBe(303);cookie=login.headers.get('set-cookie')!.split(';')[0]
})
contract(['DIST-017','RSLT-007'],'named collectors enforce independent atomic limits and retain attribution in zoned, revision-marked score trends and exports',async()=>{
  const workspace=await call<WorkspaceSettings>('/api/app/workspace')
  await call('/api/app/workspace',{timeZone:'America/New_York',sendingWindowStart:workspace.sendingWindowStart,sendingWindowEnd:workspace.sendingWindowEnd},'PUT')
  const slug='northstar-collector-trends',flow=await call<{id:string}>('/api/app/flows',{title:'Northstar customer feedback',slug}),root=`/api/app/flows/${flow.id}`
  let draft=await call<BuilderDraft>(root+'/draft')
  await call(root+'/draft/steps',{expectedVersion:draft.flow.draftVersion,step:{kind:'question',questionType:'nps',required:true,prompt:'Would you recommend Northstar?'}})
  draft=await call<BuilderDraft>(root+'/draft');const stepId=draft.steps[0].id
  await call(root+'/draft/steps',{expectedVersion:draft.flow.draftVersion,step:{kind:'completion',questionType:null,prompt:'Thank you for helping us improve.'}})
  draft=await call<BuilderDraft>(root+'/draft');await call(root+'/publish',{expectedVersion:draft.flow.draftVersion})
  const a=await call<Collector>(root+'/collectors',{name:'July mailing',channel:'email',responseLimit:2}),b=await call<Collector>(root+'/collectors',{name:'Product feedback',channel:'embed',responseLimit:10,closeAt:'2026-12-01T17:00'})
  expect(b.deadlineAt).toBe('2026-12-01T22:00:00.000Z');expect(b.deadlineTimeZone).toBe('America/New_York')
  const start=async(collector:Collector)=>{const session=await call<Session>(`/api/public/flows/${slug}/sessions`,{source:collector.id===b.id?'embed':'direct',deviceClass:'desktop',collectorKey:collector.publicKey});await matureLoad(session);return session}
  const body=(session:Session,value:number)=>({...session,idempotencyKey:'collector-'+session.sessionId,answers:[{stepId,value}]})
  const dateResponse=async(id:string,time:string)=>{await env.DB.prepare('UPDATE responses SET started_at=?,completed_at=?,released_at=?,created_at=?,updated_at=? WHERE id=?').bind(new Date(Date.parse(time)-6000).toISOString(),time,time,time,time,id).run()}
  const sessions=await Promise.all([start(a),start(a),start(a)])
  const attempts=await Promise.all(sessions.map((session,index)=>request(`/api/public/flows/${slug}/responses`,body(session,index===0?10:6))))
  expect(attempts.map(response=>response.status).sort()).toEqual([201,201,409])
  const admitted:Array<{id:string;session:Session;value:number}>=[]
  for(const [index,response] of attempts.entries()){
    if(response.status===201){const receipt=await response.json<{responseId:string;disposition:string}>();expect(receipt.disposition).toBe('released');admitted.push({id:receipt.responseId,session:sessions[index],value:index===0?10:6})}
    else expect(await response.json()).toMatchObject({error:'COLLECTOR_CLOSED'})
  }
  // Give the real admitted responses a deterministic fixture calendar, including exact local midnight.
  await env.DB.prepare('UPDATE response_answers SET value_json=? WHERE response_id=?').bind('10',admitted[0].id).run();await env.DB.prepare('UPDATE response_answers SET value_json=? WHERE response_id=?').bind('6',admitted[1].id).run()
  await dateResponse(admitted[0].id,'2026-07-06T04:00:00.000Z');await dateResponse(admitted[1].id,'2026-07-06T04:02:00.000Z')
  expect((await request(`/api/public/flows/${slug}/sessions`,{source:'direct',deviceClass:'desktop',collectorKey:a.publicKey})).status).toBe(409)
  const retry=await call<{responseId:string;idempotent:boolean}>(`/api/public/flows/${slug}/responses`,body(admitted[0].session,0));expect(retry).toMatchObject({responseId:admitted[0].id,idempotent:true})
  const submit=async(value:number,time:string)=>{const session=await start(b);const receipt=await call<{responseId:string;disposition:string}>(`/api/public/flows/${slug}/responses`,body(session,value));expect(receipt.disposition).toBe('released');await dateResponse(receipt.responseId,time);return {session,id:receipt.responseId}}
  await submit(9,'2026-07-01T03:59:59.000Z');await submit(9,'2026-07-13T04:00:00.000Z')
  const oldRevision=admitted[0].session.revisionId
  draft=await call<BuilderDraft>(root+'/draft');await call(root+'/draft',{stepId,prompt:'Would you recommend our updated service?',required:true,expectedVersion:draft.flow.draftVersion},'PUT')
  draft=await call<BuilderDraft>(root+'/draft');await call(root+'/publish',{expectedVersion:draft.flow.draftVersion})
  const august=await submit(0,'2026-08-03T04:00:00.000Z');await submit(5,'2026-08-03T05:00:00.000Z');await submit(10,'2026-09-07T04:00:00.000Z')
  await env.DB.prepare('UPDATE flow_revisions SET published_at=? WHERE id=?').bind('2026-07-01T04:00:00.000Z',oldRevision).run();await env.DB.prepare('UPDATE flow_revisions SET published_at=? WHERE id=?').bind('2026-08-01T04:00:00.000Z',august.session.revisionId).run()
  const collectors=await call<Collector[]>(root+'/collectors');expect(collectors.find(item=>item.id===a.id)).toMatchObject({released:2,retained:2,state:'full',remaining:0});expect(collectors.find(item=>item.id===b.id)).toMatchObject({released:5,retained:5,state:'open',remaining:5})
  const ledger=await call<Ledger>(root+`/ledger?collectorId=${a.id}`);expect(ledger.total).toBe(2);expect(ledger.responses.map(row=>row.id).sort()).toEqual(admitted.map(row=>row.id).sort());expect(ledger.responses.every(row=>row.collector.id===a.id&&row.collector.name==='July mailing')).toBe(true)
  const trend=(unit:string,minimum=2,extra='')=>call<TrendReport>(root+`/trends?stepId=${stepId}&metric=score&unit=${unit}&minimum=${minimum}&from=2026-07-01&to=2026-10-01${extra}`)
  const monthly=await trend('month');expect(monthly.zone).toBe('America/New_York');expect(monthly.periods.map(point=>point.denominator)).toEqual([3,2,1]);expect(monthly.periods[0].value).toBeCloseTo(100/3);expect(monthly.periods[1].value).toBe(-100);expect(monthly.periods[2]).toMatchObject({value:null,suppressed:true})
  expect(monthly.periods[1].revisions).toContainEqual(expect.objectContaining({revisionId:august.session.revisionId,revisionNumber:2,prompt:'Would you recommend our updated service?'}));expect(monthly.periods[0].startAt).toBe('2026-07-01T04:00:00.000Z')
  const weekly=await trend('week');expect(weekly.periods.find(point=>point.label==='Week of 2026-07-06')).toMatchObject({denominator:2,value:0});expect(weekly.periods.find(point=>point.label==='Week of 2026-07-13')).toMatchObject({denominator:1,value:null,suppressed:true});expect(weekly.periods.some(point=>point.denominator===0&&point.value===null)).toBe(true)
  const cohort=await trend('month',1,`&collectorId=${b.id}`);expect(cohort.periods.map(point=>point.denominator)).toEqual([1,2,1]);expect(cohort.periods.map(point=>point.value)).toEqual([100,-100,100])
  const share=await call<TrendReport>(root+`/trends?stepId=${stepId}&metric=share&shareValue=10&unit=month&minimum=1&from=2026-07-01&to=2026-10-01`);expect(share.periods[0].value).toBeCloseTo(100/3)
  await call(root+`/collectors/${b.id}/close`,{});expect((await request(`/api/public/flows/${slug}/sessions`,{source:'embed',deviceClass:'desktop',collectorKey:b.publicKey})).status).toBe(409);await call(root+`/collectors/${b.id}/reopen`,{});expect((await start(b)).sessionId).toBeTruthy()
  for(const format of ['json','csv']){let {token}=await call<{token:string}>(root+`/responses/export/start?format=${format}&collectorId=${a.id}`);let output='';while(token){const response=await request(root+'/responses/export',{token});expect(response.status).toBe(200);output+=await response.text();token=response.headers.get('x-export-next')??''}if(format==='json')expect(JSON.parse(output).responses.map((row:{id:string})=>row.id).sort()).toEqual(admitted.map(row=>row.id).sort());else{expect(output).toContain('collector_id,collector_name,collector_channel');expect(output).toContain('July mailing');expect(output).not.toContain('Product feedback')}}
  const frozen=await call<{token:string}>(root+`/responses/export/start?format=csv&collectorId=${a.id}`)
  await call(root+`/collectors/${a.id}`,{name:'July customer mailing',channel:'email',responseLimit:2},'PUT')
  const invalidated=await request(root+'/responses/export',{token:frozen.token});expect(invalidated.status).toBe(400);expect(await invalidated.json()).toMatchObject({error:'VALIDATION_ERROR'})
  await call(`/api/app/responses/${admitted[0].id}`,undefined,'DELETE');expect(await env.DB.prepare('SELECT count(*) AS n FROM response_collector WHERE response_id=?').bind(admitted[0].id).first()).toEqual({n:0});expect(await env.DB.prepare('PRAGMA foreign_key_check').all()).toMatchObject({results:[]})
},60000)
