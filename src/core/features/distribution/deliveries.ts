import { deliveryRetryAction } from '../sms'
import { emailFirstQuestion } from '../../shared/emailFirstQuestion'
import { formSettings } from '../../shared/hiddenFields'
import { revisionBranchSelection } from '../../shared/flowPolicies'
import { createDatabase } from '../../platform/db/repository'
import { FlowRepository, publicSteps, publicChoices, publicRules } from '../flows'
import { admittedResponseSql } from '../payments/admission'
import { invitationCollectorAdmissionSql } from '../collectors'
import { participantInvitation } from './message'
import { readNotificationBrand } from '../notifications'
import { ulid } from 'ulid'
import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors'
import { nextSendingInstant, retryInstant } from './schedule'
export const smsDeliveryMobile = "COALESCE(d.sms_mobile, (SELECT invitation.sms_mobile FROM mail_deliveries invitation WHERE invitation.participant_id=p.id AND invitation.kind='invitation'), p.sms_mobile_snapshot)"
type Delivery = { refusalCode:number|null; currentMobile:string|null; smsConsented:number; channel:'email'|'sms'; mobile:string|null; id: string; participantId: string; revisionId: string; formSettingsJson: string | null; policySnapshotJson: string | null; kind: 'invitation' | 'reminder'; status: string; key: string; attempts: number; retryBase: number; firstAttempt: string | null; availableAt: string; workspaceId: string; email: string | null; token: string | null; optOutToken: string | null; title: string; timeZone: string; sendingWindowStart: string; sendingWindowEnd: string; eligible: number; reminderDelayHours: number }
/** Domain receipts only. The maintained sender must call prepare before any provider effect. */
export class MailDeliveries {
  constructor(private readonly db: D1Database) {}
  private async read(id: string, now = new Date().toISOString()) {
    const collectorOpen=invitationCollectorAdmissionSql('p.launch_id','f.id',now)
    return this.db.prepare(`SELECT d.id, d.participant_id AS participantId, d.kind, d.status, COALESCE(json_extract(l.policy_json,'$.channel'),'email') AS channel, ${smsDeliveryMobile} AS mobile, c.mobile AS currentMobile, d.refusal_code AS refusalCode,
      (c.mobile IS NOT NULL AND c.sms_consent_at IS NOT NULL AND c.sms_stopped_at IS NULL AND c.mobile=c.sms_consent_mobile) AS smsConsented, d.idempotency_key AS key, d.attempts,
      (SELECT COALESCE(MAX(ordinal), 0) FROM mail_delivery_attempts WHERE delivery_id = d.id AND event = 'operator-retry') AS retryBase,
      CASE WHEN EXISTS (SELECT 1 FROM mail_delivery_attempts WHERE delivery_id = d.id AND event = 'operator-retry' AND ordinal = d.attempts)
        THEN NULL ELSE d.first_attempt_at END AS firstAttempt, d.available_at AS availableAt, p.workspace_id AS workspaceId, p.email_snapshot AS email,
      p.token, p.opt_out_token AS optOutToken, p.revision_id AS revisionId, r.form_settings_json AS formSettingsJson, r.policy_snapshot_json AS policySnapshotJson, r.title, CASE WHEN COALESCE(json_extract(l.policy_json,'$.channel'),'email')='sms' THEN COALESCE(c.time_zone, w.time_zone) ELSE w.time_zone END AS timeZone,
      w.sending_window_start AS sendingWindowStart, w.sending_window_end AS sendingWindowEnd,
      json_extract(l.policy_json, '$.reminderDelayHours') AS reminderDelayHours,
      (c.id IS NOT NULL AND c.opted_out_at IS NULL AND (COALESCE((SELECT json_extract(policy_json,'$.channel') FROM invitation_launches WHERE id=p.launch_id),'email')!='sms' OR (c.mobile IS NOT NULL AND c.sms_consent_at IS NOT NULL AND c.sms_stopped_at IS NULL AND c.mobile=c.sms_consent_mobile)) AND p.token IS NOT NULL AND f.status IN ('open', 'closed') AND r.admission_closed_at IS NULL
        AND (r.deadline_at IS NULL OR r.deadline_at > ?)
        AND ${collectorOpen.sql}
        AND (r.target_completed_responses IS NULL OR (SELECT count(*) FROM responses admitted WHERE admitted.revision_id = r.id AND ${admittedResponseSql('admitted')}) < r.target_completed_responses)
        AND p.delivery_status != 'bounced' AND (d.kind = 'invitation' OR (p.delivery_status = 'sent' AND p.response_status != 'completed'))) AS eligible
      FROM mail_deliveries d JOIN invitation_participants p ON p.id = d.participant_id JOIN invitation_launches l ON l.id = p.launch_id JOIN workspaces w ON w.id = p.workspace_id
      JOIN flow_revisions r ON r.id = p.revision_id JOIN flows f ON f.id = r.flow_id
      LEFT JOIN distribution_contacts c ON c.id = p.contact_id WHERE d.id = ?`).bind(now, ...collectorOpen.params, id).first<Delivery>()
  }
  async prepare(id: string, origin: string, now = new Date().toISOString()) {
    const delivery = await this.read(id, now)
    if (!delivery || delivery.status !== 'pending' || delivery.availableAt > now) return null
    // A delayed queue wakeup cannot extend the budget. Recheck the same
    // deadline and retry count in the atomic send authorization below.
    if (delivery.firstAttempt && (Date.parse(now) > Date.parse(delivery.firstAttempt) + 3600_000 || delivery.attempts - delivery.retryBase >= 6)) {
      await this.db.batch([
        this.db.prepare(`UPDATE mail_deliveries SET status = 'failed', reason = 'Automatic retry budget exhausted.', updated_at = ?
          WHERE id = ? AND status = 'pending' AND attempts = ? AND first_attempt_at = ?`)
          .bind(now, id, delivery.attempts, delivery.firstAttempt),
        this.db.prepare(`UPDATE invitation_participants SET delivery_status = 'failed' WHERE id = ? AND ? = 'invitation'
          AND EXISTS (SELECT 1 FROM mail_deliveries WHERE id = ? AND status = 'failed' AND reason = 'Automatic retry budget exhausted.')`)
          .bind(delivery.participantId, delivery.kind, id),
      ])
      return null
    }
    // Recovery omits invitation capabilities while preserving their receipts.
    if (delivery.token === null) return null
    if (!delivery.eligible || (delivery.channel === 'sms' && delivery.mobile !== delivery.currentMobile)) {
      await this.db.prepare("UPDATE mail_deliveries SET status = 'cancelled', reason = 'Consent or admission is no longer eligible.', updated_at = ? WHERE id = ? AND status = 'pending'").bind(now, id).run()
      return null
    }
    if (delivery.kind === 'reminder' || delivery.channel === 'sms') {
      const next = nextSendingInstant(now, delivery)
      if (next > now) { await this.db.prepare("UPDATE mail_deliveries SET available_at = ?, updated_at = ? WHERE id = ? AND status = 'pending'").bind(next, now, id).run(); return null }
    }
    let message: ReturnType<typeof participantInvitation> | undefined
    try {
      const repository = new FlowRepository(createDatabase(this.db), this.db)
      const [brand, graph] = await Promise.all([
        readNotificationBrand(this.db, delivery.workspaceId),
        repository.getRevisionGraph(delivery.revisionId),
      ])
      const embedded = emailFirstQuestion({
        steps: publicSteps(graph.steps), choices: publicChoices(graph.steps, graph.choices), branchRules: publicRules(graph.rules),
        formSettings: formSettings(delivery.formSettingsJson), branchSelection: revisionBranchSelection(delivery.policySnapshotJson),
      })
      const link = new URL(`/i/${delivery.token}`, origin).href, optOut = new URL(`/optout/${delivery.optOutToken}`, origin).href
      message = participantInvitation(brand, delivery.title, link, optOut, embedded)
    } catch {
      // Claim and record a visible failure below; unreadable branding or published graph must not
      // leave a pending delivery blocking every later recipient in the queue.
    }
    const attemptId = ulid()
    const collectorOpen=invitationCollectorAdmissionSql('p.launch_id','f.id',now)
    const results = await this.db.batch([
      this.db.prepare(`UPDATE mail_deliveries SET status = 'sending', attempts = attempts + 1,
        first_attempt_at = CASE WHEN EXISTS (SELECT 1 FROM mail_delivery_attempts WHERE delivery_id = mail_deliveries.id AND event = 'operator-retry' AND ordinal = mail_deliveries.attempts)
          THEN ? ELSE COALESCE(first_attempt_at, ?) END, last_attempt_at = ?, updated_at = ?
        WHERE id = ? AND status = 'pending' AND attempts = ? AND available_at <= ?
          AND (EXISTS (SELECT 1 FROM mail_delivery_attempts WHERE delivery_id = mail_deliveries.id AND event = 'operator-retry' AND ordinal = mail_deliveries.attempts)
            OR first_attempt_at IS NULL OR ? <= strftime('%Y-%m-%dT%H:%M:%fZ', first_attempt_at, '+1 hour'))
          AND attempts - (SELECT COALESCE(MAX(ordinal), 0) FROM mail_delivery_attempts WHERE delivery_id = mail_deliveries.id AND event = 'operator-retry') < 6
          AND EXISTS (
          SELECT 1 FROM invitation_participants p JOIN distribution_contacts c ON c.id = p.contact_id
          JOIN flow_revisions r ON r.id = p.revision_id JOIN flows f ON f.id = r.flow_id WHERE p.id = mail_deliveries.participant_id
          AND c.opted_out_at IS NULL AND (COALESCE((SELECT json_extract(policy_json,'$.channel') FROM invitation_launches WHERE id=p.launch_id),'email')!='sms' OR (c.mobile IS NOT NULL AND c.sms_consent_at IS NOT NULL AND c.sms_stopped_at IS NULL AND c.mobile=c.sms_consent_mobile AND c.mobile=COALESCE(mail_deliveries.sms_mobile, (SELECT invitation.sms_mobile FROM mail_deliveries invitation WHERE invitation.participant_id=p.id AND invitation.kind='invitation'), p.sms_mobile_snapshot))) AND p.token IS NOT NULL AND f.status IN ('open', 'closed') AND r.admission_closed_at IS NULL
          AND (r.deadline_at IS NULL OR r.deadline_at > ?)
          AND ${collectorOpen.sql}
          AND (r.target_completed_responses IS NULL OR (SELECT count(*) FROM responses admitted WHERE admitted.revision_id = r.id AND ${admittedResponseSql('admitted')}) < r.target_completed_responses) AND p.delivery_status != 'bounced'
          AND (mail_deliveries.kind = 'invitation' OR (p.delivery_status = 'sent' AND p.response_status != 'completed')))`)
        .bind(now, now, now, now, id, delivery.attempts, now, now, now, ...collectorOpen.params),
      this.db.prepare(`INSERT INTO mail_delivery_attempts (id, delivery_id, ordinal, event, created_at)
        SELECT ?, id, attempts, 'started', ? FROM mail_deliveries WHERE id = ? AND status = 'sending' AND attempts = ? AND last_attempt_at = ?
        AND NOT EXISTS (SELECT 1 FROM mail_delivery_attempts WHERE delivery_id = ? AND ordinal = ? AND event = 'started')`)
        .bind(attemptId, now, id, delivery.attempts + 1, now, id, delivery.attempts + 1),
    ])
    if (!results[0].meta.changes || !results[1].meta.changes) return null
    if (!message) {
      await this.record(id, delivery.attempts + 1, { kind: 'permanent', reason: 'Invitation not sent: business branding, published questions or invitation links could not be read or validated. Correct the saved settings, then queue a retry.' }, now)
      return null
    }
    if(delivery.channel==='sms')message={...message,text:`${delivery.title}: ${new URL(`/i/${delivery.token}`,origin).href} Reply STOP to opt out.`,html:''}
    return { channel:delivery.channel, deliveryId: id, ordinal: delivery.attempts + 1, idempotencyKey: delivery.key, to: delivery.channel==='sms'?delivery.mobile!:delivery.email!, ...message, headers: { 'Auto-Submitted': 'auto-generated' } }
  }
  async record(id: string, ordinal: number, outcome: { kind: 'sent'; providerId: string | null } | { kind: 'transient' | 'permanent' | 'unknown' | 'bounced'; reason: string; refusalCode?: number }, now = new Date().toISOString()) {
    const delivery = await this.read(id)
    if (!delivery || delivery.status !== 'sending' || delivery.attempts !== ordinal) throw new ConflictError('This attempt already has an outcome or is not current.')
    const retry = outcome.kind === 'transient' && delivery.firstAttempt ? retryInstant(delivery.firstAttempt, ordinal - delivery.retryBase) : null
    const canRetry = retry !== null && Date.parse(now) <= Date.parse(delivery.firstAttempt!) + 3600_000
    const status = outcome.kind === 'sent' ? 'sent' : outcome.kind === 'unknown' ? 'unknown' : canRetry ? 'pending' : 'failed'
    const reason = 'reason' in outcome ? outcome.reason.slice(0, 1000) : null
    const receipt = ulid()
    await this.db.batch([
      this.db.prepare(`INSERT INTO mail_delivery_attempts (id, delivery_id, ordinal, event, reason, provider_id, created_at)
        SELECT ?, id, attempts, ?, ?, ?, ? FROM mail_deliveries WHERE id = ? AND status = 'sending' AND attempts = ?`)
        .bind(receipt, outcome.kind, reason, outcome.kind === 'sent' ? outcome.providerId : null, now, id, ordinal),
      this.db.prepare(`UPDATE mail_deliveries SET status = ?, reason = ?, refusal_code = ?, provider_id = ?, available_at = ?, updated_at = ? WHERE id = ?
        AND EXISTS (SELECT 1 FROM mail_delivery_attempts WHERE id = ?)`).bind(status, reason, 'refusalCode' in outcome ? outcome.refusalCode ?? null : null, outcome.kind === 'sent' ? outcome.providerId : null, canRetry ? retry! : now, now, id, receipt),
      this.db.prepare(`UPDATE invitation_participants SET delivery_status = ? WHERE id = ? AND ? != 'pending' AND (? = 'invitation' OR ? = 'bounced')
        AND EXISTS (SELECT 1 FROM mail_delivery_attempts WHERE id = ?)`).bind(outcome.kind === 'bounced' ? 'bounced' : status, delivery.participantId, status, delivery.kind, outcome.kind, receipt),
      this.db.prepare(`INSERT OR IGNORE INTO mail_deliveries (id, participant_id, kind, status, idempotency_key, available_at, created_at, updated_at)
        SELECT ?, p.id, 'reminder', 'pending', ?, ?, ?, ? FROM invitation_participants p WHERE p.id = ? AND p.response_status != 'completed'
        AND ? = 'sent' AND ? = 'invitation' AND EXISTS (SELECT 1 FROM mail_delivery_attempts WHERE id = ?)`)
        .bind(ulid(), `reminder:${delivery.participantId}`, new Date(Date.parse(now) + delivery.reminderDelayHours * 3600_000).toISOString(), now, now, delivery.participantId, status, delivery.kind, receipt),
    ])
  }
  async retry(workspaceId: string, id: string, operatorId: string, duplicateRiskAccepted: boolean, now = new Date().toISOString()) {
    const delivery = await this.read(id)
    if (!delivery || delivery.workspaceId !== workspaceId) throw new NotFoundError('This delivery is not in your workspace.')
    if (!['failed','unknown'].includes(delivery.status)) throw new ValidationError('Only failed or unknown delivery can be retried.')
    if (delivery.status === 'unknown' && !duplicateRiskAccepted) throw new ValidationError('The previous outcome is unknown. Explicit resend may deliver a duplicate; acknowledge this risk first.')
    const action = deliveryRetryAction(delivery)
    if (action !== 'retry') throw new ValidationError('This refusal needs the recipient’s action or a corrected number with recorded consent before another send.')
    const corrected = delivery.channel === 'sms' && delivery.mobile !== delivery.currentMobile
    if (delivery.channel === 'sms' && (!delivery.eligible || (corrected && delivery.refusalCode !== 21211 && delivery.refusalCode !== 21612 && delivery.refusalCode !== 21614))) throw new ValidationError('This SMS delivery is no longer eligible for retry.')
    const nextKey = corrected ? `${delivery.kind}:${ulid()}` : delivery.key
    const receipt = ulid()
    const result = await this.db.batch([
      this.db.prepare(`INSERT INTO mail_delivery_attempts (id, delivery_id, ordinal, event, actor_operator_id, reason, created_at)
        SELECT ?, id, attempts, 'operator-retry', (SELECT id FROM operators WHERE id = ? AND workspace_id = ?), ?, ?
        FROM mail_deliveries WHERE id = ? AND attempts = ? AND status IN ('failed','unknown') AND (status != 'unknown' OR ?)
          AND refusal_code IS ? AND idempotency_key = ?
          AND (? = 'email' OR EXISTS (SELECT 1 FROM invitation_participants p JOIN distribution_contacts c ON c.id=p.contact_id WHERE p.id=mail_deliveries.participant_id AND c.mobile=? AND c.mobile=c.sms_consent_mobile AND c.sms_consent_at IS NOT NULL AND c.sms_stopped_at IS NULL AND c.opted_out_at IS NULL))`)
        .bind(receipt, operatorId, workspaceId, delivery.channel === 'sms' ? JSON.stringify({duplicateRiskAccepted, previousMobile:delivery.mobile, mobile:corrected?delivery.currentMobile:delivery.mobile, previousKey:delivery.key, key:nextKey}) : `Explicit operator retry starts a new one-hour budget; duplicate risk ${duplicateRiskAccepted ? 'accepted' : 'not applicable'}`, now, id, delivery.attempts, duplicateRiskAccepted ? 1 : 0, delivery.refusalCode, delivery.key, delivery.channel, delivery.currentMobile),
      this.db.prepare(`UPDATE mail_deliveries SET status = 'pending', sms_mobile = ?, idempotency_key = ?, refusal_code = NULL, first_attempt_at = NULL, last_attempt_at = NULL, available_at = ?, updated_at = ? WHERE id = ? AND EXISTS (SELECT 1 FROM mail_delivery_attempts WHERE id = ?)`).bind(delivery.channel === 'sms' ? corrected ? delivery.currentMobile : delivery.mobile : null, nextKey, now, now, id, receipt),
    ])
    if (!result[0].meta.changes) throw new ConflictError('This delivery was already retried or changed; refresh its status.')
  }
}
