import { applyD1Migrations, type D1Migration } from 'cloudflare:test'
import { DistributionDispatcher } from '../../../src/core/features/distribution/dispatcher'
import { MailDeliveries } from '../../../src/core/features/distribution/deliveries'
import { baseMailSender } from '../../../src/core/platform/mail/base.server'

export async function dispatchQueuedLegacyRetry(db: D1Database, previous: D1Migration[], fixture: string[], current: D1Migration[]) {
  await applyD1Migrations(db, previous)
  await db.batch(fixture.map(query => db.prepare(query)))

  const deliveryId = 'upgrade-delivery-2'
  const queuedAt = '2026-10-13T00:00:00.000Z'
  const firstAttempt = '2026-10-12T00:00:00.000Z'
  // Keep this invitation's independent follow-up reminder outside the drain window.
  await db.prepare("UPDATE invitation_launches SET policy_json=json_set(policy_json,'$.reminderDelayHours',48) WHERE id='upgrade-launch-2'").run()
  await db.batch([
    db.prepare(`UPDATE mail_deliveries SET status='pending', available_at=?, first_attempt_at=?, last_attempt_at=?, attempts=4,
      provider_id=NULL, reason=NULL, updated_at=? WHERE id=?`).bind(queuedAt, firstAttempt, '2026-10-12T00:30:01.000Z', queuedAt, deliveryId),
    db.prepare("UPDATE mail_delivery_attempts SET event='transient', reason='Synthetic transient failure', provider_id=NULL, created_at='2026-10-12T00:00:01.000Z' WHERE id='upgrade-attempt-2'"),
    ...[1, 2, 3, 4].flatMap(ordinal => {
      const minute = String((ordinal - 1) * 10).padStart(2, '0')
      const startedAt = `2026-10-12T00:${minute}:00.000Z`
      if (ordinal === 1) return [db.prepare(`INSERT INTO mail_delivery_attempts (id,delivery_id,ordinal,event,created_at)
        VALUES ('upgrade-retry-started-1',?,1,'started',?)`).bind(deliveryId, startedAt)]
      const outcomeAt = `2026-10-12T00:${minute}:01.000Z`
      return [
        db.prepare(`INSERT INTO mail_delivery_attempts (id,delivery_id,ordinal,event,created_at) VALUES (?,?,?,'started',?)`)
          .bind(`upgrade-retry-started-${ordinal}`, deliveryId, ordinal, startedAt),
        db.prepare(`INSERT INTO mail_delivery_attempts (id,delivery_id,ordinal,event,reason,created_at) VALUES (?,?,?,'transient','Synthetic transient failure',?)`)
          .bind(`upgrade-retry-transient-${ordinal}`, deliveryId, ordinal, outcomeAt),
      ]
    }),
    db.prepare(`INSERT INTO mail_delivery_attempts (id,delivery_id,ordinal,event,actor_operator_id,reason,created_at)
      VALUES ('upgrade-operator-retry-4',?,4,'operator-retry','upgrade-operator-1','Explicit retry queued before the upgrade',?)`).bind(deliveryId, queuedAt),
  ])
  const historyBefore = (await db.prepare('SELECT id,ordinal,event FROM mail_delivery_attempts WHERE delivery_id=? ORDER BY id')
    .bind(deliveryId).all<{ id: string; ordinal: number; event: string }>()).results

  await applyD1Migrations(db, current)
  const dispatcher = new DistributionDispatcher(db, new MailDeliveries(db), baseMailSender({ kind: 'local-development' }, db),
    'https://example.test', 'no-reply@example.test')
  const concurrentDrains = await Promise.all(Array.from({ length: 4 }, () => dispatcher.run(queuedAt)))
  const repeatedDrains = await Promise.all(Array.from({ length: 3 }, () => dispatcher.run(queuedAt)))
  const delivery = await db.prepare('SELECT status,attempts,first_attempt_at,last_attempt_at,idempotency_key FROM mail_deliveries WHERE id=?')
    .bind(deliveryId).first()
  const historyAfter = (await db.prepare('SELECT id,ordinal,event FROM mail_delivery_attempts WHERE delivery_id=? ORDER BY id')
    .bind(deliveryId).all<{ id: string; ordinal: number; event: string }>()).results
  const captured = (await db.prepare("SELECT message FROM rer_mail_development_outbox WHERE json_extract(message,'$.deliveryId')=?")
    .bind('upgrade-delivery-key-2').all<{ message: string }>()).results
  console.log('Queued predecessor operator retry after migration:', JSON.stringify({
    concurrentDispatcherAttempts: concurrentDrains.reduce((sum, result) => sum + result.attempted, 0),
    repeatedDispatcherAttempts: repeatedDrains.reduce((sum, result) => sum + result.attempted, 0),
    delivery,
    preservedAttemptRows: historyBefore.length,
    attemptRowsAfterSend: historyAfter.length,
    capturedMessages: captured.length,
  }))
  return { concurrentDrains, repeatedDrains, delivery, historyBefore, historyAfter, captured }
}
