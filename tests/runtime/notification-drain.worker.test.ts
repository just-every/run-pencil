import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { afterEach, beforeAll, expect, vi } from 'vitest'
import { contract } from '../../src/test/contract'
import { notificationDrainFixture } from './notification-drain-fixture'
import { readNotificationBrand } from '../../src/core/features/notifications/brand.server'
import { NotificationDispatcher } from '../../src/core/features/notifications/dispatcher'
import { baseMailSender } from '../../src/core/platform/mail/base.server'
import { runScheduledMaintenance } from '../../src/core/app/maintenance'
import { clearOwnedNotificationWork } from './notification-test-scope'
import { meterD1Statements } from './d1-statement-meter'

declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(()=>applyD1Migrations(env.DB,__PENCIL_CORE_MIGRATIONS__))
afterEach(clearOwnedNotificationWork)

contract(['NOTIFY-002','BASE-OPS-003'],'one Cron drains 51 responses for three operators and repeated Cron creates no duplicate captures',async()=>{
  const f = await notificationDrainFixture('notification-cron-drain',51,3)
  const fetch = vi.spyOn(globalThis,'fetch').mockRejectedValue(new Error('Unexpected external request'))
  try {
    const controller = { scheduledTime: Date.now() } as ScheduledController
    const meter=meterD1Statements(env.DB)
    await runScheduledMaintenance(controller,{...env,DB:meter.db})
    expect(await env.DB.prepare('SELECT count(*) n FROM notification_deliveries WHERE response_id IN (SELECT id FROM responses WHERE flow_id=?) AND status=\'sent\'').bind(f.flow.flowId).first()).toEqual({n:153})
    expect(await env.DB.prepare('SELECT count(*) n FROM notification_attempts WHERE delivery_id IN (SELECT id FROM notification_deliveries WHERE response_id IN (SELECT id FROM responses WHERE flow_id=?)) AND event=\'started\'').bind(f.flow.flowId).first()).toEqual({n:153})
    expect(await env.DB.prepare('SELECT count(*) n FROM notification_attempts WHERE delivery_id IN (SELECT id FROM notification_deliveries WHERE response_id IN (SELECT id FROM responses WHERE flow_id=?)) AND event=\'sent\'').bind(f.flow.flowId).first()).toEqual({n:153})
    expect(meter.captures).toBe(153)
    expect(meter.capturedRows).toHaveLength(153)
    expect(meter.statements).toBeLessThanOrEqual(1000)
    console.log('Notification Cron D1 statements',meter.statements,'Base capture inserts',meter.captures)
    const retained=()=>env.DB.prepare(`SELECT count(*) n FROM rer_mail_development_outbox WHERE json_extract(message,'$.deliveryId') IN
      (SELECT d.idempotency_key FROM notification_deliveries d JOIN responses r ON r.id=d.response_id WHERE r.flow_id=?)`).bind(f.flow.flowId).first()
    expect(await retained()).toEqual({n:100})
    expect((await env.DB.prepare('SELECT id FROM rer_mail_development_outbox ORDER BY created_at DESC,sequence DESC').all<{id:string}>()).results.map(row=>row.id))
      .toEqual([...meter.capturedRows].sort((a,b)=>b.createdAt-a.createdAt || b.sequence-a.sequence).slice(0,100).map(row=>row.id))
    const repeated=meterD1Statements(env.DB)
    await runScheduledMaintenance(controller,{...env,DB:repeated.db})
    expect(repeated.captures).toBe(0)
    expect(await retained()).toEqual({n:100})
    expect(fetch).not.toHaveBeenCalled()
  } finally { fetch.mockRestore() }
})

