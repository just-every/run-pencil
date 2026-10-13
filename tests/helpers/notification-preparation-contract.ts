import { expect, vi } from 'vitest'
import { notificationMetadataGuards } from './notification-preparation-data'
import { NotificationDispatcher } from '../../src/core/features/notifications/dispatcher'
import { NotificationRepository } from '../../src/core/features/notifications/repository'
import { readNotificationBrand } from '../../src/core/features/notifications/brand.server'
import { baseMailSender } from '../../src/core/platform/mail/base.server'
import { notificationCaptureClaim } from '../../src/core/features/notifications/capture'
import type { MailSender } from '../../src/base/operator-auth/index.mjs'

type Fixture = { db: D1Database; workspaceId: string; flowId: string; operatorId: string; responseId: string; now: string; erase: () => Promise<unknown> }
const reasons = {
  brand: 'Notification not sent: business branding could not be read or validated.',
  composition: 'Notification not sent: message composition failed.',
  eligibility: 'Notification not sent: delivery eligibility could not be checked.',
}
const privateError = 'DISTINCTIVE-PRIVATE-ANSWER respondent@example.test business-logo'
const logoBytes = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jU1sAAAAASUVORK5CYII='

/** Exercise the same dispatch guarantees against SQLite and native Workers D1. */
export async function checkNotificationPreparation(fixture: (name: string) => Promise<Fixture>, failure: 'brand' | 'composition' | 'eligibility' | 'thrown sender' | 'uncertain sender') {
  const f = await fixture(failure.replaceAll(' ', '-')), { db } = f
  await notificationMetadataGuards(f)
  let broken = true
  const ambiguous = failure === 'thrown sender' || failure === 'uncertain sender'
  const beforeParticipants = (await db.prepare('SELECT id,delivery_status FROM invitation_participants ORDER BY id').all()).results
  const otherPreferences = (await db.prepare('SELECT * FROM notification_preferences WHERE operator_id<>? ORDER BY flow_id,operator_id').bind(f.operatorId).all()).results
  expect(beforeParticipants.length).toBeGreaterThan(0)
  expect(otherPreferences.length).toBeGreaterThan(0)
  const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('External requests are not expected'))
  const nativeSender = baseMailSender({ kind: 'local-development' }, db, notificationCaptureClaim)
  const observedClaims: unknown[] = []
  const send = vi.fn<MailSender['send']>(async message => {
    const claim = await db.prepare(`SELECT d.status,d.attempts,a.event FROM notification_deliveries d
      JOIN notification_attempts a ON a.id=? AND a.delivery_id=d.id AND a.ordinal=d.attempts WHERE d.idempotency_key=?`).bind(message.headers!['X-Pencil-Notification-Claim'], message.deliveryId).first()
    observedClaims.push(claim)
    if (broken && failure === 'thrown sender') throw new Error(privateError)
    if (broken && failure === 'uncertain sender') return { status: 'uncertain', provider: 'sendgrid', providerMessageId: null, code: 'transport_uncertain' }
    return nativeSender.send(message)
  })
  const checkedDb = new Proxy(db, { get(target, key) {
    if (key === 'prepare') return (sql: string) => {
      if (broken && failure === 'eligibility' && sql.startsWith('SELECT d.id FROM notification_deliveries d JOIN responses')) throw new Error(privateError)
      return target.prepare(sql)
    }
    const member = Reflect.get(target, key)
    return typeof member === 'function' ? member.bind(target) : member
  } })
  const dispatcher = new NotificationDispatcher(checkedDb, { send }, 'https://forms.example.test', 'no-reply@example.test', async workspaceId => {
    if (broken && failure === 'brand') throw new Error(privateError)
    const brand = { ...await readNotificationBrand(db, workspaceId), supportingLine: 'business-logo', logo: { content: Uint8Array.from(atob(logoBytes), character => character.charCodeAt(0)), contentType: 'image/png' } }
    return broken && failure === 'composition' ? { ...brand, accentColor: 'invalid' } : brand
  })
  const repository = new NotificationRepository(db)
  const delivery = () => db.prepare('SELECT id,status,attempts,idempotency_key,reason,provider,provider_code FROM notification_deliveries WHERE response_id=? AND operator_id=?').bind(f.responseId, f.operatorId).first<{ id: string; status: string; attempts: number; idempotency_key: string; reason: string; provider: string | null; provider_code: string | null }>()
  try {
    expect(await dispatcher.run(f.now)).toEqual({ attempted: 1, senderError: null })
    const row = (await delivery())!
    expect(row).toMatchObject({ status: ambiguous ? 'unknown' : 'failed', attempts: 1 })
    if (!ambiguous) expect(row).toMatchObject({ reason: reasons[failure as keyof typeof reasons], provider: null, provider_code: null })
    if (failure === 'thrown sender') expect(row).toMatchObject({ provider: null, provider_code: null })
    if (failure === 'uncertain sender') expect(row).toMatchObject({ provider: 'sendgrid', provider_code: 'transport_uncertain' })
    expect(row.reason.includes(privateError)).toBe(false)
    expect(row.reason.includes('respondent@example.test')).toBe(false)
    expect(row.reason.includes(logoBytes)).toBe(false)
    expect((await db.prepare("SELECT message FROM rer_mail_development_outbox WHERE json_extract(message,'$.deliveryId')=?").bind(row.idempotency_key).all()).results).toEqual([])
    expect((await repository.read(f.workspaceId, f.flowId, f.operatorId)).failureReason).toBe(row.reason)
    expect((await db.prepare('SELECT ordinal,event FROM notification_attempts WHERE delivery_id=? ORDER BY rowid').bind(row.id).all()).results)
      .toEqual([{ ordinal: 1, event: 'started' }, { ordinal: 1, event: ambiguous ? 'unknown' : `preparation-${failure}-failed` }])
    expect(send).toHaveBeenCalledTimes(ambiguous ? 1 : 0)
    expect(observedClaims).toEqual(ambiguous ? [{ status: 'sending', attempts: 1, event: 'started' }] : [])
    broken = false
    const later = new Date(Date.parse(f.now) + 2 * 86400_000).toISOString()
    expect(await dispatcher.run(later)).toEqual({ attempted: 0, senderError: null })
    expect(await delivery()).toEqual(row)
    expect(send).toHaveBeenCalledTimes(ambiguous ? 1 : 0)
    if (ambiguous) await expect(repository.retry(f.workspaceId, f.operatorId, row.id, false, later)).rejects.toThrow('duplicate')
    await repository.retry(f.workspaceId, f.operatorId, row.id, ambiguous, later)
    expect(await dispatcher.run(later)).toEqual({ attempted: 1, senderError: null })
    expect(send).toHaveBeenCalledTimes(ambiguous ? 2 : 1)
    expect(observedClaims).toEqual([...(ambiguous ? [{ status: 'sending', attempts: 1, event: 'started' }] : []), { status: 'sending', attempts: 2, event: 'started' }])
    expect(send.mock.calls.every(([message]) => message.deliveryId === row.idempotency_key)).toBe(true)
    expect(await delivery()).toMatchObject({ status: 'sent', attempts: 2, idempotency_key: row.idempotency_key, reason: null })
    expect((await db.prepare('SELECT ordinal,event FROM notification_attempts WHERE delivery_id=? ORDER BY rowid').bind(row.id).all()).results)
      .toEqual([{ ordinal: 1, event: 'started' }, { ordinal: 1, event: ambiguous ? 'unknown' : `preparation-${failure}-failed` }, { ordinal: 1, event: 'operator-retry' }, { ordinal: 2, event: 'started' }, { ordinal: 2, event: 'sent' }])
    expect((await repository.read(f.workspaceId, f.flowId, f.operatorId)).failureReason).toBeNull()
    expect((await db.prepare('SELECT id,delivery_status FROM invitation_participants ORDER BY id').all()).results).toEqual(beforeParticipants)
    expect((await db.prepare('SELECT * FROM notification_preferences WHERE operator_id<>? ORDER BY flow_id,operator_id').bind(f.operatorId).all()).results).toEqual(otherPreferences)
    const metadata = JSON.stringify(await db.prepare('SELECT * FROM notification_attempts WHERE delivery_id=?').bind(row.id).all()) + JSON.stringify(await repository.read(f.workspaceId, f.flowId, f.operatorId))
    expect(metadata.includes(privateError)).toBe(false)
    expect(metadata.includes('DISTINCTIVE-PRIVATE-ANSWER')).toBe(false)
    expect(metadata.includes('business-logo')).toBe(false)
    expect(metadata.includes('respondent@example.test')).toBe(false)
    expect(metadata.includes(logoBytes)).toBe(false)
    expect(fetch).not.toHaveBeenCalled()
  } finally { fetch.mockRestore() }
}
export async function checkNotificationErasure(fixture: (name: string) => Promise<Fixture>) {
  const f = await fixture('preparation-erasure'), send = vi.fn(), fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('External requests are not expected'))
  const dispatcher = new NotificationDispatcher(f.db, { send }, 'https://forms.example.test', 'no-reply@example.test', async workspaceId => {
    expect(await f.db.prepare("SELECT count(*) n FROM notification_attempts a JOIN notification_deliveries d ON d.id=a.delivery_id WHERE d.response_id=? AND a.event='started'").bind(f.responseId).first()).toEqual({ n: 1 })
    await f.erase()
    return readNotificationBrand(f.db, workspaceId)
  })
  try {
    expect(await dispatcher.run(f.now)).toEqual({ attempted: 1, senderError: null })
    expect(await dispatcher.run(f.now)).toEqual({ attempted: 0, senderError: null })
    expect(await f.db.prepare('SELECT id FROM notification_deliveries WHERE response_id=?').bind(f.responseId).first()).toBeNull()
    expect(await f.db.prepare('SELECT id FROM responses WHERE id=?').bind(f.responseId).first()).toBeNull()
    expect(send).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  } finally { fetch.mockRestore() }
}
