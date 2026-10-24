import type { CheckoutOptions, PaymentLine, PaymentState } from '../../shared/payments'
import { admittedResponseSql } from './admission/index'

export type PaymentRow = { responseId: string; stepId: string; completionStepId: string; livemode: number; state: PaymentState; attempt: number; amount: number; linesJson: string; checkoutSettingsJson: string; discount: number | null; tax: number | null; total: number | null; checkoutSessionId: string | null; checkoutUrl: string | null; checkoutExpiresAt: string | null; paymentIntentId: string | null; providerAmount: number | null; stateChangedAt: string }
export type PaymentAttempt = { stepId: string; completionStepId: string; livemode: boolean; attempt: number; amount: number; lines: PaymentLine[]; checkout?: CheckoutOptions; returnTokenHash: string }
const columns = `p.response_id AS responseId, p.step_id AS stepId, p.completion_step_id AS completionStepId, p.livemode, p.state, p.attempt, p.amount, p.lines_json AS linesJson,
  p.checkout_settings_json AS checkoutSettingsJson, p.discount, p.tax, p.total, p.checkout_session_id AS checkoutSessionId, p.checkout_url AS checkoutUrl, p.checkout_expires_at AS checkoutExpiresAt, p.payment_intent_id AS paymentIntentId, p.provider_amount AS providerAmount, p.state_changed_at AS stateChangedAt`
export type EventMatch = { kind: 'session'; sessionId: string } | { kind: 'intent'; intentId: string } | { kind: 'attempt'; responseId: string; attempt: number }

/** The pending payment commits with its response (RESP-007), right after the guarded response insert. */
export function paymentInsertStatement(binding: D1Database, responseId: string, payment: PaymentAttempt, now: string) {
  return binding.prepare(`INSERT INTO response_payments (response_id, step_id, completion_step_id, provider, livemode, state, attempt, amount, currency, lines_json, checkout_settings_json, return_token_hash, state_changed_at, created_at, updated_at)
    SELECT ?, ?, ?, 'stripe', ?, 'pending', ?, ?, 'usd', ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM responses WHERE id = ?)`)
    .bind(responseId, payment.stepId, payment.completionStepId, payment.livemode ? 1 : 0, payment.attempt, payment.amount, JSON.stringify(payment.lines), JSON.stringify(payment.checkout ?? {}), payment.returnTokenHash, now, now, now, responseId)
}

export class PaymentRepository {
  constructor(private readonly db: D1Database) {}

  forResponse(responseId: string) {
    return this.db.prepare(`SELECT ${columns} FROM response_payments p WHERE p.response_id = ?`).bind(responseId).first<PaymentRow>()
  }

  byReturnToken(hash: string) {
    return this.db.prepare(`SELECT ${columns}, f.slug FROM response_payments p JOIN responses r ON r.id = p.response_id JOIN flows f ON f.id = r.flow_id WHERE p.return_token_hash = ?`).bind(hash).first<PaymentRow & { slug: string }>()
  }

  match(match: EventMatch) {
    const where = match.kind === 'session' ? 'p.checkout_session_id = ?' : match.kind === 'intent' ? 'p.payment_intent_id = ?' : 'p.response_id = ? AND p.attempt = ?'
    const values = match.kind === 'session' ? [match.sessionId] : match.kind === 'intent' ? [match.intentId] : [match.responseId, match.attempt]
    return this.db.prepare(`SELECT ${columns} FROM response_payments p WHERE ${where}`).bind(...values).first<PaymentRow>()
  }

  async recordCheckout(responseId: string, attempt: number, session: { id: string; url: string; expiresAt: string }, now: string) {
    const result = await this.db.prepare(`UPDATE response_payments SET checkout_session_id = ?, checkout_url = ?, checkout_expires_at = ?, updated_at = ?
      WHERE response_id = ? AND attempt = ? AND (checkout_session_id IS NULL OR checkout_session_id = ?) RETURNING response_id`).bind(session.id, session.url, session.expiresAt, now, responseId, attempt, session.id).all()
    return result.results.length === 1
  }

  /** The respondent's cancel, after Stripe confirmed the session can no longer be paid. */
  async cancel(responseId: string, attempt: number, now: string) {
    const result = await this.db.prepare(`UPDATE response_payments SET state = 'cancelled', state_changed_at = ?, updated_at = ?
      WHERE response_id = ? AND attempt = ? AND state IN ('pending', 'failed') RETURNING response_id`).bind(now, now, responseId, attempt).all()
    return result.results.length === 1
  }