contract(['NOTIFY-002','DIST-006'],'bounded parallel delivery visits every due row once and leaves future retries and unknown outcomes for their proper handling',async()=>{
  const f = await notificationDrainFixture('notification-bounded-drain',51), now = new Date().toISOString()
  let active=0, maximum=0
  const keys: string[]=[]
  const fetch = vi.spyOn(globalThis,'fetch').mockImplementation(async(_url,options)=>{
    const key=JSON.parse(String(options!.body)).custom_args.rer_delivery_id
    keys.push(key);const ordinal=keys.length;active++;maximum=Math.max(maximum,active)
    try {
      expect(await env.DB.prepare("SELECT count(*) n FROM notification_attempts a JOIN notification_deliveries d ON d.id=a.delivery_id WHERE d.idempotency_key=? AND d.status='sending' AND a.event='started' AND a.ordinal=d.attempts").bind(key).first()).toEqual({n:1})
      return new Response(null,{status:ordinal===1?503:429})
    } finally { active-- }
  })
  try {
    expect(await f.dispatcher.run(now)).toMatchObject({attempted:51})
    expect(fetch).toHaveBeenCalledTimes(51)
    expect(new Set(keys).size).toBe(51)
    expect(maximum).toBeGreaterThan(1);expect(maximum).toBeLessThanOrEqual(5)
    expect(await f.dispatcher.run(now)).toMatchObject({attempted:0})
    expect(fetch).toHaveBeenCalledTimes(51)
    const states=await env.DB.prepare('SELECT status,count(*) n FROM notification_deliveries WHERE response_id IN (SELECT id FROM responses WHERE flow_id=?) GROUP BY status ORDER BY status').bind(f.flow.flowId).all()
    expect(states.results).toEqual([{status:'pending',n:50},{status:'unknown',n:1}])
    expect(await env.DB.prepare("SELECT count(*) n FROM notification_deliveries WHERE status='pending' AND available_at>? AND response_id IN (SELECT id FROM responses WHERE flow_id=?)").bind(now,f.flow.flowId).first()).toEqual({n:50})
  } finally {fetch.mockRestore()}
})

contract(['NOTIFY-002'],'ineligible historical deliveries cannot block later eligible batches and a queue containing only ineligible rows terminates',async()=>{
  const f=await notificationDrainFixture('notification-ineligible-drain',102),now=new Date().toISOString()
  await env.DB.batch([
    env.DB.prepare("UPDATE responses SET notification_eligible=0,source='imported' WHERE id IN (SELECT id FROM responses WHERE flow_id=? ORDER BY id LIMIT 51)").bind(f.flow.flowId),
    env.DB.prepare('UPDATE response_outbox SET notification_eligible=0 WHERE response_id IN (SELECT id FROM responses WHERE flow_id=? AND notification_eligible=0)').bind(f.flow.flowId),
    env.DB.prepare(`INSERT INTO notification_deliveries(id,response_id,operator_id,status,idempotency_key,available_at,created_at,updated_at)
      SELECT '000-'||id,id,?,'pending','historical:'||id,?,?,? FROM responses WHERE flow_id=? AND notification_eligible=0`).bind(f.operatorId,now,now,now,f.flow.flowId),
  ])
  const fetch=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(null,{status:202}))
  try {
    expect(await f.dispatcher.run(now)).toMatchObject({attempted:51})
    expect(fetch).toHaveBeenCalledTimes(51)
    expect(await f.dispatcher.run(now)).toMatchObject({attempted:0})
    expect(fetch).toHaveBeenCalledTimes(51)
    expect(await env.DB.prepare("SELECT count(*) n FROM notification_deliveries WHERE status='pending' AND attempts=0 AND response_id IN (SELECT id FROM responses WHERE flow_id=?)").bind(f.flow.flowId).first()).toEqual({n:51})
    expect(await env.DB.prepare("SELECT count(*) n FROM response_outbox WHERE notification_eligible=0 AND status='pending' AND response_id IN (SELECT id FROM responses WHERE flow_id=?)").bind(f.flow.flowId).first()).toEqual({n:51})
  } finally {fetch.mockRestore()}
})

contract(['NOTIFY-002','DATA-002'],'erasure during asynchronous composition prevents egress and does not stop later batches',async()=>{
  const f=await notificationDrainFixture('notification-drain-erasure',51)
  let erased=false
  const dispatcher=new NotificationDispatcher(env.DB,baseMailSender({kind:'sendgrid',apiKey:'synthetic-secret',from:'no-reply@example.test'},env.DB),'https://forms.example.test','no-reply@example.test',async workspaceId=>{
    if(!erased) {
      erased=true
      await f.services.responses.eraseReleasedResponse({...f.scope,responseId:f.template.response.id,operatorId:f.operatorId})
    }
    return readNotificationBrand(env.DB,workspaceId)
  })
  const fetch=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(null,{status:202}))
  try {
    await dispatcher.run()
    expect(fetch).toHaveBeenCalledTimes(50)
    expect(await env.DB.prepare('SELECT id FROM response_outbox WHERE response_id=?').bind(f.template.response.id).first()).toBeNull()
    expect(await env.DB.prepare('SELECT id FROM notification_deliveries WHERE response_id=?').bind(f.template.response.id).first()).toBeNull()
    expect(await env.DB.prepare("SELECT count(*) n FROM notification_deliveries WHERE status='sent' AND response_id IN (SELECT id FROM responses WHERE flow_id=?)").bind(f.flow.flowId).first()).toEqual({n:50})
  } finally {fetch.mockRestore()}
})

