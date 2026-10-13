import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { afterEach, beforeAll, expect, vi } from 'vitest'
import { contract } from '../../src/test/contract'
import { notificationDrainFixture } from './notification-drain-fixture'
import { clearOwnedNotificationWork } from './notification-test-scope'
import { meterD1Statements } from './d1-statement-meter'
import { readNotificationBrand } from '../../src/core/features/notifications/brand.server'
import { NotificationDispatcher } from '../../src/core/features/notifications/dispatcher'
import { notificationCaptureClaim } from '../../src/core/features/notifications/capture'
import { baseMailSender } from '../../src/core/platform/mail/base.server'

declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(()=>applyD1Migrations(env.DB,__PENCIL_CORE_MIGRATIONS__))
afterEach(clearOwnedNotificationWork)
function deferred<T>() {
  let resolve!: (value:T)=>void
  const promise=new Promise<T>(done=>{resolve=done})
  return {promise,resolve}
}
const held=(ready:Promise<void>,run:Promise<unknown>)=>Promise.race([ready,run.then(()=>{throw new Error('Delivery finished before reaching its test barrier.')})])
const dispatcher=(db: D1Database,accent?:()=>Promise<string>)=>new NotificationDispatcher(db,baseMailSender({kind:'local-development'},db,notificationCaptureClaim),'https://forms.example.test','no-reply@example.test',accent ? async workspaceId => { await accent(); return readNotificationBrand(db,workspaceId) } : undefined)

contract(['NOTIFY-002','DATA-002','BASE-DATA-002'],'refused capture rolls back Base retention and preserves all one hundred unrelated messages',async()=>{
  const f=await notificationDrainFixture('notification-capture-retention',100)
  const fetch=vi.spyOn(globalThis,'fetch').mockRejectedValue(new Error('Unexpected external request'))
  try {
    expect(await dispatcher(env.DB).run()).toMatchObject({attempted:100})
    const before=(await env.DB.prepare('SELECT * FROM rer_mail_development_outbox ORDER BY sequence').all()).results
    expect(before).toHaveLength(100)
    const submission=await f.submit()
    let changed=false
    const meter=meterD1Statements(env.DB,1000,async queries=>{
      if(!changed && queries.some(sql=>/^\s*INSERT INTO rer_mail_development_outbox\b/.test(sql))) {
        changed=true
        await f.services.notifications.preferences.set(f.scope.workspaceId,f.flow.flowId,f.operatorId,'off')
      }
    })
    await dispatcher(meter.db).run()
    expect(changed).toBe(true)
    expect((await env.DB.prepare('SELECT * FROM rer_mail_development_outbox ORDER BY sequence').all()).results).toEqual(before)
    expect(await env.DB.prepare("SELECT sequence FROM rer_mail_development_outbox WHERE json_extract(message,'$.deliveryId') IN (SELECT idempotency_key FROM notification_deliveries WHERE response_id=?)").bind(submission.response.id).first()).toBeNull()
    expect(await env.DB.prepare('SELECT status FROM notification_deliveries WHERE response_id=?').bind(submission.response.id).first()).toEqual({status:'unknown'})
    expect(fetch).not.toHaveBeenCalled()
  } finally {fetch.mockRestore()}
})

async function staleClaim(captureBoundary: boolean) {
  const f=await notificationDrainFixture(captureBoundary?'notification-capture-ordinal':'notification-composition-ordinal',1)
  const originalReady=deferred<void>(),originalRelease=deferred<string>(),retryReady=deferred<void>(),retryRelease=deferred<string>()
  const now=new Date().toISOString(),later=new Date(Date.parse(now)+360_000).toISOString()
  let intercepted=false
  const meter=meterD1Statements(env.DB,1000,async queries=>{
    if(captureBoundary && !intercepted && queries.some(sql=>/^\s*INSERT INTO rer_mail_development_outbox\b/.test(sql))) {
      intercepted=true;originalReady.resolve();await originalRelease.promise
    }
  })
  const original=dispatcher(meter.db,captureBoundary?undefined:async()=>{originalReady.resolve();return originalRelease.promise})
  const retry=dispatcher(env.DB,async()=>{retryReady.resolve();return retryRelease.promise})
  const fetch=vi.spyOn(globalThis,'fetch').mockRejectedValue(new Error('Unexpected external request'))
  const oldRun=original.run(now)
  let retryRun: Promise<unknown> | undefined
  try {
    await held(originalReady.promise,oldRun)
    await dispatcher(env.DB).run(later)
    const row=await env.DB.prepare('SELECT id,status,idempotency_key FROM notification_deliveries WHERE response_id=?').bind(f.template.response.id).first<{id:string;status:string;idempotency_key:string}>()
    expect(row!.status).toBe('unknown')
    await expect(f.services.notifications.preferences.retry(f.scope.workspaceId,f.operatorId,row!.id,false,later)).rejects.toThrow('duplicate')
    await f.services.notifications.preferences.retry(f.scope.workspaceId,f.operatorId,row!.id,true,later)
    retryRun=retry.run(later);await held(retryReady.promise,retryRun)
    expect(await env.DB.prepare('SELECT status,attempts FROM notification_deliveries WHERE id=?').bind(row!.id).first()).toEqual({status:'sending',attempts:2})
    originalRelease.resolve('#245c46');await oldRun
    expect(await env.DB.prepare("SELECT count(*) n FROM rer_mail_development_outbox WHERE json_extract(message,'$.deliveryId')=?").bind(row!.idempotency_key).first()).toEqual({n:0})
    retryRelease.resolve('#245c46');await retryRun
    const captured=await env.DB.prepare("SELECT message FROM rer_mail_development_outbox WHERE json_extract(message,'$.deliveryId')=?").bind(row!.idempotency_key).all<{message:string}>()
    expect(captured.results).toHaveLength(1)
    expect(JSON.parse(captured.results[0].message)).toMatchObject({deliveryId:row!.idempotency_key,headers:{'X-Pencil-Notification-Attempt':'2'}})
    expect((await env.DB.prepare("SELECT ordinal,event FROM notification_attempts WHERE delivery_id=? ORDER BY ordinal,event").bind(row!.id).all()).results)
      .toEqual([{ordinal:1,event:'operator-retry'},{ordinal:1,event:'started'},{ordinal:1,event:'unknown'},{ordinal:2,event:'sent'},{ordinal:2,event:'started'}])
    expect(await env.DB.prepare('SELECT status,attempts FROM notification_deliveries WHERE id=?').bind(row!.id).first()).toEqual({status:'sent',attempts:2})
    expect(fetch).not.toHaveBeenCalled()
  } finally {
    originalRelease.resolve('#245c46');retryRelease.resolve('#245c46')
    await Promise.allSettled([oldRun,...(retryRun?[retryRun]:[])])
    fetch.mockRestore()
  }
}
contract(['NOTIFY-002','DIST-006'],'resuming an old composition cannot send under a newer explicitly retried claim',()=>staleClaim(false))
contract(['NOTIFY-002','DIST-006'],'Base capture refuses an old ordinal even after its final eligibility read succeeded',()=>staleClaim(true))
