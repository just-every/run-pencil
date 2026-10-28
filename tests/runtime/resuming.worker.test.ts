import { privacyGoogleFixture } from './privacy-fixture'
import { privacyRequestJourney } from './privacy-journey'
import { matureLoad } from './load-time-fixture'
import { applyD1Migrations, env, SELF, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { foundationFixture } from './foundation-fixture'
import { fixtureExport } from '../helpers/report-download'
import { devKeyHeaders } from '../helpers/dev-key.mjs'

declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(()=>applyD1Migrations(env.DB,__PENCIL_CORE_MIGRATIONS__))
type Session = {sessionId:string;sessionToken:string;loadTime:string;revisionId:string;flow:{steps:Array<{id:string;kind:string}>}}
type Resumed = {state:string;sessionId:string;sessionToken:string;loadTime:string;revisionId:string;currentStepId:string;answers:Array<{stepId:string;value:unknown}>;invitationToken?:string;completionStepId?:string}
const post=(slug:string,path:string,data:unknown)=>SELF.fetch(`http://localhost/api/public/flows/${slug}/${path}`,{method:'POST',headers:{'Content-Type':'application/json','CF-Connecting-IP':slug},body:JSON.stringify(data)})
async function ok<T>(slug:string,path:string,data:unknown):Promise<T>{
  const response=await post(slug,path,data)
  expect(response.status).toBeGreaterThanOrEqual(200);expect(response.status).toBeLessThan(300)
  return response.json() as Promise<T>
}
async function emailedToken(email:string){
  const response=await SELF.fetch('http://localhost/__test/mail',{headers:devKeyHeaders})
  expect(response.status).toBe(200)
  const {messages}=await response.json() as {messages:Array<{to:string[];text:string}>}
  const message=messages.find(message=>message.to.includes(email))
  const match=message?.text.match(/[?&]resume=([a-f0-9]{64})/)
  expect(match).toBeTruthy()
  return match![1]
}
async function form(prefix:string){
  const f=await foundationFixture(`${prefix}-${crypto.randomUUID().slice(0,8)}`)
  for(const prompt of ['First saved answer','Second saved answer','Last answer']) await f.add({kind:'question',questionType:'short_text',prompt,required:true})
  await f.add({kind:'completion',questionType:null,prompt:'All done'});await f.publish()
  return f
}

contract('PART-002','explicit saves resume a pinned response through public doors, scrub private state on completion, and cannot resurrect erased or closed responses',async()=>{
  const f=await form('resume-public')
  const start=()=>ok<Session>(f.slug,'sessions',{deviceClass:'desktop',source:'direct'})
  const session=await start(), [first,second,last,done]=session.flow.steps
  const email=`resume-${session.sessionId}@example.test`
  const savedAnswers=[{stepId:first.id,value:'One retained answer'},{stepId:second.id,value:'Two retained answers'}]
  const save={sessionId:session.sessionId,sessionToken:session.sessionToken,commandKey:crypto.randomUUID(),email,currentStepId:last.id,answers:savedAnswers}
  const beforeContacts=await env.DB.prepare('SELECT count(*) AS n FROM distribution_contacts').first()
  const rejected=await post(f.slug,'sessions/save',{...save,answers:[...savedAnswers,{stepId:'foreign-question',value:'Do not save'}]})
  expect(rejected.status).toBe(400)
  expect(await env.DB.prepare('SELECT count(*) AS n FROM respondent_saves WHERE session_id=?').bind(session.sessionId).first()).toEqual({n:0})
  const saved=await ok<{state:string;expiresAt:string}>(f.slug,'sessions/save',save)
  expect(saved.state).toBe('saved');expect(Object.keys(saved).sort()).toEqual(['expiresAt','state'])
  const token=await emailedToken(email)
  expect(await ok(f.slug,'sessions/save',save)).toEqual(saved)
  const audit=()=>env.DB.prepare("SELECT count(*) AS n FROM audit_entries WHERE kind='response.resume-requested' AND subject_id=?").bind(f.flow.flowId).first()
  expect(await audit()).toEqual({n:1})
  const raw=await env.DB.prepare('SELECT token_hash,delivery_email FROM respondent_saves WHERE session_id=?').bind(session.sessionId).first()
  expect(raw?.token_hash).not.toBe(token);expect(raw?.delivery_email).toBeNull()
  expect(await env.DB.prepare('SELECT count(*) AS n FROM distribution_contacts').first()).toEqual(beforeContacts)
  expect((await fixtureExport(env.DB,f.scope.workspaceId,f.flow.flowId,{})).responses).toHaveLength(0)
  // A newer publication cannot redirect a saved response to a different graph.
  await f.publish()
  const resumed=await ok<Resumed>(f.slug,'resume',{token})
  expect(resumed).toMatchObject({state:'open',sessionId:session.sessionId,revisionId:session.revisionId,currentStepId:last.id,answers:savedAnswers})
  const repeated=await ok<Resumed>(f.slug,'resume',{token})
  expect(repeated).toEqual({...resumed,loadTime:expect.any(String)})
  expect(resumed.loadTime).toBeTruthy();expect(repeated.loadTime).toBeTruthy()
  await matureLoad(resumed, 5000)
  const receipt=await ok<{responseId:string}>(f.slug,'responses',{sessionId:resumed.sessionId,sessionToken:resumed.sessionToken,loadTime:resumed.loadTime,idempotencyKey:crypto.randomUUID(),answers:[...resumed.answers,{stepId:last.id,value:'Finished on another device'}]})
  expect(await env.DB.prepare('SELECT id FROM respondent_sessions WHERE id=?').bind(session.sessionId).first()).toBeNull()
  expect(await env.DB.prepare('SELECT answers_json,delivery_email,current_step_id,delivery_state,completion_step_id FROM respondent_saves WHERE session_id=?').bind(session.sessionId).first()).toEqual({answers_json:null,delivery_email:null,current_step_id:null,delivery_state:'completed',completion_step_id:done.id})
  expect(await ok<Resumed>(f.slug,'resume',{token})).toMatchObject({state:'completed',completionStepId:done.id})
  await f.services.flows.closeFlow(f.scope.workspaceId,f.flow.flowId,f.operatorId)
  expect(await ok<Resumed>(f.slug,'resume',{token})).toMatchObject({state:'completed'})
  await f.services.responses.eraseReleasedResponse({workspaceId:f.scope.workspaceId,responseId:receipt.responseId,operatorId:f.operatorId})
  expect(await ok<Resumed>(f.slug,'resume',{token})).toMatchObject({state:'unavailable',startAgain:`/f/${f.slug}`})
  expect(await audit()).toEqual({n:1})

  const closed=await form('resume-closed'), closedSession=await ok<Session>(closed.slug,'sessions',{deviceClass:'mobile'})
  const closedEmail=`closed-${closedSession.sessionId}@example.test`
  await ok(closed.slug,'sessions/save',{sessionId:closedSession.sessionId,sessionToken:closedSession.sessionToken,commandKey:crypto.randomUUID(),email:closedEmail,currentStepId:closedSession.flow.steps[0].id,answers:[]})
  const closedToken=await emailedToken(closedEmail)
  await closed.services.flows.closeFlow(closed.scope.workspaceId,closed.flow.flowId,closed.operatorId)
  expect(await ok(closed.slug,'resume',{token:closedToken})).toMatchObject({state:'unavailable'})
  expect(await env.DB.prepare('SELECT session_id FROM respondent_saves WHERE session_id=?').bind(closedSession.sessionId).first()).toBeNull()
},90_000)

contract(['PART-002','GOV-006'],'save mail failures retry one durable state, expiry purges it, and invitation resume preserves its original identity and collector',async()=>{
  const f=await form('resume-failures'), session=await ok<Session>(f.slug,'sessions',{deviceClass:'tablet',source:'embed'})
  const email=`failure-${session.sessionId}@example.test`, commandKey=crypto.randomUUID()
  const input={sessionId:session.sessionId,sessionToken:session.sessionToken,email,commandKey,currentStepId:session.flow.steps[0].id,answers:[]}
  // Failure is at the paid transport capture edge, after genuine save admission.
  await env.DB.exec("CREATE TRIGGER resume_test_mail_failure BEFORE INSERT ON rer_mail_development_outbox WHEN json_extract(NEW.message,'$.deliveryId') LIKE 'resume:%' BEGIN SELECT RAISE(ABORT,'synthetic mail unavailable'); END")
  try{
    const failed=await post(f.slug,'sessions/save',input)
    expect(failed.status).toBe(503);expect(await failed.json()).toMatchObject({error:'RESUME_MAIL_UNAVAILABLE'})
  }finally{await env.DB.exec('DROP TRIGGER resume_test_mail_failure')}
  const failedRow=await env.DB.prepare('SELECT delivery_id,delivery_state FROM respondent_saves WHERE session_id=?').bind(session.sessionId).first()
  expect(failedRow?.delivery_state).toBe('failed')
  await ok(f.slug,'sessions/save',input)
  expect(await env.DB.prepare('SELECT delivery_id,delivery_state FROM respondent_saves WHERE session_id=?').bind(session.sessionId).first()).toEqual({delivery_id:failedRow!.delivery_id,delivery_state:'sent'})
  const token=await emailedToken(email)
  const privateResponse=await post(f.slug,'resume',{token})
  expect(privateResponse.headers.get('Cache-Control')).toBe('no-store');expect(privateResponse.headers.get('Referrer-Policy')).toBe('no-referrer')
  await env.DB.prepare("UPDATE respondent_saves SET expires_at='2000-01-01T00:00:00.000Z' WHERE session_id=?").bind(session.sessionId).run()
  expect(await ok(f.slug,'resume',{token})).toMatchObject({state:'unavailable'})
  await f.services.responses.expireSessions(new Date().toISOString(),1000)
  expect(await env.DB.prepare('SELECT session_id FROM respondent_saves WHERE session_id=?').bind(session.sessionId).first()).toBeNull()

  const invited=await form('resume-invited')
  const contact=await invited.services.distribution.contacts.save(invited.scope.workspaceId,{name:'Synthetic resume recipient',email:`invited-${crypto.randomUUID()}@example.test`}) as {id:string}
  const launch=await invited.services.distribution.launches.launch({...invited.flow,operatorId:invited.operatorId,contactIds:[contact.id],commandKey:crypto.randomUUID()})
  const participant=await env.DB.prepare('SELECT id,token FROM invitation_participants WHERE launch_id=?').bind(launch.id).first<{id:string;token:string}>()
  const invitedSession=await ok<Session>(invited.slug,'sessions',{deviceClass:'desktop',invitationToken:participant!.token})
  const resumeEmail=`separate-resume-${crypto.randomUUID()}@example.test`
  await ok(invited.slug,'sessions/save',{sessionId:invitedSession.sessionId,sessionToken:invitedSession.sessionToken,commandKey:crypto.randomUUID(),email:resumeEmail,currentStepId:invitedSession.flow.steps[0].id,answers:[],invitationToken:participant!.token})
  const invitedToken=await emailedToken(resumeEmail), resumed=await ok<Resumed>(invited.slug,'resume',{token:invitedToken})
  expect(resumed.invitationToken).toBe(participant!.token)
  expect(await env.DB.prepare('SELECT participant_id FROM respondent_saves WHERE session_id=?').bind(invitedSession.sessionId).first()).toEqual({participant_id:participant!.id})
  await matureLoad(resumed, 5000)
  const result=await ok<{responseId:string}>(invited.slug,'responses',{sessionId:resumed.sessionId,sessionToken:resumed.sessionToken,loadTime:resumed.loadTime,invitationToken:resumed.invitationToken,idempotencyKey:crypto.randomUUID(),answers:invitedSession.flow.steps.filter(step=>step.kind==='question').map(step=>({stepId:step.id,value:'Invited retained answer'}))})
  expect(await env.DB.prepare('SELECT participant_id,source FROM responses WHERE id=?').bind(result.responseId).first()).toEqual({participant_id:participant!.id,source:'invitation'})
  expect(await env.DB.prepare('SELECT collector_id FROM response_collector WHERE response_id=?').bind(result.responseId).first()).toEqual(await env.DB.prepare('SELECT collector_id FROM invitation_launch_collector WHERE launch_id=?').bind(launch.id).first())
  const receiver=(env as unknown as {TASK_RECEIVER_ORIGIN:string}).TASK_RECEIVER_ORIGIN
  await privacyRequestJourney(await privacyGoogleFixture(receiver),receiver)
},90_000)