contract(['NOTIFY-002','DIST-006'],'an overdue retry runs once at its scheduled instant without consuming all remaining retries in one drain',async()=>{
  const f=await notificationDrainFixture('notification-overdue-drain',51),started=Date.now()
  const fetch=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(null,{status:429}))
  try {
    await f.dispatcher.run(new Date(started).toISOString())
    const now=new Date(started+10*60_000).toISOString()
    expect(await f.dispatcher.run(now)).toMatchObject({attempted:51})
    expect(fetch).toHaveBeenCalledTimes(102)
    expect(await env.DB.prepare("SELECT count(*) n FROM notification_deliveries WHERE status='pending' AND attempts=2 AND available_at<=? AND response_id IN (SELECT id FROM responses WHERE flow_id=?)").bind(now,f.flow.flowId).first()).toEqual({n:51})
    expect(await f.dispatcher.run(now)).toMatchObject({attempted:0})
    expect(fetch).toHaveBeenCalledTimes(102)
    expect(await f.dispatcher.run(new Date(started+11*60_000).toISOString())).toMatchObject({attempted:51})
    expect(fetch).toHaveBeenCalledTimes(153)
    expect(new Set(fetch.mock.calls.map(([,options])=>JSON.parse(String(options!.body)).custom_args.rer_delivery_id)).size).toBe(51)
  } finally {fetch.mockRestore()}
})

contract(['NOTIFY-002','DATA-001'],'invalid sender and interrupted-attempt maintenance preserve unarmed restored pending and sending records',async()=>{
  const f=await notificationDrainFixture('notification-restored-maintenance',3),now=new Date().toISOString(),old=new Date(Date.now()-600_000).toISOString()
  const responses=(await env.DB.prepare('SELECT id FROM responses WHERE flow_id=? ORDER BY id').bind(f.flow.flowId).all<{id:string}>()).results
  for (let index=0;index<responses.length;index++) {
    const id=responses[index].id
    await env.DB.batch([
      env.DB.prepare('UPDATE responses SET notification_eligible=? WHERE id=?').bind(index===2?1:0,id),
      env.DB.prepare('UPDATE response_outbox SET notification_eligible=? WHERE response_id=?').bind(index===2?1:0,id),
      env.DB.prepare(`INSERT INTO notification_deliveries(id,response_id,operator_id,status,idempotency_key,attempts,first_attempt_at,last_attempt_at,available_at,created_at,updated_at)
        VALUES(?,?,?,?,?,1,?,?,?,?,?)`).bind('restore:'+id,id,f.operatorId,index===1?'sending':'pending','restore:'+id,old,old,old,old,old),
    ])
  }
  const restored=()=>env.DB.prepare('SELECT * FROM notification_deliveries WHERE response_id IN (?,?) ORDER BY id').bind(responses[0].id,responses[1].id).all()
  const before=(await restored()).results,send=vi.fn(),dispatcher=new NotificationDispatcher(env.DB,{send},'https://forms.example.test','sender@example.test')
  expect(await dispatcher.run(now)).toMatchObject({attempted:0,senderError:expect.stringContaining('MAIL_FROM')})
  expect((await restored()).results).toEqual(before)
  expect(await env.DB.prepare('SELECT status,reason FROM notification_deliveries WHERE response_id=?').bind(responses[2].id).first()).toMatchObject({status:'failed',reason:expect.stringContaining('MAIL_FROM')})
  expect(await env.DB.prepare('SELECT count(*) n FROM notification_attempts WHERE delivery_id IN (?,?)').bind('restore:'+responses[0].id,'restore:'+responses[1].id).first()).toEqual({n:0})
  expect(await new NotificationDispatcher(env.DB,{send},'https://forms.example.test','no-reply@example.test').run(now)).toMatchObject({attempted:0})
  expect((await restored()).results).toEqual(before)
  expect(send).not.toHaveBeenCalled()
})