  /** Records a Stripe event once by ID and applies its transition in the same transaction. A paid response
   * then completes its invitation (RESP-008) and can close a reached target (RESP-009). */
  async applyEvent(event: { id: string; type: string; created: number }, payment: PaymentRow, transition: { to: PaymentState; from: PaymentState[]; paymentIntentId?: string | null; providerAmount?: number | null; discount?: number; tax?: number; total?: number }, now: string) {
    const from = transition.from.map(() => '?').join(',')
    const created = new Date(event.created * 1000).toISOString()
    const applies = `response_id = ? AND attempt = ? AND state IN (${from})`
    const applied = `EXISTS (SELECT 1 FROM payment_events WHERE id = ? AND outcome = 'applied' AND received_at = ?)`
    const paid = `EXISTS (SELECT 1 FROM response_payments WHERE response_id = ? AND state = 'paid') AND ${applied}`
    const results = await this.db.batch([
      this.db.prepare(`INSERT INTO payment_events (id, type, response_id, outcome, created_at, received_at)
        SELECT ?, ?, ?, CASE WHEN EXISTS (SELECT 1 FROM response_payments WHERE ${applies}) THEN 'applied' ELSE 'unchanged' END, ?, ?
        WHERE NOT EXISTS (SELECT 1 FROM payment_events WHERE id = ?) RETURNING outcome`).bind(event.id, event.type, payment.responseId, payment.responseId, payment.attempt, ...transition.from, created, now, event.id),
      this.db.prepare(`UPDATE response_payments SET state = ?, payment_intent_id = COALESCE(?, payment_intent_id), provider_amount = COALESCE(?, provider_amount), discount = COALESCE(?, discount), tax = COALESCE(?, tax), total = COALESCE(?, total), state_changed_at = ?, updated_at = ?
        WHERE ${applies} AND ${applied}`).bind(transition.to, transition.paymentIntentId ?? null, transition.providerAmount ?? null, transition.discount ?? null, transition.tax ?? null, transition.total ?? null, now, now, payment.responseId, payment.attempt, ...transition.from, event.id, now),
      ...(transition.to === 'paid' ? [
        this.db.prepare(`UPDATE invitation_participants SET response_status = 'completed', completed_at = ?, completion_step_id = ?
          WHERE id = (SELECT participant_id FROM responses WHERE id = ?) AND ${paid}`).bind(now, payment.completionStepId, payment.responseId, payment.responseId, event.id, now),
        this.db.prepare(`UPDATE mail_deliveries SET status = 'cancelled', reason = 'Response completed.', updated_at = ?
          WHERE kind = 'reminder' AND status = 'pending' AND participant_id = (SELECT participant_id FROM responses WHERE id = ?) AND ${paid}`).bind(now, payment.responseId, payment.responseId, event.id, now),
        this.db.prepare(`UPDATE flow_revisions SET admission_closed_at = COALESCE(admission_closed_at, ?), admission_close_reason = COALESCE(admission_close_reason, 'target'), updated_at = ?
          WHERE id = (SELECT revision_id FROM responses WHERE id = ? AND state = 'released') AND target_completed_responses IS NOT NULL
            AND (SELECT COUNT(*) FROM responses completed WHERE completed.revision_id = flow_revisions.id AND ${admittedResponseSql('completed')}) >= target_completed_responses
            AND ${paid}`).bind(now, now, payment.responseId, payment.responseId, event.id, now),
        this.db.prepare(`UPDATE flows SET status = 'closed', last_activity_at = ?, updated_at = ?
          WHERE id = (SELECT flow_id FROM responses WHERE id = ?) AND status = 'open' AND EXISTS (
            SELECT 1 FROM flow_revisions WHERE id = (SELECT revision_id FROM responses WHERE id = ?) AND flow_id = flows.id AND state = 'published' AND is_current = 1
              AND admission_closed_at IS NOT NULL AND admission_close_reason = 'target') AND ${paid}`).bind(now, now, payment.responseId, payment.responseId, payment.responseId, event.id, now),
      ] : []),
    ])
    const outcome = (results[0].results[0] as { outcome?: string } | undefined)?.outcome
    return outcome === undefined ? 'duplicate' as const : outcome === 'applied' && (results[1].meta.changes ?? 0) > 0 ? 'applied' as const : 'unchanged' as const
  }
}
