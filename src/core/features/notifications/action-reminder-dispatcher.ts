import type { MailSender } from '../../../base/operator-auth/index.mjs'
import type { MailConfiguration } from '../../platform/mail'
import { insideSendingWindow, nextSendingInstant, retryInstant } from '../distribution/schedule'
import type { ReminderKind } from '../actions/reminder-schedule'
import { notificationSenderError } from './compose'
import { safeNotificationReceipt } from './failure'
import { actionReminderEligible, materializeActionReminders, interruptActionReminders } from './action-reminder-queue'
import { composeActionReminder } from './action-reminder-mail'

type Due = { id: string; actionId: string; workspaceId: string; operatorId: string; email: string; title: string; reviewDate: string; kind: ReminderKind; dueDate: string;
  key: string; attempts: number; firstAttempt: string | null; timeZone: string; sendingWindowStart: string; sendingWindowEnd: string; availableAt: string }
export class ActionReminderDispatcher {
  constructor(private db: D1Database, private sender: MailSender, private origin: string, private from: string,
    private configurationFailure: string | null = null, private mailProvider: MailConfiguration['kind'] = 'sendgrid') {}

  async run(now = new Date().toISOString()) {
    await materializeActionReminders(this.db, now)
    await interruptActionReminders(this.db, now)
    let cursor = { dueDate: '', availableAt: '', id: '' }, attempted = 0
    while (true) {
      const due = await this.db.prepare(`SELECT d.id,d.action_id AS actionId,a.workspace_id AS workspaceId,d.operator_id AS operatorId,o.email,a.title,d.review_date AS reviewDate,
        d.kind,d.due_date AS dueDate,d.idempotency_key AS key,d.attempts,d.first_attempt_at AS firstAttempt,d.available_at AS availableAt,
        w.time_zone AS timeZone,w.sending_window_start AS sendingWindowStart,w.sending_window_end AS sendingWindowEnd
        FROM action_reminders d JOIN actions a ON a.id=d.action_id JOIN operators o ON o.id=d.operator_id JOIN workspaces w ON w.id=a.workspace_id
        WHERE d.status='pending' AND d.available_at<=? AND (d.last_attempt_at IS NULL OR d.last_attempt_at<>?) AND ${actionReminderEligible}
        AND NOT EXISTS(SELECT 1 FROM action_reminders earlier WHERE earlier.action_id=d.action_id AND earlier.status IN ('pending','sending') AND earlier.due_date<d.due_date)
        AND (d.due_date,d.available_at,d.id)>(?,?,?) ORDER BY d.due_date,d.available_at,d.id LIMIT 100`)
        .bind(now,now,cursor.dueDate,cursor.availableAt,cursor.id).all<Due>()
      if (!due.results.length) break
      cursor = due.results.at(-1)!
      for (const row of due.results) {
        if (!insideSendingWindow(new Date(now), row)) continue
        const claim = crypto.randomUUID()
        const results = await this.db.batch([
          this.db.prepare(`INSERT OR IGNORE INTO action_reminder_attempts(id,reminder_id,ordinal,event,created_at)
            SELECT ?,d.id,d.attempts+1,'started',? FROM action_reminders d JOIN actions a ON a.id=d.action_id JOIN operators o ON o.id=d.operator_id
            WHERE d.id=? AND d.status='pending' AND d.attempts=? AND ${actionReminderEligible}`)
            .bind(claim,now,row.id,row.attempts),
          this.db.prepare(`UPDATE action_reminders SET status='sending',attempts=attempts+1,first_attempt_at=COALESCE(first_attempt_at,?),last_attempt_at=?,updated_at=?
            WHERE id=? AND status='pending' AND EXISTS(SELECT 1 FROM action_reminder_attempts t WHERE t.id=? AND t.ordinal=action_reminders.attempts+1) RETURNING attempts,first_attempt_at AS firstAttempt`)
            .bind(now,now,now,row.id,claim),
        ])
        if (!results[1].results.length) continue
        Object.assign(row, results[1].results[0])
        attempted++
        await this.deliver(row, claim, now)
      }
    }
    return { attempted }
  }

