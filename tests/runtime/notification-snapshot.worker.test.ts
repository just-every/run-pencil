import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { afterEach, beforeAll, expect, vi } from 'vitest'
import { contract } from '../../src/test/contract'
import { notificationFixture as createNotificationFixture } from './notifications-fixture'
import { clearOwnedNotificationWork, ownNotificationFixture } from './notification-test-scope'
async function notificationFixture(slug: string) { return ownNotificationFixture(await createNotificationFixture(slug)) }

declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(()=>applyD1Migrations(env.DB,__PENCIL_CORE_MIGRATIONS__))
afterEach(clearOwnedNotificationWork)
async function recipients(responseId: string) {
  const row=await env.DB.prepare('SELECT payload_json FROM response_outbox WHERE response_id=?').bind(responseId).first<{payload_json:string}>()
  return row ? JSON.parse(row.payload_json).notificationOperatorIds as string[] : null
}
async function addOperator(f: Awaited<ReturnType<typeof notificationFixture>>, suffix: string) {
  const id=crypto.randomUUID(),now=new Date().toISOString()
  await env.DB.prepare('INSERT INTO operators(id,workspace_id,email,display_name,created_at,updated_at) VALUES(?,?,?,?,?,?)')
    .bind(id,f.scope.workspaceId,`${f.slug}-${suffix}@operator.example.test`,'Synthetic recipient',now,now).run()
  return id
}

contract(['NOTIFY-002'],'enabling mail after a completed Off response never retroactively sends it',async()=>{
  const f=await notificationFixture('notification-snapshot-off')
  await f.services.notifications.preferences.set(f.scope.workspaceId,f.flow.flowId,f.operatorId,'off')
  const fetch=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(null,{status:202}))
  try {
    const before=await f.submit()
    expect(await recipients(before.response.id)).toEqual([])
    expect(fetch).not.toHaveBeenCalled()
    await f.services.notifications.preferences.set(f.scope.workspaceId,f.flow.flowId,f.operatorId,'immediately')
    expect(await f.dispatcher.run()).toMatchObject({attempted:0})
    expect(fetch).not.toHaveBeenCalled()
    const after=await f.submit()
    expect(await recipients(after.response.id)).toEqual([f.operatorId])
    expect(fetch).not.toHaveBeenCalled()
    expect(await f.dispatcher.run()).toMatchObject({attempted:1})
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(await env.DB.prepare('SELECT id FROM notification_deliveries WHERE response_id=?').bind(before.response.id).first()).toBeNull()
  } finally {fetch.mockRestore()}
})

contract(['NOTIFY-002'],'Cron uses the committed recipients still opted in and excludes newly enabled or newly added operators',async()=>{
  const f=await notificationFixture('notification-snapshot-members'),original=await addOperator(f,'original'),late=await addOperator(f,'late')
  await f.services.notifications.preferences.set(f.scope.workspaceId,f.flow.flowId,original,'immediately')
  const submission=await f.submit()
  expect((await recipients(submission.response.id))!.sort()).toEqual([f.operatorId,original].sort())
  await f.services.notifications.preferences.set(f.scope.workspaceId,f.flow.flowId,original,'off')
  await f.services.notifications.preferences.set(f.scope.workspaceId,f.flow.flowId,late,'immediately')
  const added=await addOperator(f,'added')
  await f.services.notifications.preferences.set(f.scope.workspaceId,f.flow.flowId,added,'immediately')
  const fetch=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(null,{status:202}))
  try {
    expect(await f.dispatcher.run()).toMatchObject({attempted:1})
    expect(fetch).toHaveBeenCalledTimes(1)
    expect((await env.DB.prepare('SELECT operator_id FROM notification_deliveries WHERE response_id=?').bind(submission.response.id).all()).results).toEqual([{operator_id:f.operatorId}])
    await f.services.notifications.preferences.set(f.scope.workspaceId,f.flow.flowId,original,'immediately')
    expect(await f.dispatcher.run()).toMatchObject({attempted:0})
    expect((await recipients(submission.response.id))!.sort()).toEqual([f.operatorId,original].sort())
  } finally {fetch.mockRestore()}
})

contract(['NOTIFY-002'],'quarantine snapshots recipients only in its release transaction and historical quarantine remains ineligible',async()=>{
  const f=await notificationFixture('notification-snapshot-release'),other=await addOperator(f,'release')
  const held=await f.submit(true),historical=await f.submit(true)
  expect(await recipients(held.response.id)).toBeNull()
  await env.DB.prepare('UPDATE responses SET notification_eligible=0 WHERE id=?').bind(historical.response.id).run()
  await f.services.notifications.preferences.set(f.scope.workspaceId,f.flow.flowId,f.operatorId,'off')
  await f.services.notifications.preferences.set(f.scope.workspaceId,f.flow.flowId,other,'immediately')
  const fetch=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(null,{status:202}))
  try {
    expect(await f.dispatcher.run()).toMatchObject({attempted:0})
    await f.services.responses.releaseQuarantinedResponse({...f.scope,responseId:held.response.id,operatorId:f.operatorId})
    await f.services.responses.releaseQuarantinedResponse({...f.scope,responseId:historical.response.id,operatorId:f.operatorId})
    expect(await recipients(held.response.id)).toEqual([other])
    expect(fetch).not.toHaveBeenCalled()
    await f.services.notifications.preferences.set(f.scope.workspaceId,f.flow.flowId,f.operatorId,'immediately')
    expect(await f.dispatcher.run()).toMatchObject({attempted:1})
    expect((await env.DB.prepare('SELECT operator_id FROM notification_deliveries WHERE response_id=?').bind(held.response.id).all()).results).toEqual([{operator_id:other}])
    expect(await env.DB.prepare('SELECT id FROM notification_deliveries WHERE response_id=?').bind(historical.response.id).first()).toBeNull()
  } finally {fetch.mockRestore()}
})

contract(['NOTIFY-002'],'recipient selection sees preferences inside the final transaction rather than an earlier application read',async()=>{
  const f=await notificationFixture('notification-snapshot-atomic')
  await f.services.notifications.preferences.set(f.scope.workspaceId,f.flow.flowId,f.operatorId,'off')
  await env.DB.prepare(`CREATE TRIGGER notification_snapshot_at_commit AFTER INSERT ON responses BEGIN
    UPDATE notification_preferences SET mode='immediately' WHERE flow_id=NEW.flow_id;
  END`).run()
  try {
    const submission=await f.submit()
    expect(await recipients(submission.response.id)).toEqual([f.operatorId])
    expect(await env.DB.prepare('SELECT id FROM notification_deliveries WHERE response_id=?').bind(submission.response.id).first()).toBeNull()
  } finally {await env.DB.exec('DROP TRIGGER notification_snapshot_at_commit')}
})
