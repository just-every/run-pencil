import { ulid } from 'ulid'
import { demoEffect } from '../../../base/demo/index.mjs'
import { unsealValue } from '../../platform/config/sealing'
import { apiVersion, disableAfterFailures, disableAfterMilliseconds, headers, retryOffsetsMinutes, type EventType } from './model'
import { signBody } from './sign'
import { validateEndpointAddress } from './address'

const timeoutMilliseconds = 10_000
const abandonedAfterMilliseconds = 300_000
type Due = { id: string; endpointId: string; eventId: string; eventType: EventType; formId: string | null; revisionId: string | null; responseId: string | null; detail: string | null
  occurredAt: string; attempts: number; firstAttemptAt: string | null; url: string; sealedSecret: string; replayBase: number }

/**
 * Sends queued response events (INTEG-010). One signed JSON POST per attempt, no redirect followed, bounded time, response body ignored.
 * A claim is recorded before the request; a failed attempt is retried with growing backoff for 24 hours on the same event ID.
 * Delivery is at least once: receivers de-duplicate on the event ID.
 */
export class ResponseEventDispatcher {
  constructor(private readonly db: D1Database, private readonly sessionSecret: string, private readonly allowLoopbackHttp: boolean) {}

  async run(now = new Date().toISOString()) {
    // Requests and Cron both call this: with nothing queued it costs one indexed read.
    if (!await this.db.prepare("SELECT 1 FROM response_event_deliveries WHERE status IN ('pending','sending') LIMIT 1").first()) return { attempted: 0 }
    const stale = await this.db.prepare(`UPDATE response_event_deliveries SET status = 'pending', reason = 'The Worker stopped before the receiver answered; the event is sent again with the same event ID.', updated_at = ?
      WHERE id IN (SELECT id FROM response_event_deliveries WHERE status = 'sending' AND last_attempt_at <= ? LIMIT 50) RETURNING id, attempts`)
      .bind(now, new Date(Date.parse(now) - abandonedAfterMilliseconds).toISOString()).all<{ id: string; attempts: number }>()
    for (const row of stale.results) await this.db.prepare(`INSERT OR IGNORE INTO response_event_attempts (id, delivery_id, ordinal, event, outcome_class, created_at) VALUES (?, ?, ?, 'abandoned', 'abandoned', ?)`).bind(ulid(), row.id, row.attempts, now).run()
    const due = await this.db.prepare(`${this.selectDue} WHERE d.status = 'pending' AND d.available_at <= ? AND e.state = 'active' AND e.sealed_secret IS NOT NULL ORDER BY d.available_at, d.id LIMIT 50`).bind(now).all<Due>()
    let attempted = 0
    for (const row of due.results) if (await this.attempt(row, now)) attempted++
    if (attempted) await this.disableFailing(now)
    return { attempted }
  }

  /** Sends one queued event now (the endpoint test). */
  async sendNow(deliveryId: string, now = new Date().toISOString()) {
    const row = await this.db.prepare(`${this.selectDue} WHERE d.id = ? AND d.status = 'pending' AND e.sealed_secret IS NOT NULL`).bind(deliveryId).first<Due>()
    const attempted = row ? await this.attempt(row, now) : false
    await this.disableFailing(now)
    return attempted
  }

  /** Sustained failure: no confirmed delivery for 24 hours across at least ten failed attempts disables the endpoint and raises its alert. */
  private async disableFailing(now: string) {
    await this.db.prepare(`UPDATE response_webhook_endpoints SET state = 'disabled', disabled_at = ?, updated_at = ?,
      disabled_reason = 'No delivery was confirmed for 24 hours (' || failure_streak || ' failed attempts in a row). Fix the receiver, then resume the endpoint.'
      WHERE state = 'active' AND failure_streak >= ? AND failure_streak_started_at IS NOT NULL AND failure_streak_started_at <= ?`)
      .bind(now, now, disableAfterFailures, new Date(Date.parse(now) - disableAfterMilliseconds).toISOString()).run()
  }

  private readonly selectDue = `SELECT d.id, d.endpoint_id AS endpointId, d.event_id AS eventId, d.event_type AS eventType, d.flow_id AS formId, d.revision_id AS revisionId, d.response_id AS responseId, d.detail,
    d.occurred_at AS occurredAt, d.attempts, d.first_attempt_at AS firstAttemptAt, e.url, e.sealed_secret AS sealedSecret,
    (SELECT COALESCE(MAX(ordinal), 0) FROM response_event_attempts r WHERE r.delivery_id = d.id AND r.event = 'replay') AS replayBase
    FROM response_event_deliveries d JOIN response_webhook_endpoints e ON e.id = d.endpoint_id`

  private async attempt(row: Due, now: string) {
    if (row.firstAttemptAt && Date.parse(now) > Date.parse(row.firstAttemptAt) + 24 * 3_600_000 + 60_000) {
      await this.finish(row, now, row.attempts, { event: 'abandoned', reason: 'The 24-hour retry window ended without a confirmed delivery.', httpStatus: null, outcomeClass: 'expired' }, false)
      return false
    }
    const claim = ulid(), ordinal = row.attempts + 1
    const claimed = await this.db.batch([
      this.db.prepare(`INSERT INTO response_event_attempts (id, delivery_id, ordinal, event, created_at)
        SELECT ?, d.id, d.attempts + 1, 'started', ? FROM response_event_deliveries d JOIN response_webhook_endpoints e ON e.id = d.endpoint_id
        WHERE d.id = ? AND d.status = 'pending' AND d.attempts = ? AND d.available_at <= ? AND e.state = 'active'`).bind(claim, now, row.id, row.attempts, now),
      this.db.prepare(`UPDATE response_event_deliveries SET status = 'sending', attempts = attempts + 1, first_attempt_at = COALESCE(first_attempt_at, ?), last_attempt_at = ?, updated_at = ?
        WHERE id = ? AND status = 'pending' AND EXISTS (SELECT 1 FROM response_event_attempts WHERE id = ?)`).bind(now, now, now, row.id, claim),
    ])
    if (!claimed[1].meta.changes) return false
    const outcome = await this.send({ ...row, attempts: ordinal }, now)
    await this.finish({ ...row, firstAttemptAt: row.firstAttemptAt ?? now }, now, ordinal, outcome, true)
    return true
  }

