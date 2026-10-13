import { expect, vi } from 'vitest'
import { NotificationDispatcher } from '../../src/core/features/notifications/dispatcher'
import { NotificationRepository } from '../../src/core/features/notifications/repository'
import { baseMailSender } from '../../src/core/platform/mail/base.server'
import { notificationCaptureClaim } from '../../src/core/features/notifications/capture'
import { notificationMetadataGuards } from './notification-preparation-data'
import type { MailSender } from '../../src/base/operator-auth/index.mjs'

type Fixture = { db: D1Database; workspaceId: string; flowId: string; operatorId: string; responseId: string; now: string; erase: () => Promise<unknown> }

export async function checkNotificationConfigurationHistory(fixture: (name: string) => Promise<Fixture>) {
  const f = await fixture('configuration-history'), { db } = f
  await notificationMetadataGuards(f)
  const otherPreferences = (await db.prepare("SELECT * FROM notification_preferences WHERE operator_id<>? AND mode='off' ORDER BY flow_id,operator_id").bind(f.operatorId).all()).results
  const participants = (await db.prepare('SELECT id,delivery_status FROM invitation_participants ORDER BY id').all()).results
  expect(otherPreferences.length).toBeGreaterThan(0)
  expect(participants.length).toBeGreaterThan(0)
  const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('External requests are not expected'))
  const nativeSender = baseMailSender({ kind: 'local-development' }, db, notificationCaptureClaim)
  const send = vi.fn<MailSender['send']>().mockResolvedValueOnce({ status: 'uncertain', provider: 'sendgrid', providerMessageId: null, code: 'transport_uncertain' })
    .mockImplementation(message => nativeSender.send(message))
  const dispatcher = new NotificationDispatcher(db, { send }, 'https://forms.example.test', 'no-reply@example.test')
  const senderError = 'Notification mail disabled: MAIL_API_KEY failed Base mail validation (invalid_api_key).'
  const disabled = new NotificationDispatcher(db, { send }, 'https://forms.example.test', 'no-reply@example.test', undefined, senderError)
  const repository = new NotificationRepository(db), disabledRepository = new NotificationRepository(db, senderError)
  const delivery = () => db.prepare('SELECT id,status,attempts,idempotency_key,reason,provider,provider_code FROM notification_deliveries WHERE response_id=? AND operator_id=?')
    .bind(f.responseId, f.operatorId).first<{id:string;status:string;attempts:number;idempotency_key:string}>()
  try {
    expect(await dispatcher.run(f.now)).toEqual({ attempted: 1, senderError: null })
    const initial = (await delivery())!
    expect(initial).toMatchObject({ status: 'unknown', attempts: 1, provider: 'sendgrid', provider_code: 'transport_uncertain' })
    const later = new Date(Date.parse(f.now) + 2 * 86400_000).toISOString()
    await repository.retry(f.workspaceId, f.operatorId, initial.id, true, later)
    expect(await disabled.run(later)).toEqual({ attempted: 0, senderError })
    const blocked = (await delivery())!
    expect(blocked).toEqual({ ...initial, reason: `${senderError} An earlier delivery outcome remains unknown. Automatic resend is disabled; sending again requires duplicate-risk confirmation.` })
    const state = await disabledRepository.read(f.workspaceId, f.flowId, f.operatorId)
    expect(state).toMatchObject({ senderError, failureReason: senderError, mode: 'immediately' })
    expect(state.deliveries.find(row => row.id === initial.id)).toMatchObject({ status: 'unknown', attempts: 1 })
    await expect(disabledRepository.retry(f.workspaceId, f.operatorId, initial.id, true, later)).rejects.toThrow('MAIL_API_KEY')
    await expect(repository.retry(f.workspaceId, f.operatorId, initial.id, false, later)).rejects.toThrow('duplicate')
    expect(await dispatcher.run(later)).toEqual({ attempted: 0, senderError: null })
    expect(await delivery()).toEqual(blocked)
    expect(send).toHaveBeenCalledTimes(1)
    const history = (await db.prepare('SELECT ordinal,event,provider,provider_code FROM notification_attempts WHERE delivery_id=? ORDER BY rowid').bind(initial.id).all()).results
    expect(history).toEqual([
      { ordinal: 1, event: 'started', provider: null, provider_code: null },
      { ordinal: 1, event: 'unknown', provider: 'sendgrid', provider_code: 'transport_uncertain' },
      { ordinal: 1, event: 'operator-retry', provider: null, provider_code: null },
    ])
    // An explicit retry remains valid beyond the automatic one-hour window.
    await repository.retry(f.workspaceId, f.operatorId, initial.id, true, later)
    expect(await dispatcher.run(later)).toEqual({ attempted: 1, senderError: null })
    expect(send).toHaveBeenCalledTimes(2)
    expect(send.mock.calls.every(([message]) => message.deliveryId === initial.idempotency_key)).toBe(true)
    expect(await delivery()).toMatchObject({ status: 'sent', attempts: 2, idempotency_key: initial.idempotency_key, reason: null })
    expect((await db.prepare('SELECT ordinal,event,provider,provider_code FROM notification_attempts WHERE delivery_id=? ORDER BY rowid').bind(initial.id).all()).results).toEqual([
      ...history,
      { ordinal: 1, event: 'operator-retry', provider: null, provider_code: null },
      { ordinal: 2, event: 'started', provider: null, provider_code: null },
      { ordinal: 2, event: 'sent', provider: 'development', provider_code: null },
    ])
    expect((await repository.read(f.workspaceId, f.flowId, f.operatorId)).failureReason).toBeNull()
    expect((await db.prepare("SELECT * FROM notification_preferences WHERE operator_id<>? AND mode='off' ORDER BY flow_id,operator_id").bind(f.operatorId).all()).results).toEqual(otherPreferences)
    expect((await db.prepare('SELECT id,delivery_status FROM invitation_participants ORDER BY id').all()).results).toEqual(participants)
    expect(await db.prepare('SELECT id FROM responses WHERE id=?').bind(f.responseId).first()).toEqual({ id: f.responseId })
    await f.erase()
    expect(await delivery()).toBeNull()
    expect((await db.prepare('SELECT id FROM notification_attempts WHERE delivery_id=?').bind(initial.id).all()).results).toEqual([])
    expect((await db.prepare("SELECT id FROM rer_mail_development_outbox WHERE json_extract(message,'$.deliveryId')=?").bind(initial.idempotency_key).all()).results).toEqual([])
    expect(fetch).not.toHaveBeenCalled()
  } finally { fetch.mockRestore() }
}
