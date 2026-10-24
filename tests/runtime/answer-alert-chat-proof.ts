import { env } from 'cloudflare:test'
import { expect } from 'vitest'
import { actionsHttp } from './actions-fixture'
import { matureLoad } from './load-time-fixture'
import { ownNotificationFixture } from './notification-test-scope'
import type { BuilderDraft } from '../../src/core/app/api'

const receiver=(env as unknown as {TASK_RECEIVER_ORIGIN:string}).TASK_RECEIVER_ORIGIN
type Received={path:string;body:string;idempotencyKey:string|null}
const accepted=async<T>(response:Response,status=200)=>{expect(response.status,await response.clone().text()).toBe(status);return response.json() as Promise<T>}

/** Matching rules share chat's durable claim; the public respondent door remains independent of a broken chat service. */
export async function proveAnswerAlertChat() {
  expect((await fetch(receiver+'/__control/reset',{method:'POST',body:'{}'})).status).toBe(200)
  const f=await actionsHttp({},'alert-chat-'+crypto.randomUUID().slice(0,6))
  await env.DB.prepare("UPDATE oa_operators SET role='owner' WHERE id=?").bind(f.lead.operatorId).run()
  await env.DB.prepare('UPDATE oa_sessions SET operator_version=(SELECT version FROM oa_operators WHERE id=operator_id) WHERE operator_id=?').bind(f.lead.operatorId).run()
  const slug='synthetic-pencil-chat-alert-'+crypto.randomUUID(),title='Synthetic chat answer alert'
  const flow=await accepted<{id:string}>(await f.call('/api/app/flows',{title,slug}),201),base='/api/app/flows/'+flow.id
  ownNotificationFixture({flow:{flowId:flow.id}})
  const read=async()=>accepted<BuilderDraft>(await f.call(base+'/draft'))
  try {
    for(const step of [{kind:'question',questionType:'nps',prompt:'Recommend us',required:true},{kind:'question',questionType:'short_text',prompt:'Private feedback',required:true},{kind:'completion',questionType:null,prompt:'Recorded'}]) {
      await accepted(await f.call(base+'/draft/steps',{expectedVersion:(await read()).flow.draftVersion,step}),201)
    }
    const initial=await read(),[nps,feedback]=initial.steps
    const rules=[{id:'synthetic-pencil-detractor',name:'Detractor follow-up',condition:{kind:'test',stepId:nps.id,operator:'less_than_or_equal',value:6},recipientIds:[f.lead.operatorId],chatPlatforms:['slack','teams']}]
    const save=async()=>f.call(base+'/draft/settings',{expectedVersion:(await read()).flow.draftVersion,settings:{...initial.formSettings!,answerAlerts:rules}},{method:'PUT'})
    expect((await save()).status).toBe(400)
    await accepted(await f.call('/api/app/connections/slack',{botToken:'synthetic-pencil-chat-bot',signingSecret:'synthetic-pencil-chat-signing-secret',apiOrigin:receiver},{method:'PUT'}))
    await accepted(await f.call('/api/app/connections/teams',{webhookUrl:receiver+'/teams'},{method:'PUT'}))
    for(const platform of ['slack','teams']) {
      await accepted(await f.call(base+'/chat',{platform,postResponses:false,answerStepIds:[],operatorId:f.lead.operatorId,...(platform==='slack'?{channel:'synthetic-pencil-channel',slackUserId:'synthetic-pencil-slack-user'}:{teamsUserId:'synthetic-pencil-microsoft-user'})},{method:'PUT'}))
    }
    await accepted(await save())
    await accepted(await f.call(base+'/publish',{expectedVersion:(await read()).flow.draftVersion}),201)
    const submit=async(score:number)=>{
      const session=await accepted<{sessionId:string;sessionToken:string;revisionId:string;loadTime:string}>(await f.call(`/api/public/flows/${slug}/sessions`,{deviceClass:'mobile',source:'direct'},{auth:false}),201)
      await matureLoad(session,5000)
      const body={...session,idempotencyKey:'synthetic-pencil-'+crypto.randomUUID(),honeypot:'',answers:[{stepId:nps.id,value:score},{stepId:feedback.id,value:'synthetic-pencil-private-chat-alert-answer'}]}
      const receipt=await accepted<{responseId:string;disposition:string}>(await f.call(`/api/public/flows/${slug}/responses`,body,{auth:false}),201)
      expect(receipt.disposition).toBe('released')
      return {body,receipt}
    }
    const received=async()=>((await (await fetch(receiver+'/__control/state')).json()) as {requests:Received[]}).requests.filter(row=>['/chat.postMessage','/teams'].includes(row.path)&&row.body.includes(title))
    const detractor=await submit(6),promoter=await submit(9)
    await Promise.all([f.services.notifications.answerAlerts.run(),f.services.notifications.answerAlerts.run()])
    await Promise.all([f.services.chat.run(),f.services.chat.run()])
    const posts=await received()
    expect(posts).toHaveLength(2)
    expect(posts.map(post=>post.path).sort()).toEqual(['/chat.postMessage','/teams'])
    expect(posts.filter(post=>post.idempotencyKey?.endsWith(promoter.receipt.responseId))).toEqual([])
    for(const post of posts) {
      expect(post.idempotencyKey).toBe(`chat:alert:synthetic-pencil-detractor:${(await accepted<{links:Array<{id:string;platform:string}>}>(await f.call(base+'/chat'))).links.find(link=>link.platform===(post.path==='/teams'?'teams':'slack'))!.id}:${detractor.receipt.responseId}`)
      expect(post.body).toContain('Detractor follow-up')
      expect(post.body).toContain(`/app/flows/${flow.id}/results`)
      expect(post.body).not.toContain('synthetic-pencil-private-chat-alert-answer')
      expect(post.body).not.toContain('Private feedback')
      expect(post.body).not.toContain('pencil_create_action')
    }
    expect((await f.call(`/api/public/flows/${slug}/responses`,detractor.body,{auth:false})).status).toBe(201)
    await f.services.notifications.answerAlerts.run();await f.services.chat.run();expect(await received()).toHaveLength(2)
    expect((await fetch(receiver+'/__control/chat-mode',{method:'POST',body:JSON.stringify({down:true})})).status).toBe(200)
    const failed=await submit(3)
    await f.services.notifications.answerAlerts.run();await f.services.chat.run()
    const ledger=await accepted<{deliveries:Array<{id:string;kind:string;responseId:string|null;state:string;attempts:Array<{outcome:string;httpStatus:number}>}>}>(await f.call('/api/app/integration-deliveries?state=failed'))
    const failures=ledger.deliveries.filter(row=>row.responseId===failed.receipt.responseId&&['slack','teams'].includes(row.kind))
    expect(failures).toHaveLength(2)
    expect(failures.every(row=>row.state==='failed'&&row.attempts.some(attempt=>attempt.outcome==='failed'&&attempt.httpStatus===503))).toBe(true)
    await f.services.chat.run();expect(await received()).toHaveLength(4)
    const failedIds=failures.map(row=>row.id)
    expect((await f.call('/api/app/responses/'+failed.receipt.responseId,undefined,{method:'DELETE'})).status).toBe(204)
    expect((await env.DB.prepare('SELECT id FROM chat_deliveries WHERE response_id=?').bind(failed.receipt.responseId).all()).results).toEqual([])
    expect((await env.DB.prepare('SELECT id FROM chat_attempts WHERE delivery_id IN (SELECT value FROM json_each(?))').bind(JSON.stringify(failedIds)).all()).results).toEqual([])
    const erasedLedger=await accepted<{deliveries:Array<{responseId:string|null}>}>(await f.call('/api/app/integration-deliveries'))
    expect(erasedLedger.deliveries.filter(row=>row.responseId===failed.receipt.responseId)).toEqual([])
    for(const platform of ['slack','teams'])await accepted(await f.call('/api/app/connections/'+platform,{}, {method:'DELETE'}))
    expect((await save()).status).toBe(400)
    expect((await f.call(base+'/publish',{expectedVersion:(await read()).flow.draftVersion})).status).toBe(400)
  } finally {
    for(const platform of ['slack','teams']) {
      expect((await f.call(base+'/chat/'+platform,{}, {method:'DELETE'})).status).toBe(204)
      await accepted(await f.call('/api/app/connections/'+platform,{}, {method:'DELETE'}))
    }
    expect((await fetch(receiver+'/__control/chat-mode',{method:'POST',body:JSON.stringify({down:false})})).status).toBe(200)
  }
}
