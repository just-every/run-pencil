import type { SmsService } from '../sms'
import type { MailSender } from '../../../base/operator-auth/index.mjs'
import type { MailDeliveries } from './deliveries'

/** A claimed attempt is durable before egress. An interrupted claim becomes
 * unknown, never an automatic resend: SendGrid offers no lookup by our key. */
export class DistributionDispatcher {
  constructor(private readonly db: D1Database, private readonly deliveries: MailDeliveries,
    private readonly sender: MailSender, private readonly origin: string, private readonly from: string, private readonly sms?: SmsService) {}
  async run(now = new Date().toISOString()) {
    // Archives retain delivery facts but omit bearer capabilities. Those rows
    // must neither consume the live queue nor acquire a new automatic outcome.
    const interrupted = await this.db.prepare("SELECT d.id,d.attempts FROM mail_deliveries d JOIN invitation_participants p ON p.id=d.participant_id WHERE d.status='sending' AND d.last_attempt_at < ? AND p.token IS NOT NULL")
      .bind(new Date(Date.parse(now) - 5 * 60_000).toISOString()).all<{ id: string; attempts: number }>()
    for (const row of interrupted.results) await this.deliveries.record(row.id, row.attempts, { kind: 'unknown', reason: 'The worker stopped before recording the provider outcome. Reconcile or explicitly resend with duplicate risk.' }, now)
    const due = await this.db.prepare("SELECT d.id FROM mail_deliveries d JOIN invitation_participants p ON p.id=d.participant_id WHERE d.status='pending' AND d.available_at <= ? AND p.token IS NOT NULL ORDER BY d.available_at,d.id LIMIT 50").bind(now).all<{ id: string }>()
    let attempted = 0
    for (const row of due.results) {
      const message = await this.deliveries.prepare(row.id, this.origin, now)
      if (!message) continue
      attempted++
      if(message.channel==='sms'){
        const outcome = this.sms ? await this.sms.send(message.to,message.text,message.idempotencyKey) : {kind:'permanent' as const,reason:'SMS connection is unavailable.'}
        await this.deliveries.record(message.deliveryId,message.ordinal,outcome,now);continue
      }
      let outcome: Parameters<MailDeliveries['record']>[2]
      try {
        const result = await this.sender.send({ deliveryId: message.idempotencyKey, from: this.from, to: [message.to], subject: message.subject, text: message.text, html: message.html, ...('attachments' in message ? { attachments: message.attachments } : {}), headers: message.headers })
        outcome = result.status === 'accepted' || result.status === 'development'
          ? { kind: 'sent', providerId: result.providerMessageId }
          : result.status === 'rate_limited' ? { kind: 'transient', reason: result.code ?? 'Provider rate limited the message.' }
            : result.status === 'rejected' ? { kind: 'permanent', reason: result.code ?? 'Provider rejected the message.' }
              : { kind: 'unknown', reason: result.code ?? 'The provider outcome is unknown; automatic resend is disabled.' }
      } catch { outcome = { kind: 'unknown', reason: 'Mail sender failed without a confirmed outcome; reconcile before resending.' } }
      await this.deliveries.record(message.deliveryId, message.ordinal, outcome, now)
    }
    return { attempted }
  }
}
