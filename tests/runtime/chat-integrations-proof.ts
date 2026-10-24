import { env } from 'cloudflare:test'
import { expect } from 'vitest'
import { actionsHttp, everyStoredValue } from './actions-fixture'

const receiver=(env as unknown as {TASK_RECEIVER_ORIGIN:string}).TASK_RECEIVER_ORIGIN
type Received={path:string;authorization:string|null;idempotencyKey:string|null;body:string}
const received=async()=>((await (await fetch(receiver+'/__control/state')).json()) as {requests:Received[]}).requests.filter(row=>['/chat.postMessage','/teams'].includes(row.path))
const accepted=async<T>(response:Response,status=200)=>{expect(response.status,await response.clone().text()).toBe(status);return response.status===204?undefined as T:response.json() as Promise<T>}
async function signature(secret:string,timestamp:string,body:string){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return 'v0='+Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`v0:${timestamp}:${body}`))),byte=>byte.toString(16).padStart(2,'0')).join('')}

/** One connected response journey across both real loopback network edges, signed action creation and their shared review schedule. */
export async function proveChatIntegrations(){
  await fetch(receiver+'/__control/reset',{method:'POST',body:JSON.stringify({mode:'ok'})})
  const f=await actionsHttp({},'chat-'+crypto.randomUUID().slice(0,6))
  await env.DB.prepare("UPDATE oa_operators SET role='owner' WHERE id=?").bind(f.lead.operatorId).run()
  await env.DB.prepare('UPDATE oa_sessions SET operator_version=(SELECT version FROM oa_operators WHERE id=operator_id) WHERE operator_id=?').bind(f.lead.operatorId).run()
  const member=await f.operator('Chat member'),asMember=f.as(member.token)
  await env.DB.prepare("UPDATE oa_operators SET role='member' WHERE id=?").bind(member.operatorId).run()
  await env.DB.prepare('UPDATE oa_sessions SET operator_version=(SELECT version FROM oa_operators WHERE id=operator_id) WHERE operator_id=?').bind(member.operatorId).run()
  const signingSecret='synthetic-pencil-chat-signing-secret',botToken='synthetic-pencil-chat-bot',webhookUrl=receiver+'/teams'
  expect((await asMember('/api/app/connections/slack',{botToken,signingSecret},{method:'PUT'})).status).toBe(403)
  expect((await asMember('/api/app/connections/teams',{webhookUrl},{method:'PUT'})).status).toBe(403)
  expect((await asMember('/api/app/connections/slack')).status).toBe(403)
  expect((await f.call('/api/app/connections/slack',{botToken,signingSecret,apiOrigin:'http://example.test'},{method:'PUT'})).status).toBe(400)
  await accepted(await f.call('/api/app/connections/slack',{botToken,signingSecret,apiOrigin:receiver},{method:'PUT'}))
  await accepted(await f.call('/api/app/connections/teams',{webhookUrl},{method:'PUT'}))
  for(const platform of ['slack','teams']){
    const status=await accepted<Record<string,unknown>>(await f.call('/api/app/connections/'+platform))
    expect(status).toMatchObject({saved:true})
    for(const secret of [signingSecret,botToken,webhookUrl])expect(JSON.stringify(status)).not.toContain(secret)
  }
  const stored=(await everyStoredValue()).filter(row=>row.startsWith('integration_connections:'))
  for(const secret of [signingSecret,botToken,webhookUrl])expect(stored.some(row=>row.includes(secret))).toBe(false)
  const draft=await f.services.flows.getBuilderDraft(f.workspaceId,f.flowId),privateField=draft.steps.find(step=>step.questionType==='long_text')!
  const base={answerStepIds:[f.choiceStepId],operatorId:f.owner.operatorId}
  const template=f.input();const {ownerOperatorId:_owner,evidence:_evidence,...actionTemplate}=template
  const slack={...base,platform:'slack',channel:'synthetic-pencil-channel',slackUserId:'synthetic-pencil-slack-user',action:actionTemplate}
  const teams={...base,platform:'teams',teamsUserId:'synthetic-pencil-microsoft-user'}
  expect((await f.call(`/api/app/flows/${f.flowId}/chat`,{...slack,answerStepIds:[privateField.id]},{method:'PUT'})).status).toBe(400)
  await accepted(await f.call(`/api/app/flows/${f.flowId}/chat`,slack,{method:'PUT'}))
  await accepted(await f.call(`/api/app/flows/${f.flowId}/chat`,teams,{method:'PUT'}))
  await f.respond('Too long','synthetic-pencil-private-answer-must-stay-private')
  const start=new Date().toISOString()
  await Promise.all([f.services.chat.run(start),f.services.chat.run(start)])
  const posts=await received();expect(posts).toHaveLength(2)
  const slackPost=posts.find(post=>post.path==='/chat.postMessage')!,teamsPost=posts.find(post=>post.path==='/teams')!
  const slackBody=JSON.parse(slackPost.body),teamsBody=JSON.parse(teamsPost.body)
  expect(slackBody.channel).toBe(slack.channel)
  expect(slackBody.text).toContain('How was the wait?: Too long')
  expect(teamsPost.body).toContain('How was the wait?: Too long')
  for(const post of posts){expect(post.body).toContain(`/app/flows/${f.flowId}/inbox`);expect(post.body).toContain('Submitted');expect(post.body).not.toContain('synthetic-pencil-private-answer');expect(post.body).not.toContain(signingSecret);expect(post.idempotencyKey).toBeTruthy()}
  expect(teamsBody.attachments[0].content.actions[0].url).toContain('/app/flows/')
  const deliveryId=slackBody.blocks[1].elements.find((element:{action_id?:string})=>element.action_id==='pencil_create_action').value as string
  const body=new URLSearchParams({payload:JSON.stringify({type:'block_actions',user:{id:slack.slackUserId},channel:{id:slack.channel},actions:[{action_id:'pencil_create_action',value:deliveryId}]})}).toString()
  const timestamp=String(Math.floor(Date.now()/1000))
  const interact=(signed:string|undefined,time=timestamp,raw=body)=>f.app.request('http://localhost/api/public/chat/slack/interactions',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded','x-slack-request-timestamp':time,...(signed?{'x-slack-signature':signed}:{})},body:raw})
  expect((await interact(undefined)).status).toBe(403)
  expect((await interact('v0='+'0'.repeat(64))).status).toBe(403)
  const stale=String(Number(timestamp)-301)
  expect((await interact(await signature(signingSecret,stale,body),stale)).status).toBe(403)
  expect((await (await f.call('/api/app/actions')).json()).actions).toEqual([])
  const valid=await signature(signingSecret,timestamp,body)
  const created=await accepted<{actionId:string}>(await interact(valid))
  expect(await accepted(await interact(valid))).toEqual(expect.objectContaining(created))
  const action=await accepted<{id:string;state:string;verdict:null;owner:{id:string};evidence:{figures:{completedResponses:number}}}>(await f.call('/api/app/actions/'+created.actionId))
  expect(action).toMatchObject({id:created.actionId,state:'planned',verdict:null,owner:{id:f.owner.operatorId},evidence:{figures:{completedResponses:1}}})
  expect((await (await f.call('/api/app/actions')).json()).actions).toHaveLength(1)
  // The shared ACT-009 calendar uses the explicit fake Cron instant, including before/open/on/weekly and concurrent ticks.
  await f.services.chat.run('2026-11-28T08:00:00.000Z');expect(await received()).toHaveLength(2)
  const deferred=await env.DB.prepare("SELECT state,available_at AS at FROM chat_deliveries WHERE kind='before'").all()
  expect(deferred.results).toEqual([expect.objectContaining({state:'pending',at:'2026-11-28T09:00:00.000Z'}),expect.objectContaining({state:'pending',at:'2026-11-28T09:00:00.000Z'})])
  for(const instant of ['2026-11-28T09:00:00.000Z','2026-12-01T09:00:00.000Z','2026-12-08T09:00:00.000Z']){
    await Promise.all([f.services.chat.run(instant),f.services.chat.run(instant)])
    await f.services.chat.run(instant)
  }
  const reminders=(await received()).slice(2);expect(reminders).toHaveLength(6)
  for(const path of ['/chat.postMessage','/teams']){
    const sequence=reminders.filter(post=>post.path===path)
    expect(sequence).toHaveLength(3)
    expect(sequence.map(post=>post.body)).toEqual([expect.stringContaining('Action review in three days'),expect.stringContaining('Action review today'),expect.stringContaining('Action review overdue')])
    expect(new Set(sequence.map(post=>post.idempotencyKey)).size).toBe(3)
    expect(sequence.every(post=>post.body.includes('/app/actions/'+created.actionId))).toBe(true)
    expect(sequence.every(post=>post.body.includes('synthetic-pencil-private-answer'))).toBe(false)
    for(const post of sequence){const parsed=JSON.parse(post.body);if(path==='/chat.postMessage')expect(parsed.channel).toBe(slack.slackUserId);else expect(parsed.attachments[0].content.msteams.entities[0].mentioned.id).toBe(teams.teamsUserId)}
  }
  await f.services.chat.run('2026-12-15T08:00:00.000Z');expect(await received()).toHaveLength(8)
  for(const state of ['in_progress','ready_for_review','effective'])await accepted(await f.call(`/api/app/actions/${created.actionId}/transitions`,{to:state}))
  await f.services.chat.run('2026-12-15T09:00:00.000Z');await f.services.chat.run('2026-12-22T09:00:00.000Z')
  expect(await received()).toHaveLength(8)
  const cancelled=await env.DB.prepare("SELECT state FROM chat_deliveries WHERE kind='overdue' AND due_date='2026-12-15'").all()
  expect(cancelled.results).toEqual([{state:'cancelled'},{state:'cancelled'}])
  // Failed posts remain visible with attempts in the same INTEG-015 ledger; reconnecting never blindly repeats them.
  await fetch(receiver+'/__control/chat-mode',{method:'POST',body:JSON.stringify({down:true})})
  await f.respond('Short','synthetic-pencil-private-second-answer')
  await f.services.chat.run(new Date().toISOString())
  const failed=await accepted<{deliveries:Array<{kind:string;state:string;attempts:unknown[]}>}>(await f.call('/api/app/integration-deliveries?state=failed'))
  expect(failed.deliveries.filter(row=>['slack','teams'].includes(row.kind)&&row.attempts.length)).toEqual([expect.objectContaining({state:'failed',attempts:[expect.objectContaining({outcome:'failed',httpStatus:503})]}),expect.objectContaining({state:'failed',attempts:[expect.objectContaining({outcome:'failed',httpStatus:503})]})])
  const before=(await received()).length;await f.services.chat.run(new Date().toISOString());expect(await received()).toHaveLength(before)
  await accepted(await f.call('/api/app/connections/slack',{}, {method:'DELETE'}));await accepted(await f.call('/api/app/connections/teams',{}, {method:'DELETE'}))
  const links=await accepted<{links:Array<{armed:boolean}>}>(await f.call(`/api/app/flows/${f.flowId}/chat`));expect(links.links.every(link=>!link.armed)).toBe(true)
  await fetch(receiver+'/__control/chat-mode',{method:'POST',body:JSON.stringify({down:false})})
}
