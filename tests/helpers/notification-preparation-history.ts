import { expect, vi } from 'vitest'
import { notificationMetadataGuards } from './notification-preparation-data'
import { NotificationDispatcher } from '../../src/core/features/notifications/dispatcher'
import { NotificationRepository } from '../../src/core/features/notifications/repository'
import { readNotificationBrand } from '../../src/core/features/notifications/brand.server'
import { baseMailSender } from '../../src/core/platform/mail/base.server'
import { notificationCaptureClaim } from '../../src/core/features/notifications/capture'
import type { MailSender } from '../../src/base/operator-auth/index.mjs'

type Fixture = { db: D1Database; workspaceId: string; flowId: string; operatorId: string; responseId: string; now: string; erase: () => Promise<unknown> }
type Failure = 'brand' | 'composition' | 'eligibility'
const reasons = {
  brand: 'Notification not sent: business branding could not be read or validated.',
  composition: 'Notification not sent: message composition failed.',
  eligibility: 'Notification not sent: delivery eligibility could not be checked.',
}

/** A local retry failure cannot reconcile the first transport's unknown result. */
export async function checkNotificationPreparationHistory(fixture: (name: string) => Promise<Fixture>, failure: Failure) {
  const f = await fixture(`history-${failure}`), { db } = f
  await notificationMetadataGuards(f)
  const otherPreferences = (await db.prepare('SELECT * FROM notification_preferences WHERE operator_id<>? ORDER BY flow_id,operator_id').bind(f.operatorId).all()).results
  const participants = (await db.prepare('SELECT id,delivery_status FROM invitation_participants ORDER BY id').all()).results
  expect(otherPreferences.length).toBeGreaterThan(0)
  expect(participants.length).toBeGreaterThan(0)
  let stage: 'uncertain' | 'broken' | 'repaired' = 'uncertain'
  const privateError = 'DISTINCTIVE-PRIVATE-ANSWER respondent@example.test business-logo'
  const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('External requests are not expected'))
  const nativeSender = baseMailSender({ kind: 'local-development' }, db, notificationCaptureClaim)
  const send = vi.fn<MailSender['send']>(async message => {
    expect(message.headers?.['Auto-Submitted']).toBe('auto-generated')
    expect(message.from).toBe('no-reply@example.test')
    expect(JSON.stringify(message).includes('DISTINCTIVE-PRIVATE-ANSWER')).toBe(false)
    expect(JSON.stringify(message).includes('respondent@example.test')).toBe(false)
    expect(await db.prepare(`SELECT d.status,d.attempts,a.event FROM notification_deliveries d
      JOIN notification_attempts a ON a.id=? AND a.delivery_id=d.id AND a.ordinal=d.attempts WHERE d.idempotency_key=?`)
      .bind(message.headers!['X-Pencil-Notification-Claim'], message.deliveryId).first())
      .toEqual({ status: 'sending', attempts: stage === 'uncertain' ? 1 : 3, event: 'started' })
    if (stage === 'uncertain') return { status: 'uncertain', provider: 'sendgrid', providerMessageId: null, code: 'transport_uncertain' }
    return nativeSender.send(message)
  })
  const checkedDb = new Proxy(db, { get(target, key) {
    if (key === 'prepare') return (sql: string) => {
      if (stage === 'broken' && failure === 'eligibility' && sql.startsWith('SELECT d.id FROM notification_deliveries d JOIN responses')) throw new Error(privateError)
      return target.prepare(sql)
    }
    const member = Reflect.get(target, key)
    return typeof member === 'function' ? member.bind(target) : member
  } })
  const dispatcher = new NotificationDispatcher(checkedDb, { send }, 'https://forms.example.test', 'no-reply@example.test', async workspaceId => {
    if (stage === 'broken' && failure === 'brand') throw new Error(privateError)
    const brand = await readNotificationBrand(db, workspaceId)
    return stage === 'broken' && failure === 'composition' ? { ...brand, accentColor: privateError } : brand
  })
  const repository = new NotificationRepository(db)
  const delivery = () => db.prepare('SELECT id,status,attempts,idempotency_key,reason,provider,provider_code FROM notification_deliveries WHERE response_id=? AND operator_id=?')
    .bind(f.responseId, f.operatorId).first<{id:string;status:string;attempts:number;idempotency_key:string;reason:string}>()
  try {
    expect(await dispatcher.run(f.now)).toEqual({ attempted: 1, senderError: null })
    const initial = (await delivery())!
    expect(initial).toMatchObject({ status: 'unknown', attempts: 1, provider: 'sendgrid', provider_code: 'transport_uncertain' })
    stage = 'broken'
    await expect(repository.retry(f.workspaceId, f.operatorId, initial.id, false, f.now)).rejects.toThrow('duplicate')
    await repository.retry(f.workspaceId, f.operatorId, initial.id, true, f.now)
    expect(await dispatcher.run(f.now)).toEqual({ attempted: 1, senderError: null })
    const failedRetry = (await delivery())!
    expect(failedRetry).toMatchObject({ status: 'unknown', attempts: 2, provider: null, provider_code: null,
      reason: `Attempt 2: ${reasons[failure]} An earlier delivery outcome remains unknown. Automatic resend is disabled; sending again requires duplicate-risk confirmation.` })
    expect((await repository.read(f.workspaceId, f.flowId, f.operatorId)).failureReason).toBe(failedRetry.reason)
    const history = (await db.prepare('SELECT ordinal,event,provider,provider_code FROM notification_attempts WHERE delivery_id=? ORDER BY rowid').bind(initial.id).all()).results
    expect(history).toEqual([
      { ordinal: 1, event: 'started', provider: null, provider_code: null },
      { ordinal: 1, event: 'unknown', provider: 'sendgrid', provider_code: 'transport_uncertain' },
      { ordinal: 1, event: 'operator-retry', provider: null, provider_code: null },
      { ordinal: 2, event: 'started', provider: null, provider_code: null },
      { ordinal: 2, event: `preparation-${failure}-failed`, provider: null, provider_code: null },
    ])
    stage = 'repaired'
    const later = new Date(Date.parse(f.now) + 2 * 86400_000).toISOString()
    expect(await dispatcher.run(later)).toEqual({ attempted: 0, senderError: null })
    await expect(repository.retry(f.workspaceId, f.operatorId, initial.id, false, later)).rejects.toThrow('duplicate')
    expect(await delivery()).toEqual(failedRetry)
    expect((await db.prepare('SELECT ordinal,event,provider,provider_code FROM notification_attempts WHERE delivery_id=? ORDER BY rowid').bind(initial.id).all()).results).toEqual(history)
    expect(send).toHaveBeenCalledTimes(1)
    await repository.retry(f.workspaceId, f.operatorId, initial.id, true, later)
    expect(await dispatcher.run(later)).toEqual({ attempted: 1, senderError: null })
    expect(send).toHaveBeenCalledTimes(2)
    expect(send.mock.calls.every(([message]) => message.deliveryId === initial.idempotency_key)).toBe(true)
    expect(await delivery()).toMatchObject({ status: 'sent', attempts: 3, idempotency_key: initial.idempotency_key, reason: null })
    const finalHistory = (await db.prepare('SELECT ordinal,event,provider,provider_code FROM notification_attempts WHERE delivery_id=? ORDER BY rowid').bind(initial.id).all()).results
    expect(finalHistory.slice(0, history.length)).toEqual(history)
    expect(finalHistory.slice(history.length)).toEqual([
      { ordinal: 2, event: 'operator-retry', provider: null, provider_code: null },
      { ordinal: 3, event: 'started', provider: null, provider_code: null },
      { ordinal: 3, event: 'sent', provider: 'development', provider_code: null },
    ])
    expect((await repository.read(f.workspaceId, f.flowId, f.operatorId)).failureReason).toBeNull()
    expect((await db.prepare('SELECT * FROM notification_preferences WHERE operator_id<>? ORDER BY flow_id,operator_id').bind(f.operatorId).all()).results).toEqual(otherPreferences)
    expect((await db.prepare('SELECT id,delivery_status FROM invitation_participants ORDER BY id').all()).results).toEqual(participants)
    const metadata = JSON.stringify(finalHistory) + JSON.stringify(await repository.read(f.workspaceId, f.flowId, f.operatorId))
    for (const marker of ['DISTINCTIVE-PRIVATE-ANSWER', 'respondent@example.test', 'business-logo']) expect(metadata.includes(marker)).toBe(false)
    expect((await db.prepare("SELECT id FROM rer_mail_development_outbox WHERE json_extract(message,'$.deliveryId')=?").bind(initial.idempotency_key).all()).results).toHaveLength(1)
    await f.erase()
    expect(await delivery()).toBeNull()
    expect((await db.prepare('SELECT id FROM notification_attempts WHERE delivery_id=?').bind(initial.id).all()).results).toEqual([])
    expect((await db.prepare("SELECT id FROM rer_mail_development_outbox WHERE json_extract(message,'$.deliveryId')=?").bind(initial.idempotency_key).all()).results).toEqual([])
    expect(fetch).not.toHaveBeenCalled()
  } finally { fetch.mockRestore() }
}