  private async send(row: Due, now: string): Promise<{ event: 'confirmed' | 'failed'; reason: string | null; httpStatus: number | null; outcomeClass: string }> {
    let secret: string
    try { secret = await unsealValue<string>(this.sessionSecret, `webhook:${row.endpointId}`, row.sealedSecret) }
    catch { return { event: 'failed', reason: 'The signing secret cannot be unlocked. Rotate the endpoint secret.', httpStatus: null, outcomeClass: 'secret' } }
    let url: URL
    try { url = validateEndpointAddress(row.url, this.allowLoopbackHttp) } catch { return { event: 'failed', reason: 'The endpoint address is not allowed.', httpStatus: null, outcomeClass: 'refused' } }
    // Identifiers only: no answer value, respondent identity or contact detail ever leaves in an event.
    const body = JSON.stringify({
      id: row.eventId, type: row.eventType, apiVersion, occurredAt: row.occurredAt, sentAt: now, attempt: row.attempts - row.replayBase,
      formId: row.formId, revisionId: row.revisionId, responseId: row.responseId, ...(row.eventType === 'payment.changed' ? { payment: { state: row.detail } } : {}),
    })
    try {
      const response = await demoEffect(async () => fetch(url, {
        method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(timeoutMilliseconds), body,
        headers: { 'content-type': 'application/json', 'user-agent': 'Pencil-Webhooks/1', [headers.eventId]: row.eventId, [headers.eventType]: row.eventType,
          [headers.timestamp]: String(Math.floor(Date.parse(now) / 1000)), [headers.signature]: await signBody(secret, body) },
      }), () => new Response(null, { status: 204 }))
      await response.body?.cancel().catch(() => undefined)
      if (response.status >= 200 && response.status < 300) return { event: 'confirmed', reason: null, httpStatus: response.status, outcomeClass: '2xx' }
      const outcomeClass = response.status >= 500 ? '5xx' : response.status >= 400 ? '4xx' : '3xx'
      return { event: 'failed', reason: `The receiver answered ${response.status}.`, httpStatus: response.status, outcomeClass }
    } catch (error) {
      const timeout = error instanceof Error && error.name === 'TimeoutError'
      return { event: 'failed', reason: timeout ? 'The receiver did not answer in time.' : 'The receiver could not be reached.', httpStatus: null, outcomeClass: timeout ? 'timeout' : 'network' }
    }
  }

  private async finish(row: Due, now: string, ordinal: number, outcome: { event: 'confirmed' | 'failed' | 'abandoned'; reason: string | null; httpStatus: number | null; outcomeClass: string }, recorded: boolean) {
    const since = ordinal - row.replayBase
    const retryAt = outcome.event === 'failed' && since <= retryOffsetsMinutes.length && row.firstAttemptAt
      ? new Date(Date.parse(row.firstAttemptAt) + retryOffsetsMinutes[since - 1] * 60_000).toISOString() : null
    const status = outcome.event === 'confirmed' ? 'confirmed' : retryAt ? 'pending' : 'failed'
    const reason = status === 'failed' ? `${outcome.reason ?? 'The delivery failed.'} No more retries: the 24-hour window is over. Replay it after fixing the receiver.` : outcome.reason
    const receipt = ulid()
    await this.db.batch([
      this.db.prepare(`INSERT OR IGNORE INTO response_event_attempts (id, delivery_id, ordinal, event, http_status, outcome_class, reason, created_at)
        SELECT ?, id, ?, ?, ?, ?, ?, ? FROM response_event_deliveries WHERE id = ? AND (status = 'sending' OR ? = 0)`).bind(receipt, ordinal, outcome.event, outcome.httpStatus, outcome.outcomeClass, outcome.reason, now, row.id, recorded ? 1 : 0),
      this.db.prepare(`UPDATE response_event_deliveries SET status = ?, reason = ?, available_at = ?, updated_at = ?,
        response_id = CASE WHEN event_type = 'response.deleted' AND ? IN ('confirmed','failed') THEN NULL ELSE response_id END
        WHERE id = ? AND status IN ('sending', 'pending') AND EXISTS (SELECT 1 FROM response_event_attempts WHERE id = ?)`).bind(status, reason, retryAt ?? now, now, status, row.id, receipt),
      outcome.event === 'confirmed'
        ? this.db.prepare(`UPDATE response_webhook_endpoints SET failure_streak = 0, failure_streak_started_at = NULL, updated_at = ? WHERE id = ? AND EXISTS (SELECT 1 FROM response_event_attempts WHERE id = ?)`).bind(now, row.endpointId, receipt)
        : this.db.prepare(`UPDATE response_webhook_endpoints SET failure_streak = failure_streak + 1, failure_streak_started_at = COALESCE(failure_streak_started_at, ?), updated_at = ?
            WHERE id = ? AND EXISTS (SELECT 1 FROM response_event_attempts WHERE id = ?)`).bind(now, now, row.endpointId, receipt),
    ])
  }
}
