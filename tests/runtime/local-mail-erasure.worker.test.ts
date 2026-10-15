import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { localMailErasureFixture } from './local-mail-erasure-fixture'
import { audienceFixture } from './audience-fixture'
import { NotificationDispatcher } from '../../src/core/features/notifications/dispatcher'
import { notificationCaptureClaim } from '../../src/core/features/notifications/capture'
import { baseMailSender } from '../../src/core/platform/mail/base.server'

declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(() => applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__))

contract(['DATA-002', 'BASE-DATA-003'], 'public contact erasure counts every removed local copy across invitations, reminders, notifications and legacy captures', async () => {
  const f = await localMailErasureFixture('mail-contact-erasure')
  const first = await f.launch()
  await f.send(first, true)
  await f.services.notifications.preferences.set(f.scope.workspaceId,f.flow.flowId,f.operatorId,'immediately')
  const response = await f.complete(first)
  const notifications=new NotificationDispatcher(env.DB,baseMailSender({kind:'local-development'},env.DB,notificationCaptureClaim),'http://localhost','no-reply@pencil.test')
  expect(await notifications.run()).toMatchObject({attempted:1})
  const notification=await env.DB.prepare('SELECT idempotency_key,status,reason FROM notification_deliveries WHERE response_id=?').bind(response.responseId).first<{idempotency_key:string}>()
  expect(notification).toMatchObject({status:'sent'})
  // The current address no longer matches either historical delivered snapshot.
  await env.DB.prepare('UPDATE distribution_contacts SET email = ? WHERE id = ?')
    .bind('updated-recipient@example.test', f.contact.id).run()
  await f.publish()
  const second = await f.launch()
  await f.send(second)
  const other = await f.services.distribution.contacts.save(f.scope.workspaceId,
    { name: 'Another recipient', email: first.email_snapshot }) as { id: string }
  const unrelated = await f.launch(other.id)
  const retained = await f.send(unrelated)

  const auth=await audienceFixture('mail-contact-erasure-public')
  const targetMail=await f.mail(first)
  await env.DB.prepare('INSERT INTO local_mail_outbox(delivery_id,message_json,created_at) VALUES(?,?,?)').bind(targetMail[0].delivery_id,targetMail[0].message_json,new Date().toISOString()).run()
  await env.DB.prepare('INSERT INTO local_mail_outbox(delivery_id,message_json,created_at) VALUES(?,?,?)').bind(retained[0].delivery_id,retained[0].message_json,new Date().toISOString()).run()
  const before=(await env.DB.prepare('SELECT count(*) n FROM rer_mail_development_outbox').first<{n:number}>())!.n
    +(await env.DB.prepare('SELECT count(*) n FROM local_mail_outbox').first<{n:number}>())!.n
  const erased=await auth.call(`/api/app/distribution/contacts/${f.contact.id}/erase`,'POST',{confirm:true})
  expect(erased.status).toBe(200)
  const receipt=await erased.json() as {completed:boolean;counts:{localMessages:number}}
  const after=(await env.DB.prepare('SELECT count(*) n FROM rer_mail_development_outbox').first<{n:number}>())!.n
    +(await env.DB.prepare('SELECT count(*) n FROM local_mail_outbox').first<{n:number}>())!.n
  expect(receipt).toMatchObject({completed:true,counts:{localMessages:5}})
  expect(receipt.counts.localMessages).toBe(before-after)
  expect(await env.DB.prepare("SELECT id FROM rer_mail_development_outbox WHERE json_extract(message,'$.deliveryId')=?").bind(notification!.idempotency_key).first()).toBeNull()
  expect((await env.DB.prepare('SELECT * FROM local_mail_outbox').all()).results).toEqual([expect.objectContaining({delivery_id:retained[0].delivery_id,message_json:retained[0].message_json})])
  expect(await env.DB.prepare("SELECT json_extract(details_json,'$.localMessages') n FROM audit_entries WHERE kind='contact.erased' ORDER BY created_at DESC LIMIT 1").first()).toEqual({n:receipt.counts.localMessages})

  await f.erasedParticipant(first)
  await f.erasedParticipant(second)
  expect(await f.mail(unrelated)).toEqual(retained)
  expect(await env.DB.prepare('SELECT id FROM distribution_contacts WHERE id = ?').bind(f.contact.id).first()).toBeNull()
  expect(await env.DB.prepare('SELECT id FROM responses WHERE id = ?').bind(response.responseId).first()).toBeNull()
  expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
}, 60_000)
