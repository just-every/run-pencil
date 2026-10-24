import { resumeBearer } from '../../src/core/features/resuming/credentials'
import { ownNotificationFixture } from './notification-test-scope'
import { env } from 'cloudflare:test'
import { expect, vi } from 'vitest'
import type { BuilderDraft } from '../../src/core/app/api'
import type { FormSettings } from '../../src/core/shared/hiddenFields'
import type { MailSender } from '../../src/base/operator-auth/index.mjs'
import { AnswerAlerts } from '../../src/core/features/notifications/answer-alerts'
import { issueLoadTime } from '../../src/core/features/traffic/loadTime'
import { googleHttp } from './google-import-http'

/** Steps inside the existing durable notification registration, through the published collection and operator doors. */
export async function proveAnswerAlerts() {
  const f=await googleHttp(),slug=`alerts-${crypto.randomUUID()}`
  const created=await f.call('/api/app/flows',{title:'Answer alert proof',slug})
  expect(created.status).toBe(201)
  const {id}=await created.json() as {id:string},base=`/api/app/flows/${id}`
  ownNotificationFixture({flow:{flowId:id}})
  const read=async()=>await(await f.call(`${base}/draft`)).json() as BuilderDraft
  for(const step of [{kind:'question',questionType:'nps',prompt:'Recommend us',required:true},{kind:'question',questionType:'number',prompt:'Quantity',required:true},{kind:'question',questionType:'short_text',prompt:'Private feedback',required:true},{kind:'completion',questionType:null,prompt:'Recorded'}]) {
    expect((await f.call(`${base}/draft/steps`,{expectedVersion:(await read()).flow.draftVersion,step})).status).toBe(201)
  }
  const draft=await read(),[nps,quantity,feedback]=draft.steps
  const secondId=crypto.randomUUID(),now=new Date().toISOString()
  await env.DB.prepare('INSERT INTO operators(id,workspace_id,email,display_name,is_setup_operator,created_at,updated_at) VALUES(?,?,?,?,0,?,?)').bind(secondId,f.workspace,'second-alert@example.test','Second operator',now,now).run()
  const detractor={kind:'test' as const,stepId:nps.id,operator:'less_than_or_equal' as const,value:6}
  const settings:FormSettings={identityMode:'anonymous',hiddenFields:[{id:'plan',name:'plan',type:'text',category:'plain'}],calculations:[
    {id:'total',name:'Total',type:'number',expression:{kind:'multiply',left:{kind:'answer',stepId:quantity.id},right:{kind:'literal',value:2}}},
    {id:'segment',name:'Segment',type:'text',expression:{kind:'conditional',condition:detractor,then:{kind:'literal',value:'follow-up'},else:{kind:'literal',value:'no-follow-up'}}},
  ],answerAlerts:[
    {id:'detractor',name:'Detractor follow-up',condition:detractor,recipientIds:[f.operatorId,secondId]},
    {id:'enterprise',name:'Enterprise follow-up',condition:{kind:'group',join:'and',conditions:[detractor,{kind:'test',stepId:'hidden:plan',operator:'equals',value:'enterprise'}]},recipientIds:[f.operatorId]},
    {id:'total',name:'Matching total',condition:{kind:'test',stepId:'variable:total',operator:'equals',value:12},recipientIds:[f.operatorId]},
    {id:'text-calculation',name:'Calculated segment',condition:{kind:'test',stepId:'variable:segment',operator:'equals',value:'follow-up'},recipientIds:[f.operatorId]},
  ]}
  const save=async(value=settings)=>f.call(`${base}/draft/settings`,{settings:value,expectedVersion:(await read()).flow.draftVersion},{method:'PUT'})
  expect((await save()).status).toBe(200)
  expect((await f.call(`${base}/publish`,{expectedVersion:(await read()).flow.draftVersion})).status).toBe(201)
  const publicFlow=await(await f.call(`/api/public/flows/${slug}`,undefined,{auth:false})).json() as {formSettings:Record<string,unknown>}
  expect(publicFlow.formSettings.answerAlerts).toBeUndefined()
  const submit=async(score:number,plan:string,count:number,quarantine=false)=>{
    const session=await(await f.call(`/api/public/flows/${slug}/sessions`,{deviceClass:'mobile',source:'direct'},{auth:false})).json() as {sessionId:string;sessionToken:string;revisionId:string}
    const body={...session,idempotencyKey:crypto.randomUUID(),loadTime:await issueLoadTime(env.SESSION_SECRET,session.revisionId,Date.now()-(quarantine?0:5000)),answers:[{stepId:nps.id,value:score},{stepId:quantity.id,value:count},{stepId:feedback.id,value:'SYNTHETIC-PRIVATE-ANSWER-DO-NOT-MAIL'}],hidden:{plan}}
    const response=await f.call(`/api/public/flows/${slug}/responses`,body,{auth:false})
    expect(response.status,await response.clone().text()).toBe(201)
    return {body,receipt:await response.json() as {responseId:string}}
  }
  const detractorResponse=await submit(6,'basic',2),promoter=await submit(9,'enterprise',3),enterprise=await submit(3,'enterprise',6),held=await submit(4,'enterprise',2,true)
  const sender=vi.fn<MailSender['send']>().mockResolvedValue({status:'accepted',provider:'sendgrid',providerMessageId:'synthetic-pencil-1'})
  const dispatcher=new AnswerAlerts(env.DB,{send:sender},'https://forms.example.test','no-reply@example.test')
  await Promise.all([dispatcher.run(),dispatcher.run()])
  expect(sender).toHaveBeenCalledTimes(8)
  const rows=await env.DB.prepare('SELECT response_id AS responseId,rule_id AS ruleId,operator_id AS operatorId,status FROM answer_alert_deliveries WHERE response_id IN(?,?,?,?)').bind(detractorResponse.receipt.responseId,promoter.receipt.responseId,enterprise.receipt.responseId,held.receipt.responseId).all<{responseId:string;ruleId:string;operatorId:string;status:string}>()
  expect(rows.results.filter(row=>row.responseId===detractorResponse.receipt.responseId).map(row=>row.ruleId).sort()).toEqual(['detractor','detractor','text-calculation'])
  expect(rows.results.filter(row=>row.responseId===promoter.receipt.responseId)).toEqual([])
  expect(rows.results.filter(row=>row.responseId===enterprise.receipt.responseId).map(row=>row.ruleId).sort()).toEqual(['detractor','detractor','enterprise','text-calculation','total'])
  expect(rows.results.filter(row=>row.responseId===held.receipt.responseId)).toEqual([])
  for(const [message] of sender.mock.calls) {
    expect(message.text).toContain('Answer alert proof')
    expect(message.text).toContain(`/app/flows/${id}/results`)
    expect(message.headers).toMatchObject({'Auto-Submitted':'auto-generated'})
    expect(JSON.stringify(message)).not.toContain('SYNTHETIC-PRIVATE-ANSWER')
    expect(JSON.stringify(message)).not.toContain('enterprise')
  }
  expect((await f.call(`/api/public/flows/${slug}/responses`,detractorResponse.body,{auth:false})).status).toBe(201)
  await dispatcher.run();expect(sender).toHaveBeenCalledTimes(8)
  const attention=await f.call(`/api/app/answer-alerts?flowId=${id}`)
  expect(attention.status).toBe(200)
  const items=(await attention.json() as {items:Array<{id:string;ruleName:string;readAt:string|null}>}).items
  expect(items).toHaveLength(6)
  expect(items.every(item=>item.readAt===null)).toBe(true)
  expect((await f.call(`/api/app/answer-alerts/${items[0].id}/read`,{})).status).toBe(204)
  expect((await(await f.call(`/api/app/answer-alerts?flowId=${id}`)).json() as {items:Array<{id:string;readAt:string|null}>}).items.find(item=>item.id===items[0].id)?.readAt).toBeTruthy()
  expect((await f.call('/api/app/answer-alerts',undefined,{auth:false})).status).toBe(401)
  expect((await f.call(`/api/app/responses/${held.receipt.responseId}/release`,{})).status).toBe(204)
  await dispatcher.run();expect(sender).toHaveBeenCalledTimes(12)
  await dispatcher.run();expect(sender).toHaveBeenCalledTimes(12)
  const retried=await submit(5,'basic',2),start=Date.now(),sentBeforeRetry=sender.mock.calls.length
  sender.mockResolvedValue({status:'rate_limited',provider:'sendgrid',providerMessageId:null,code:'provider_rate_limited'})
  for(const minutes of [0,1,5,15,30,60])await dispatcher.run(new Date(start+minutes*60_000).toISOString())
  expect(sender.mock.calls.length-sentBeforeRetry).toBe(18)
  const retryRows=(await env.DB.prepare('SELECT id,idempotency_key AS key,status,attempts,operator_id AS operatorId FROM answer_alert_deliveries WHERE response_id=?').bind(retried.receipt.responseId).all<{id:string;key:string;status:string;attempts:number;operatorId:string}>()).results
  expect(retryRows).toHaveLength(3)
  expect(retryRows.every(row=>row.status==='failed'&&row.attempts===6)).toBe(true)
  expect(new Set(sender.mock.calls.slice(sentBeforeRetry).map(([message])=>message.deliveryId)).size).toBe(3)
  const retryRow=retryRows.find(row=>row.operatorId===f.operatorId)!
  await dispatcher.retry(f.workspace,f.operatorId,retryRow.id,false)
  sender.mockRejectedValue(new Error('synthetic-private-transport-error'));await dispatcher.run()
  expect(await env.DB.prepare('SELECT status FROM answer_alert_deliveries WHERE id=?').bind(retryRow.id).first()).toEqual({status:'unknown'})
  await expect(dispatcher.retry(f.workspace,f.operatorId,retryRow.id,false)).rejects.toThrow('duplicate')
  await dispatcher.retry(f.workspace,f.operatorId,retryRow.id,true)
  sender.mockResolvedValue({status:'rejected',provider:'sendgrid',providerMessageId:null,code:'provider_rejected'});await dispatcher.run()
  expect(await env.DB.prepare('SELECT status FROM answer_alert_deliveries WHERE id=?').bind(retryRow.id).first()).toEqual({status:'unknown'})
  await dispatcher.retry(f.workspace,f.operatorId,retryRow.id,true)
  sender.mockResolvedValue({status:'accepted',provider:'sendgrid',providerMessageId:'synthetic-pencil-2'});await dispatcher.run()
  expect(sender.mock.calls.at(-1)![0].deliveryId).toBe(retryRow.key)
  expect(await env.DB.prepare('SELECT status FROM answer_alert_deliveries WHERE id=?').bind(retryRow.id).first()).toEqual({status:'sent'})
  // Payment records are a test-only fixture; the consumer reads their state without changing it.
  const paidSettings:FormSettings={...settings,answerAlerts:[{id:'paid',name:'Paid order',condition:{kind:'test',stepId:'payment:state',operator:'equals',value:'paid'},recipientIds:[f.operatorId]}]}
  expect((await save(paidSettings)).status).toBe(200)
  expect((await f.call(`${base}/publish`,{expectedVersion:(await read()).flow.draftVersion})).status).toBe(201)
  const savedSession=await(await f.call(`/api/public/flows/${slug}/sessions`,{deviceClass:'mobile',source:'direct'},{auth:false})).json() as {sessionId:string;sessionToken:string;revisionId:string}
  const commandKey=crypto.randomUUID(),saveResponse=await f.call(`/api/public/flows/${slug}/sessions/save`,{...savedSession,commandKey,email:'synthetic-pencil-1@example.test',currentStepId:nps.id,answers:[]},{auth:false})
  expect(saveResponse.status,await saveResponse.clone().text()).toBe(200)
  const resumeToken=await resumeBearer(env.SESSION_SECRET,savedSession.sessionId,commandKey)
  const open=await(await f.call(`/api/public/flows/${slug}/resume`,{token:resumeToken},{auth:false})).json() as {state:string;flow:{formSettings:Record<string,unknown>};sessionId:string;sessionToken:string;revisionId:string}
  expect(open.state).toBe('open');expect(open.flow.formSettings.answerAlerts).toBeUndefined()
  const completion=await f.call(`/api/public/flows/${slug}/responses`,{sessionId:open.sessionId,sessionToken:open.sessionToken,revisionId:open.revisionId,idempotencyKey:crypto.randomUUID(),loadTime:await issueLoadTime(env.SESSION_SECRET,open.revisionId,Date.now()-5000),answers:[{stepId:nps.id,value:9},{stepId:quantity.id,value:2},{stepId:feedback.id,value:'SYNTHETIC-PRIVATE-ANSWER-DO-NOT-MAIL'}]},{auth:false})
  expect(completion.status,await completion.clone().text()).toBe(201)
  const paidResponse=await completion.json() as {responseId:string}
  const completed=await(await f.call(`/api/public/flows/${slug}/resume`,{token:resumeToken},{auth:false})).json() as {state:string;flow:{formSettings:Record<string,unknown>}}
  expect(completed.state).toBe('completed');expect(completed.flow.formSettings.answerAlerts).toBeUndefined()
  const paymentNow=new Date().toISOString(),beforePaid=sender.mock.calls.length
  await env.DB.prepare(`INSERT INTO response_payments(response_id,step_id,completion_step_id,provider,livemode,state,attempt,amount,currency,lines_json,checkout_settings_json,state_changed_at,created_at,updated_at) VALUES(?,?,?,'stripe',0,'pending',1,400,'usd','[]','{}',?,?,?)`).bind(paidResponse.responseId,'synthetic-pencil-1',draft.steps.at(-1)!.id,paymentNow,paymentNow,paymentNow).run()
  await dispatcher.run();expect(sender).toHaveBeenCalledTimes(beforePaid)
  expect(await env.DB.prepare('SELECT response_id FROM answer_alert_evaluations WHERE response_id=?').bind(paidResponse.responseId).first()).toBeNull()
  await env.DB.prepare("UPDATE response_payments SET state='paid',state_changed_at=?,updated_at=? WHERE response_id=?").bind(paymentNow,paymentNow,paidResponse.responseId).run()
  await dispatcher.run();expect(sender).toHaveBeenCalledTimes(beforePaid+1)
  expect(sender.mock.calls.at(-1)![0].text).toContain('Paid order')
  expect(JSON.stringify(sender.mock.calls.at(-1)![0])).not.toContain('SYNTHETIC-PRIVATE-ANSWER')
  expect(await env.DB.prepare('SELECT state FROM response_payments WHERE response_id=?').bind(paidResponse.responseId).first()).toEqual({state:'paid'})
  await dispatcher.run();expect(sender).toHaveBeenCalledTimes(beforePaid+1)
  const retained=JSON.stringify(await dispatcher.read(f.workspace,f.operatorId,id))
  expect(retained).not.toContain('synthetic-private-transport-error')
  expect((await f.call(`/api/app/responses/${enterprise.receipt.responseId}`,undefined,{method:'DELETE'})).status).toBe(204)
  expect((await env.DB.prepare('SELECT id FROM answer_alert_deliveries WHERE response_id=?').bind(enterprise.receipt.responseId).all()).results).toEqual([])
  expect((await env.DB.prepare('SELECT response_id FROM answer_alert_evaluations WHERE response_id=?').bind(enterprise.receipt.responseId).all()).results).toEqual([])
  await env.DB.prepare('DELETE FROM answer_alert_deliveries WHERE response_id IN(SELECT id FROM responses WHERE flow_id=?)').bind(id).run()
  await env.DB.prepare('DELETE FROM response_outbox WHERE response_id IN(SELECT id FROM responses WHERE flow_id=?)').bind(id).run()
}