  private async deliver(row: Due, claim: string, now: string) {
    let outcome: 'sent' | 'transient' | 'permanent' | 'unknown' = 'permanent', reason: string | null = null, providerId: string | null = null
    let receipt: {provider: string | null; code: string | null} = {provider: null, code: null}
    try {
      const senderError = notificationSenderError(this.from, this.mailProvider) ?? this.configurationFailure
      if (senderError) throw new Error(senderError)
      const message = composeActionReminder({ ...row, origin: this.origin })
      // Re-read the live action/recipient and current hours after preparation, before transport.
      const live = await this.db.prepare(`SELECT o.email,a.title,w.time_zone AS timeZone,w.sending_window_start AS sendingWindowStart,w.sending_window_end AS sendingWindowEnd
        FROM action_reminders d JOIN actions a ON a.id=d.action_id JOIN operators o ON o.id=d.operator_id JOIN workspaces w ON w.id=a.workspace_id
        WHERE d.id=? AND d.status='sending' AND d.attempts=? AND ${actionReminderEligible}
          AND EXISTS(SELECT 1 FROM action_reminder_attempts t WHERE t.id=? AND t.reminder_id=d.id AND t.ordinal=d.attempts AND t.event='started')`)
        .bind(row.id,row.attempts,claim).first<Pick<Due,'email'|'title'|'timeZone'|'sendingWindowStart'|'sendingWindowEnd'>>()
      if (!live) {
        await this.db.prepare("UPDATE action_reminders SET status='cancelled',reason='Action or owner is no longer eligible.',updated_at=? WHERE id=? AND status='sending'")
          .bind(now,row.id).run()
        return
      }
      const transportTime = new Date().toISOString()
      if (!insideSendingWindow(new Date(transportTime), live)) {
        await this.db.prepare("UPDATE action_reminders SET status='pending',available_at=?,reason='Held until the sending window opens.',updated_at=? WHERE id=? AND status='sending'")
          .bind(nextSendingInstant(transportTime,live),transportTime,row.id).run()
        return
      }
      // Compose current content as well: an edit during the first read cannot leak stale text.
      const currentMessage = live.title === row.title && live.timeZone === row.timeZone ? message : composeActionReminder({ ...row, ...live, origin: this.origin })
      outcome = 'unknown'
      try {
        const result = await this.sender.send({ deliveryId: row.key, from: this.from, to: [live.email], ...currentMessage })
        outcome = ['accepted', 'development'].includes(result.status) ? 'sent' : result.status === 'rate_limited' ? 'transient' : result.status === 'rejected' ? 'permanent' : 'unknown'
        providerId = result.providerMessageId
        receipt = safeNotificationReceipt(result.provider, result.code)
      } catch { /* The provider may have accepted the message; never automatically resend it. */ }
    } catch { reason = 'Action reminder sender or composition is unavailable. Check this installation’s mail configuration.' }
    const retry = outcome === 'transient' ? retryInstant(row.firstAttempt!, row.attempts) : null
    const status = outcome === 'sent' ? 'sent' : outcome === 'unknown' ? 'unknown' : retry ? 'pending' : 'failed'
    reason ??= status === 'unknown' ? 'Delivery outcome is unknown. Automatic resend is disabled because delivery may have succeeded.'
      : status === 'pending' ? 'Mail provider rate limited this reminder; retry is scheduled within sending hours.'
      : status === 'failed' ? 'Mail provider rejected this reminder or exhausted its five retries.' : null
    const availableAt = retry ? nextSendingInstant(new Date(Math.max(Date.parse(retry), Date.parse(now))).toISOString(), row) : now
    const event = crypto.randomUUID()
    await this.db.batch([
      this.db.prepare(`INSERT INTO action_reminder_attempts(id,reminder_id,ordinal,event,provider,provider_code,created_at)
        SELECT ?,id,attempts,?,?,?,? FROM action_reminders WHERE id=? AND status IN ('sending','cancelled') AND attempts=?`)
        .bind(event,outcome,receipt.provider,receipt.code,now,row.id,row.attempts),
      this.db.prepare(`UPDATE action_reminders SET status=CASE WHEN status='cancelled' AND ?='pending' THEN 'cancelled' ELSE ? END,reason=?,provider_id=?,provider=?,provider_code=?,available_at=?,updated_at=?
        WHERE id=? AND status IN ('sending','cancelled') AND attempts=?`)
        .bind(status,status,reason,providerId,receipt.provider,receipt.code,availableAt,now,row.id,row.attempts),
      // Audit survives concurrent action/owner erasure without retaining identity, title or provider receipt.
      this.db.prepare(`INSERT INTO audit_entries(id,workspace_id,kind,actor_operator_id,subject_type,subject_id,details_json,created_at)
        VALUES(?,?,'action.reminder',NULL,'action-reminder',NULL,?,?)`)
        .bind(crypto.randomUUID(),row.workspaceId,JSON.stringify({status}),now),
    ])
  }
}
