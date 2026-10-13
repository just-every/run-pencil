import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { afterEach, beforeAll, expect, vi } from 'vitest'
import { contract } from '../../src/test/contract'
import { notificationFixture } from './notifications-fixture'
import { archiveFixture, restoreFixture, snapshotFixture } from './archive-fixture'
import { initializePencil } from '../../src/core/app/worker'
import { createPencilPlatform } from '../../src/core/platform/runtime'
import { baseMailSender } from '../../src/core/platform/mail/base.server'
import { guardedDevelopmentOutbox } from '../../src/core/platform/mail/development.server'
import { notificationCaptureClaim } from '../../src/core/features/notifications/capture'

declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
let baseline: Awaited<ReturnType<typeof snapshotFixture>>
beforeAll(async () => {
  await applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__)
  await initializePencil(createPencilPlatform('http://localhost', env))
  baseline = await snapshotFixture(env.DB, __PENCIL_CORE_MIGRATIONS__)
})
afterEach(() => restoreFixture(env.DB, baseline))

async function refusesCapture(message: Parameters<ReturnType<typeof baseMailSender>['send']>[0]) {
  // Base deliberately exposes its stable public code, not storage diagnostics.
  await expect(baseMailSender({ kind: 'local-development' }, env.DB, notificationCaptureClaim).send(message)).rejects.toMatchObject({ code: 'development_outbox_failed' })
  await expect(guardedDevelopmentOutbox(env.DB, notificationCaptureClaim).put(message)).rejects.toThrow('no longer eligible')
}

