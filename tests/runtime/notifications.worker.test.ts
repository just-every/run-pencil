import { proveAnswerAlerts } from './answer-alert-proof'

import { applyD1Migrations, env, SELF, type D1Migration } from 'cloudflare:test'
import { afterEach, beforeAll, expect, vi } from 'vitest'
import { contract } from '../../src/test/contract'
import { notificationFixture as createNotificationFixture } from './notifications-fixture'
import { clearOwnedNotificationWork, ownNotificationFixture } from './notification-test-scope'
async function notificationFixture(slug: string) { return ownNotificationFixture(await createNotificationFixture(slug)) }
declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(()=>applyD1Migrations(env.DB,__PENCIL_CORE_MIGRATIONS__))
afterEach(clearOwnedNotificationWork)
contract(['NOTIFY-002','NOTIFY-004','NOTIFY-005'],'publisher defaults Immediately only if unset, others Off; committed private mail has a durable attempt and replay cannot double send',async()=>{
  const f=await notificationFixture('notification-defaults')
  expect((await f.deliveries()).mode).toBe('immediately')
  const second=await env.DB.prepare('SELECT id FROM operators WHERE workspace_id=? AND id!=? LIMIT 1').bind(f.scope.workspaceId,f.operatorId).first<{id:string}>()
  expect((await f.services.notifications.preferences.read(f.scope.workspaceId,f.flow.flowId,second!.id)).mode).toBe('off')
  expect(await f.services.flows.publishDraft({...f.flow,operatorId:second!.id,expectedVersion:0})).toMatchObject({kind:'conflict'})
  expect((await f.services.notifications.preferences.read(f.scope.workspaceId,f.flow.flowId,second!.id)).mode).toBe('off')
  await f.services.notifications.preferences.set(f.scope.workspaceId,f.flow.flowId,f.operatorId,'off')
  await f.services.flows.publishDraft({...f.flow,operatorId:f.operatorId,expectedVersion:(await f.draft()).flow.draftVersion})
  expect((await f.deliveries()).mode).toBe('off')
  await f.services.notifications.preferences.set(f.scope.workspaceId,f.flow.flowId,f.operatorId,'immediately')
  const submission=await f.submit()
  const send=vi.spyOn(globalThis,'fetch').mockImplementation(async(_url,options)=>{
    const payload=JSON.parse(String(options!.body))
    const state=await f.deliveries()
    expect(state.deliveries[0]).toMatchObject({status:'sending',attempts:1})
    expect((await env.DB.prepare("SELECT event FROM notification_attempts WHERE delivery_id=?").bind(state.deliveries[0].id).all()).results).toEqual([{event:'started'}])
    expect(payload.from.email).toBe('no-reply@example.test')
    expect(payload.headers['Auto-Submitted']).toBe('auto-generated')
    expect(payload.content).toHaveLength(2)
    expect(JSON.stringify(payload)).not.toContain('DISTINCTIVE-PRIVATE-ANSWER')
    expect(JSON.stringify(payload)).not.toContain(submission.session.sessionToken)
    expect(payload.content[0].value).toContain(`/app/flows/${f.flow.flowId}/results`)
    return new Response(null,{status:202})
  })
  try {
    expect(send).not.toHaveBeenCalled()
    await Promise.all([f.dispatcher.run(),f.dispatcher.run()]);await submission.replay();await f.dispatcher.run()
    expect(send).toHaveBeenCalledTimes(1)
    expect((await f.deliveries()).deliveries).toMatchObject([{status:'sent',attempts:1}])
    const result=await SELF.fetch(`http://localhost/api/app/flows/${f.flow.flowId}/notifications`,{headers:{Host:'localhost'}})
    expect(result.status).toBe(401)
    const document=await SELF.fetch(`http://localhost/app/flows/${f.flow.flowId}/results`,{headers:{Host:'localhost'},redirect:'manual'})
    expect(document.status).toBe(302);expect(document.headers.get('location')).toContain('/signin')
  } finally {send.mockRestore()}
  await proveAnswerAlerts()
})
contract(['NOTIFY-002','NOTIFY-004','DIST-006'],'transient retries keep their key through five retries; permanent and unknown failures remain visible only to their operator',async()=>{
  const f=await notificationFixture('notification-retries');await f.submit()
  const send=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(null,{status:429})),start=Date.now()
  try {
    for(const minutes of [0,1,5,15,30,60]) await f.dispatcher.run(new Date(start+minutes*60_000).toISOString())
    expect(send).toHaveBeenCalledTimes(6)
    const state=await f.deliveries();expect(state.deliveries[0]).toMatchObject({status:'failed',attempts:6,reason:expect.stringContaining('exhausted')})
    expect(new Set(send.mock.calls.map(([,options])=>JSON.parse(String(options!.body)).custom_args.rer_delivery_id)).size).toBe(1)
    expect(state.deliveries[0].reason).toContain('sendgrid: provider_rate_limited')
    expect(await env.DB.prepare("SELECT provider,provider_code FROM notification_attempts WHERE delivery_id=? AND event='transient' LIMIT 1").bind(state.deliveries[0].id).first()).toEqual({provider:'sendgrid',provider_code:'provider_rate_limited'})
    const other=await env.DB.prepare('SELECT id FROM operators WHERE workspace_id=? AND id!=? LIMIT 1').bind(f.scope.workspaceId,f.operatorId).first<{id:string}>()
    expect(await f.services.notifications.preferences.read(f.scope.workspaceId,f.flow.flowId,other!.id)).toMatchObject({mode:'off',failureReason:null,deliveries:[]})
    await expect(f.services.notifications.preferences.retry(f.scope.workspaceId,other!.id,state.deliveries[0].id,false)).rejects.toThrow('not yours')
    const key=JSON.parse(String(send.mock.calls[0][1]!.body)).custom_args.rer_delivery_id
    await f.services.notifications.preferences.retry(f.scope.workspaceId,f.operatorId,state.deliveries[0].id,false)
    send.mockResolvedValue(new Response(null,{status:400}));await f.dispatcher.run()
    expect((await f.deliveries()).deliveries[0]).toMatchObject({status:'failed',reason:expect.stringContaining('rejected')})
    expect((await f.deliveries()).deliveries[0].reason).toContain('sendgrid: provider_rejected')
    expect(await env.DB.prepare('SELECT provider,provider_code FROM notification_deliveries WHERE id=?').bind(state.deliveries[0].id).first()).toEqual({provider:'sendgrid',provider_code:'provider_rejected'})
    expect(JSON.parse(String(send.mock.calls.at(-1)![1]!.body)).custom_args.rer_delivery_id).toBe(key)
    await f.services.notifications.preferences.retry(f.scope.workspaceId,f.operatorId,state.deliveries[0].id,false)
    send.mockRejectedValue(new Error('secret-must-not-escape'));await f.dispatcher.run();await f.dispatcher.run(new Date(start+2*86400_000).toISOString())
    expect(send).toHaveBeenCalledTimes(8)
    expect((await f.deliveries()).deliveries[0]).toMatchObject({status:'unknown'})
    expect(JSON.stringify(await f.deliveries())).not.toContain('secret-must-not-escape')
    await expect(f.services.notifications.preferences.retry(f.scope.workspaceId,f.operatorId,state.deliveries[0].id,false)).rejects.toThrow('duplicate')
    await f.services.notifications.preferences.retry(f.scope.workspaceId,f.operatorId,state.deliveries[0].id,true)
    send.mockResolvedValue(new Response(null,{status:202}));await f.dispatcher.run();expect(send).toHaveBeenCalledTimes(9)
    expect((await env.DB.prepare("SELECT id FROM invitation_participants WHERE delivery_status='bounced'").all()).results).toHaveLength(0)
  }finally{send.mockRestore()}
})
contract(['NOTIFY-002','NOTIFY-004','DATA-002'],'the maintained Base local outbox captures only a durably claimed notification and response erasure removes its retained message',async()=>{
  const f=await notificationFixture('notification-local-outbox'),submitted=await f.submit()
  await env.DB.prepare(`CREATE TRIGGER notification_capture_requires_attempt BEFORE INSERT ON rer_mail_development_outbox BEGIN
    SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM notification_deliveries d JOIN notification_attempts a ON a.delivery_id=d.id
      WHERE d.idempotency_key=json_extract(NEW.message,'$.deliveryId') AND d.status='sending' AND a.event='started' AND a.ordinal=d.attempts)
      THEN RAISE(ABORT,'Notification capture requires its durable attempt') END;
    END`).run()
  const fetch=vi.spyOn(globalThis,'fetch').mockRejectedValue(new Error('Unexpected external request'))
  try {
    await f.services.notifications.dispatcher.run()
    const delivery=await env.DB.prepare('SELECT idempotency_key,status FROM notification_deliveries WHERE response_id=?').bind(submitted.response.id).first<{idempotency_key:string;status:string}>()
    expect(delivery!.status).toBe('sent')
    const captured=await env.DB.prepare("SELECT message FROM rer_mail_development_outbox WHERE json_extract(message,'$.deliveryId')=?").bind(delivery!.idempotency_key).all<{message:string}>()
    expect(captured.results).toHaveLength(1)
    const message=JSON.parse(captured.results[0].message)
    const claim=await env.DB.prepare("SELECT a.id,a.ordinal FROM notification_attempts a JOIN notification_deliveries d ON d.id=a.delivery_id WHERE d.idempotency_key=? AND a.ordinal=d.attempts AND a.event='started'").bind(delivery!.idempotency_key).first<{id:string;ordinal:number}>()
    expect(claim).toMatchObject({id:expect.any(String),ordinal:1})
    expect(message).toMatchObject({deliveryId:delivery!.idempotency_key,headers:{'Auto-Submitted':'auto-generated','X-Pencil-Notification-Attempt':String(claim!.ordinal),'X-Pencil-Notification-Claim':claim!.id},from:'no-reply@pencil.test'})
    expect(message.html).toContain(`/app/flows/${f.flow.flowId}/results`)
    expect(message.text).toContain(`/app/flows/${f.flow.flowId}/results`)
    expect(captured.results[0].message).not.toContain('DISTINCTIVE-PRIVATE-ANSWER')
    await env.DB.exec('DROP TRIGGER notification_capture_requires_attempt')
    await f.services.responses.eraseReleasedResponse({workspaceId:f.scope.workspaceId,responseId:submitted.response.id,operatorId:f.operatorId})
    expect(await env.DB.prepare("SELECT sequence FROM rer_mail_development_outbox WHERE json_extract(message,'$.deliveryId')=?").bind(delivery!.idempotency_key).first()).toBeNull()
    const {baseMailSender}=await import('../../src/core/platform/mail/base.server'),{notificationCaptureClaim}=await import('../helpers/notification-capture')
    const capturesBefore=await env.DB.prepare('SELECT count(*) n FROM rer_mail_development_outbox').first()
    await expect(baseMailSender({kind:'local-development'},env.DB,notificationCaptureClaim).send(message)).rejects.toMatchObject({name:'DevelopmentOutboxError',code:'development_outbox_failed',retryable:true})
    expect(await env.DB.prepare('SELECT count(*) n FROM rer_mail_development_outbox').first()).toEqual(capturesBefore)
    expect(await env.DB.prepare("SELECT sequence FROM rer_mail_development_outbox WHERE json_extract(message,'$.deliveryId')=?").bind(delivery!.idempotency_key).first()).toBeNull()
    await f.services.notifications.dispatcher.run();expect(fetch).not.toHaveBeenCalled()
  }finally{fetch.mockRestore();await env.DB.exec('DROP TRIGGER IF EXISTS notification_capture_requires_attempt')}
})
