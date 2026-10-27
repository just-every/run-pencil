import { env } from 'cloudflare:test'
import { expect, vi } from 'vitest'
import type { BuilderDraft, PublicFlow, Ledger } from '../../src/core/app/api'
import type { ActionDetail } from '../../src/core/features/actions/model'
import { issueLoadTime } from '../../src/core/features/traffic/loadTime'
import { actionsHttp, everyStoredValue } from './actions-fixture'

const receiver=(env as unknown as {TASK_RECEIVER_ORIGIN:string}).TASK_RECEIVER_ORIGIN
type Received={path:string;authorization:string|null;idempotencyKey:string|null;body:string}
const received=async()=>((await (await fetch(receiver+'/__control/state')).json()) as {requests:Received[]}).requests.filter(row=>['/chat.postMessage','/teams'].includes(row.path))
const accepted=async<T>(response:Response,status=200)=>{expect(response.status,await response.clone().text()).toBe(status);return response.status===204?undefined as T:response.json() as Promise<T>}
async function signature(secret:string,timestamp:string,body:string){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return 'v0='+Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`v0:${timestamp}:${body}`))),byte=>byte.toString(16).padStart(2,'0')).join('')}

/** One connected response journey across both real loopback network edges, signed action creation and their shared review schedule. */
export async function proveChatIntegrations(){
  vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-10-27T10:00:00.000Z'))
  try {
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
  const postedResponse=(await accepted<Ledger>(await f.call(`/api/app/flows/${f.flowId}/ledger`))).responses[0]
  const authoredMessage=`${draft.flow.title}\nSubmitted ${postedResponse.completedAt}\nHow was the wait?: Too long`
  expect(slackBody.blocks[0].text.text).toBe(authoredMessage)
  expect(teamsBody.attachments[0].content.body[0].text).toBe(authoredMessage)
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
  const future=String(Number(timestamp)+301)
  expect((await interact(await signature(signingSecret,future,body),future)).status).toBe(403)
  for(const changed of [{user:{id:'synthetic-pencil-c47-14'}},{channel:{id:'synthetic-pencil-c47-15'}}]) {
    const forgedActor=new URLSearchParams({payload:JSON.stringify({...JSON.parse(new URLSearchParams(body).get('payload')!),...changed})}).toString()
    expect((await interact(await signature(signingSecret,timestamp,forgedActor),timestamp,forgedActor)).status).toBe(403)
    expect((await (await f.call('/api/app/actions')).json()).actions).toEqual([])
  }
  const valid=await signature(signingSecret,timestamp,body)
  const boundary=String(Number(timestamp)-300)
  const created=await accepted<{actionId:string}>(await interact(await signature(signingSecret,boundary,body),boundary))
  const padded=body+'&padding='+'x'.repeat(32768-new TextEncoder().encode(body+'&padding=').length)
  expect(new TextEncoder().encode(padded)).toHaveLength(32768)
  expect(await accepted(await interact(await signature(signingSecret,timestamp,padded),timestamp,padded))).toEqual(expect.objectContaining(created))
  const oversized=padded+'x'
  const refusedSize=await interact(await signature(signingSecret,timestamp,oversized),timestamp,oversized)
  expect(refusedSize.status).toBe(400);expect(await refusedSize.json()).toMatchObject({message:'Slack interaction is too large.'})
  expect(await accepted(await interact(valid))).toEqual(expect.objectContaining(created))
  const action=await accepted<ActionDetail>(await f.call('/api/app/actions/'+created.actionId))
  expect(action).toMatchObject(actionTemplate)
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
  // App-created actions use the same calendar and explicit owner account mapping, on both platforms.
  const manual=await f.create({title:'Synthetic manual mapped action'}),unmapped=await f.create({title:'Synthetic manual unmapped action',ownerOperatorId:f.lead.operatorId})
  const manualStart=(await received()).length
  await f.services.chat.run('2026-11-28T08:00:00.000Z')
  expect(await received()).toHaveLength(manualStart)
  const manualDeferred=await env.DB.prepare("SELECT d.state,d.available_at AS at FROM chat_deliveries d JOIN chat_action_targets t ON t.id=d.action_target_id WHERE t.action_id=? AND d.kind='before'").bind(manual.id).all()
  expect(manualDeferred.results).toEqual([expect.objectContaining({state:'pending',at:'2026-11-28T09:00:00.000Z'}),expect.objectContaining({state:'pending',at:'2026-11-28T09:00:00.000Z'})])
  for(const instant of ['2026-11-28T09:00:00.000Z','2026-12-01T09:00:00.000Z','2026-12-08T09:00:00.000Z']){
    await Promise.all([f.services.chat.run(instant),f.services.chat.run(instant)])
    await f.services.chat.run(instant)
  }
  const manualPosts=(await received()).slice(manualStart)
  expect(manualPosts).toHaveLength(6)
  for(const path of ['/chat.postMessage','/teams']){
    const sequence=manualPosts.filter(post=>post.path===path)
    expect(sequence.map(post=>post.body)).toEqual([expect.stringContaining('Action review in three days'),expect.stringContaining('Action review today'),expect.stringContaining('Action review overdue')])
    expect(new Set(sequence.map(post=>post.idempotencyKey)).size).toBe(3)
    for(const post of sequence){expect(post.body).toContain('/app/actions/'+manual.id);expect(post.body).not.toContain(unmapped.id);const parsed=JSON.parse(post.body);if(path==='/chat.postMessage')expect(parsed.channel).toBe(slack.slackUserId);else expect(parsed.attachments[0].content.msteams.entities[0].mentioned.id).toBe(teams.teamsUserId)}
  }
  expect(await env.DB.prepare('SELECT count(*) AS n FROM chat_action_targets WHERE action_id=?').bind(unmapped.id).first()).toEqual({n:0})
  await f.services.chat.run('2026-12-15T08:00:00.000Z')
  for(const state of ['in_progress','ready_for_review','effective'])await accepted(await f.call(`/api/app/actions/${manual.id}/transitions`,{to:state}))
  await f.services.chat.run('2026-12-15T09:00:00.000Z');await f.services.chat.run('2026-12-22T09:00:00.000Z')
  expect(await received()).toHaveLength(manualStart+6)
  expect((await env.DB.prepare("SELECT d.state FROM chat_deliveries d JOIN chat_action_targets t ON t.id=d.action_target_id WHERE t.action_id=? AND d.due_date='2026-12-15'").bind(manual.id).all()).results).toEqual([{state:'cancelled'},{state:'cancelled'}])
  // Failed posts remain visible with attempts in the same INTEG-015 ledger; reconnecting never blindly repeats them.
  await fetch(receiver+'/__control/chat-mode',{method:'POST',body:JSON.stringify({down:true})})
  await f.respond('Short','synthetic-pencil-private-second-answer')
  await f.services.chat.run(new Date().toISOString())
  const failed=await accepted<{deliveries:Array<{id:string;idempotencyKey:string;kind:string;state:string;attempts:unknown[]}>}>(await f.call('/api/app/integration-deliveries?state=failed'))
  expect(failed.deliveries.filter(row=>['slack','teams'].includes(row.kind)&&row.attempts.length)).toEqual([expect.objectContaining({state:'failed',attempts:[expect.objectContaining({outcome:'failed',httpStatus:503})]}),expect.objectContaining({state:'failed',attempts:[expect.objectContaining({outcome:'failed',httpStatus:503})]})])
  const before=(await received()).length;await f.services.chat.run(new Date().toISOString());expect(await received()).toHaveLength(before)
  const failedPosts=failed.deliveries.filter(row=>['slack','teams'].includes(row.kind)&&row.attempts.length)
  const replay=(id:string,call=f.call)=>call('/api/app/chat/deliveries/'+id+'/replay',{})
  expect((await replay(failedPosts[0].id,asMember)).status).toBe(403)
  expect((await f.call('/api/app/chat/deliveries/'+failedPosts[0].id+'/replay',{unexpected:true})).status).toBe(400)
  await fetch(receiver+'/__control/chat-mode',{method:'POST',body:JSON.stringify({down:false})})
  const replayStart=(await received()).length
  for(const row of failedPosts)await accepted(await replay(row.id))
  const replayedPosts=(await received()).slice(replayStart)
  expect(replayedPosts).toHaveLength(2)
  expect(replayedPosts.map(post=>post.idempotencyKey).sort()).toEqual(failedPosts.map(row=>row.idempotencyKey).sort())
  for(const row of failedPosts){
    expect((await replay(row.id)).status).toBe(409)
    const ledger=await accepted<{deliveries:Array<{id:string;state:string;attempts:Array<{reason:string|null}>}>}>(await f.call('/api/app/integration-deliveries'))
    expect(ledger.deliveries.find(item=>item.id===row.id)).toMatchObject({state:'confirmed',attempts:expect.arrayContaining([expect.objectContaining({reason:'Explicit owner replay requested; the same idempotency key is retained.'})])})
  }
  // A dropped reply may already be stored by the receiver. A scheduler tick must leave it unknown.
  await fetch(receiver+'/__control/chat-mode',{method:'POST',body:JSON.stringify({drop:true})})
  await f.respond('Short','synthetic-pencil-unknown-post')
  await f.services.chat.run()
  const unknownLedger=await accepted<{deliveries:Array<{id:string;kind:string;state:string;idempotencyKey:string}>}>(await f.call('/api/app/integration-deliveries?state=unknown'))
  const unknown=unknownLedger.deliveries.find(row=>['slack','teams'].includes(row.kind))!
  expect(unknown).toBeTruthy()
  const unknownCalls=(await received()).length
  await f.services.chat.run();expect(await received()).toHaveLength(unknownCalls)
  expect((await accepted<{deliveries:Array<{id:string;state:string}>}>(await f.call('/api/app/integration-deliveries?state=unknown'))).deliveries).toContainEqual(expect.objectContaining({id:unknown.id,state:'unknown'}))
  const storedBefore=(await (await fetch(receiver+'/__control/state')).json() as {chatPosts:Record<string,string>}).chatPosts
  await accepted(await replay(unknown.id))
  expect((await received()).at(-1)!.idempotencyKey).toBe(unknown.idempotencyKey)
  const storedAfter=(await (await fetch(receiver+'/__control/state')).json() as {chatPosts:Record<string,string>}).chatPosts
  expect(storedAfter).toEqual(storedBefore)
  // Each stale-door refusal is checked before any network post.
  await fetch(receiver+'/__control/chat-mode',{method:'POST',body:JSON.stringify({down:true})})
  await f.respond('Short','synthetic-pencil-stale-post');await f.services.chat.run()
  const staleRows=(await accepted<{deliveries:Array<{id:string;kind:string;idempotencyKey:string}>}>(await f.call('/api/app/integration-deliveries?state=failed'))).deliveries.filter(row=>['slack','teams'].includes(row.kind)&&row.idempotencyKey.startsWith('chat:response:'))
  const staleSlack=staleRows.find(row=>row.kind==='slack')!,staleTeams=staleRows.find(row=>row.kind==='teams')!
  const staleCalls=(await received()).length
  vi.setSystemTime(new Date('2026-10-27T10:00:01.000Z'))
  await accepted(await f.call(`/api/app/flows/${f.flowId}/chat`,{...slack,channel:'synthetic-pencil-changed-channel'},{method:'PUT'}))
  const actionsBeforeOld=(await (await f.call('/api/app/actions')).json()).actions
  const oldTimestamp=String(Math.floor(Date.now()/1000))
  expect((await interact(await signature(signingSecret,oldTimestamp,body),oldTimestamp)).status).toBe(404)
  expect((await (await f.call('/api/app/actions')).json()).actions).toEqual(actionsBeforeOld)
  expect(await accepted(await replay(staleSlack.id),409)).toMatchObject({error:'CONFLICT',message:expect.stringContaining('settings changed')})
  await accepted(await f.call('/api/app/connections/teams',{webhookUrl},{method:'PUT'}))
  expect(await accepted(await replay(staleTeams.id),409)).toMatchObject({error:'CONFLICT',message:expect.stringContaining('disarmed')})
  // The restore policy disarms links; exercise the resulting route-level refusal too.
  await env.DB.prepare("UPDATE chat_form_links SET armed=0 WHERE platform='slack' AND workspace_id=?").bind(f.workspaceId).run()
  expect(await accepted(await replay(staleSlack.id),409)).toMatchObject({error:'CONFLICT',message:expect.stringContaining('disarmed')})
  expect(await received()).toHaveLength(staleCalls)
  // Valid fields on a separate form exercise save limits, text truncation and oversized-receipt non-resend.
  await fetch(receiver+'/__control/chat-mode',{method:'POST',body:JSON.stringify({receiptBytes:16385})})
  const boundFlow=await accepted<{id:string}>(await f.call('/api/app/flows',{title:'synthetic-pencil-c47-16',slug:'synthetic-pencil-c47-'+Date.now()}),201)
  const boundPath=`/api/app/flows/${boundFlow.id}`,readBound=async()=>accepted<BuilderDraft>(await f.call(boundPath+'/draft'))
  const prompts=Array.from({length:21},(_,index)=>('synthetic-pencil-c47-'+(2000+index)+' ').padEnd(900,'x'))
  for(const prompt of prompts)await accepted(await f.call(boundPath+'/draft/steps',{expectedVersion:(await readBound()).flow.draftVersion,step:{kind:'question',questionType:'number',prompt,required:true}}),201)
  await accepted(await f.call(boundPath+'/draft/steps',{expectedVersion:(await readBound()).flow.draftVersion,step:{kind:'completion',questionType:null,prompt:'synthetic-pencil-c47-17'}}),201)
  const boundDraft=await readBound(),fieldIds=boundDraft.steps.filter(step=>step.kind==='question').map(step=>step.id)
  const boundSettings={...slack,answerStepIds:fieldIds.slice(0,20)}
  await accepted(await f.call(boundPath+'/chat',boundSettings,{method:'PUT'}))
  expect((await f.call(boundPath+'/chat',{...boundSettings,answerStepIds:fieldIds},{method:'PUT'})).status).toBe(400)
  await accepted(await f.call(boundPath+'/publish',{expectedVersion:(await readBound()).flow.draftVersion}),201)
  const publicBound=await accepted<PublicFlow>(await f.call('/api/public/flows/'+boundDraft.flow.slug,undefined,{auth:false}))
  const session=await accepted<{sessionId:string;sessionToken:string}>(await f.call('/api/public/flows/'+boundDraft.flow.slug+'/sessions',{deviceClass:'desktop',source:'direct'},{auth:false}),201)
  const submission=await accepted<{responseId:string}>(await f.call('/api/public/flows/'+boundDraft.flow.slug+'/responses',{sessionId:session.sessionId,sessionToken:session.sessionToken,loadTime:await issueLoadTime(env.SESSION_SECRET,publicBound.revision.id,Date.now()-5000),idempotencyKey:'synthetic-pencil-c47-18',answers:fieldIds.map((stepId,index)=>({stepId,value:index}))},{auth:false}),201)
  await f.services.chat.run()
  const longPost=(await received()).find(post=>post.body.includes('synthetic-pencil-c47-16'))!
  const longBody=JSON.parse(longPost.body)
  const longResponse=(await accepted<Ledger>(await f.call(boundPath+'/ledger'))).responses[0]
  const fullText=`synthetic-pencil-c47-16\nSubmitted ${longResponse.completedAt}\n`+prompts.slice(0,20).map((prompt,index)=>prompt+': '+index).join('\n')
  expect(fullText.length).toBeGreaterThan(12000)
  expect(longBody.blocks[0].text.text).toBe(fullText.slice(0,12000))
  expect(longBody.text).toBe(fullText.slice(0,12000)+'\n'+`http://localhost/app/flows/${boundFlow.id}/inbox`)
  const receiptLedger=await accepted<{deliveries:Array<{responseId:string;state:string;attempts:Array<{reason:string|null}>}>}>(await f.call('/api/app/integration-deliveries'))
  expect(receiptLedger.deliveries.find(row=>row.responseId===submission.responseId)).toMatchObject({state:'unknown',attempts:expect.arrayContaining([expect.objectContaining({reason:'Chat service returned an oversized receipt.'})])})
  const boundedPosts=(await received()).length
  await f.services.chat.run();expect(await received()).toHaveLength(boundedPosts)
  await accepted(await f.call('/api/app/connections/slack',{}, {method:'DELETE'}));await accepted(await f.call('/api/app/connections/teams',{}, {method:'DELETE'}))
  const links=await accepted<{links:Array<{armed:boolean}>}>(await f.call(`/api/app/flows/${f.flowId}/chat`));expect(links.links.every(link=>!link.armed)).toBe(true)
  await fetch(receiver+'/__control/chat-mode',{method:'POST',body:JSON.stringify({down:false})})
  } finally {vi.useRealTimers()}
}