contract(['DATA-001','BASE-DATA-001','NOTIFY-002','NOTIFY-004','DIST-010','DATA-002'], 'restored failed and unknown mail can be explicitly retried with their original key while every other restored delivery remains unarmed', async () => {
  const f = await notificationFixture('restored-notifications'), now = new Date().toISOString()
  const other = crypto.randomUUID()
  await env.DB.prepare('INSERT INTO operators(id,workspace_id,email,display_name,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(other, f.scope.workspaceId, 'other@example.test', 'Other operator', now, now).run()
  await f.services.notifications.preferences.set(f.scope.workspaceId, f.flow.flowId, other, 'immediately')
  const statuses = ['failed','unknown','pending','sent','cancelled','sending']
  const deliveries: Array<{ id: string; responseId: string; key: string; status: string; sessionToken: string }> = []
  for (const status of statuses) {
    const submission = await f.submit(), id = crypto.randomUUID(), key = `restored:${id}`
    deliveries.push({ id, responseId: submission.response.id, key, status, sessionToken: submission.session.sessionToken })
    await env.DB.prepare(`INSERT INTO notification_deliveries(id,response_id,operator_id,status,idempotency_key,attempts,explicit_retry_authorized,first_attempt_at,last_attempt_at,available_at,provider,provider_code,provider_id,reason,created_at,updated_at)
      VALUES(?,?,?,?,?,2,1,?,?,?,'sendgrid','RATE_LIMITED','receipt-before-restore','Retained provider reason',?,?)`).bind(id, submission.response.id, f.operatorId, status, key, now, now, now, now, now).run()
    await env.DB.prepare("INSERT INTO notification_attempts(id,delivery_id,ordinal,event,provider,provider_code,created_at) VALUES(?,?,2,?,'sendgrid','RATE_LIMITED',?)").bind(crypto.randomUUID(), id, status, now).run()
    if (status === 'sending') await env.DB.prepare("INSERT INTO notification_attempts(id,delivery_id,ordinal,event,created_at) VALUES(?,?,2,'started',?)").bind(crypto.randomUUID(), id, now).run()
    await env.DB.prepare("INSERT INTO notification_deliveries(id,response_id,operator_id,status,idempotency_key,attempts,available_at,created_at,updated_at) VALUES(?,?,?,'pending',?,1,?,?,?)").bind(crypto.randomUUID(), submission.response.id, other, `other:${id}`, now, now, now).run()
  }
  const historical = await f.submit(), quarantined = await f.submit(true), imported = await f.submit()
  await env.DB.prepare("UPDATE responses SET source='imported',notification_eligible=0 WHERE id=?").bind(imported.response.id).run()
  const archive = await archiveFixture(env.DB, __PENCIL_CORE_MIGRATIONS__)
  await restoreFixture(env.DB, archive)
  expect(await archiveFixture(env.DB, __PENCIL_CORE_MIGRATIONS__)).toEqual(archive)
  const rows = async () => (await env.DB.prepare('SELECT id,response_id,status,attempts,explicit_retry_authorized,provider,provider_code,provider_id,reason FROM notification_deliveries ORDER BY id').all()).results
  const before = await rows()
  expect(before.every(row => row.explicit_retry_authorized === 0)).toBe(true)
  const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Unexpected external request'))
  try {
    expect(await f.services.notifications.dispatcher.run(now)).toMatchObject({ attempted: 0 })
    expect(await rows()).toEqual(before)
    expect(await env.DB.prepare('SELECT count(*) n FROM rer_mail_development_outbox').first()).toEqual({ n: 0 })
    for (const status of ['failed','unknown']) {
      const item = deliveries.find(row => row.status === status)!
      await expect(f.services.notifications.preferences.retry(f.scope.workspaceId, other, item.id, true, now)).rejects.toThrow('not yours')
      if (status === 'unknown') {
        await expect(f.services.notifications.preferences.retry(f.scope.workspaceId, f.operatorId, item.id, false, now)).rejects.toThrow('duplicate')
        expect(await env.DB.prepare('SELECT status,explicit_retry_authorized FROM notification_deliveries WHERE id=?').bind(item.id).first()).toEqual({ status: 'unknown', explicit_retry_authorized: 0 })
      }
      await f.services.notifications.preferences.retry(f.scope.workspaceId, f.operatorId, item.id, status === 'unknown', now)
      expect(await env.DB.prepare('SELECT idempotency_key,attempts,provider_id,explicit_retry_authorized FROM notification_deliveries WHERE id=?').bind(item.id).first()).toEqual({ idempotency_key: item.key, attempts: 2, provider_id: 'receipt-before-restore', explicit_retry_authorized: 1 })
      expect(await f.services.notifications.dispatcher.run(now)).toMatchObject({ attempted: 1 })
      const captured = await env.DB.prepare("SELECT message FROM rer_mail_development_outbox WHERE json_extract(message,'$.deliveryId')=?").bind(item.key).all<{ message: string }>()
      expect(captured.results).toHaveLength(1)
      const message = JSON.parse(captured.results[0].message)
      const claim = await env.DB.prepare("SELECT id,ordinal FROM notification_attempts WHERE delivery_id=? AND ordinal=3 AND event='started'").bind(item.id).first<{ id: string; ordinal: number }>()
      expect(claim).toMatchObject({ id: expect.any(String), ordinal: 3 })
      expect(message).toMatchObject({ deliveryId: item.key, to: [`${f.slug}@operator.example.test`], headers: { 'Auto-Submitted': 'auto-generated', 'X-Pencil-Notification-Attempt': String(claim!.ordinal), 'X-Pencil-Notification-Claim': claim!.id } })
      expect(message.text).toContain(`/app/flows/${f.flow.flowId}/results`)
      expect(captured.results[0].message).not.toContain('DISTINCTIVE-PRIVATE-ANSWER')
      expect(captured.results[0].message).not.toContain(item.sessionToken)
      const unarmed = deliveries.find(row => row.status === 'sending')!
      const unarmedClaim = await env.DB.prepare("SELECT id,ordinal FROM notification_attempts WHERE delivery_id=? AND ordinal=2 AND event='started'").bind(unarmed.id).first<{ id: string; ordinal: number }>()
      expect(unarmedClaim).toMatchObject({ id: expect.any(String), ordinal: 2 })
      await refusesCapture({ ...message, deliveryId: unarmed.key, headers: { ...message.headers, 'X-Pencil-Notification-Attempt': String(unarmedClaim!.ordinal), 'X-Pencil-Notification-Claim': unarmedClaim!.id } })
      expect(await env.DB.prepare("SELECT sequence FROM rer_mail_development_outbox WHERE json_extract(message,'$.deliveryId')=?").bind(unarmed.key).first()).toBeNull()
      expect(await env.DB.prepare('SELECT status,attempts FROM notification_deliveries WHERE id=?').bind(item.id).first()).toEqual({ status: 'sent', attempts: 3 })
      expect((await env.DB.prepare("SELECT event,provider,provider_code FROM notification_attempts WHERE delivery_id=? AND ordinal=2 AND event=?").bind(item.id, status).all()).results).toEqual([{ event: status, provider: 'sendgrid', provider_code: 'RATE_LIMITED' }])
      await f.services.responses.eraseReleasedResponse({ ...f.scope, responseId: item.responseId, operatorId: f.operatorId })
      await refusesCapture(message)
      expect(await env.DB.prepare("SELECT sequence FROM rer_mail_development_outbox WHERE json_extract(message,'$.deliveryId')=?").bind(item.key).first()).toBeNull()
      expect(await env.DB.prepare('SELECT id FROM notification_attempts WHERE delivery_id=?').bind(item.id).first()).toBeNull()
    }
    const untouched = before.filter(row => !deliveries.slice(0, 2).some(item => row.response_id === item.responseId))
    // Erasure also removes the other operator's pending delivery for that response.
    const remaining = await rows()
    expect(remaining.every(row => row.explicit_retry_authorized === 0)).toBe(true)
    expect(remaining).toEqual(untouched)
    expect(remaining).toHaveLength(8)
    expect(await env.DB.prepare('SELECT count(*) n FROM responses WHERE notification_eligible<>0').first()).toEqual({ n: 0 })
    expect(await env.DB.prepare('SELECT count(*) n FROM response_outbox WHERE notification_eligible<>0').first()).toEqual({ n: 0 })
    for (const submission of [historical, quarantined, imported]) expect(await env.DB.prepare('SELECT id FROM notification_deliveries WHERE response_id=?').bind(submission.response.id).first()).toBeNull()
    expect(await f.services.notifications.dispatcher.run(now)).toMatchObject({ attempted: 0 })
    expect(fetch).not.toHaveBeenCalled()
  } finally { fetch.mockRestore() }
})

contract(['NOTIFY-002','DATA-002'], 'erasure revokes an explicitly authorized restored retry before it can reach the Base capture transaction', async () => {
  const f = await notificationFixture('restored-retry-erasure'), submission = await f.submit(), now = new Date().toISOString(), id = crypto.randomUUID()
  await env.DB.prepare("INSERT INTO notification_deliveries(id,response_id,operator_id,status,idempotency_key,attempts,available_at,created_at,updated_at) VALUES(?,?,?,'failed',?,1,?,?,?)").bind(id, submission.response.id, f.operatorId, `restored:${id}`, now, now, now).run()
  const archive = await archiveFixture(env.DB, __PENCIL_CORE_MIGRATIONS__)
  await restoreFixture(env.DB, archive)
  await f.services.notifications.preferences.retry(f.scope.workspaceId, f.operatorId, id, false, now)
  expect(await env.DB.prepare('SELECT explicit_retry_authorized FROM notification_deliveries WHERE id=?').bind(id).first()).toEqual({ explicit_retry_authorized: 1 })
  await f.services.responses.eraseReleasedResponse({ ...f.scope, responseId: submission.response.id, operatorId: f.operatorId })
  const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Unexpected external request'))
  try {
    expect(await f.services.notifications.dispatcher.run(now)).toMatchObject({ attempted: 0 })
    expect(await env.DB.prepare('SELECT id FROM notification_deliveries WHERE id=?').bind(id).first()).toBeNull()
    expect(await env.DB.prepare('SELECT id FROM notification_attempts WHERE delivery_id=?').bind(id).first()).toBeNull()
    expect(await env.DB.prepare('SELECT count(*) n FROM rer_mail_development_outbox').first()).toEqual({ n: 0 })
    expect(fetch).not.toHaveBeenCalled()
  } finally { fetch.mockRestore() }
})
