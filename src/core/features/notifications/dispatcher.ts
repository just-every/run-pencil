import { readNotificationBrand, type NotificationBrand } from './brand.server'
import { safeNotificationReceipt, type NotificationPreparationFailure } from './failure'
import type { MailSender } from '../../../base/operator-auth/index.mjs'
import { composeResponseNotification, notificationSenderError } from './compose'
import { materializeNotifications } from './outbox'
import { claimNotifications, type NotificationDelivery } from './claims'
import { recordNotifications, type NotificationOutcome } from './receipts'
const batchSize = 50
const concurrency = 5
export class NotificationDispatcher {
  constructor(private readonly db: D1Database, private readonly sender: MailSender, private readonly origin: string, private readonly from: string,
    private readonly readBrand: (workspaceId: string) => Promise<NotificationBrand> = workspaceId => readNotificationBrand(db, workspaceId), private readonly configurationFailure: string | null = null) {}
  async run(now = new Date().toISOString()) {
    await materializeNotifications(this.db,now)
    const interruptedBefore = new Date(Date.parse(now)-300_000).toISOString()
    await this.db.batch([
      this.db.prepare(`INSERT INTO notification_attempts(id,delivery_id,ordinal,event,created_at)
        SELECT 'interrupted:'||d.id||':'||d.attempts,d.id,d.attempts,'unknown',? FROM notification_deliveries d
        WHERE d.status='sending' AND d.last_attempt_at<? AND EXISTS(SELECT 1 FROM responses r WHERE r.id=d.response_id AND (r.notification_eligible=1 OR d.explicit_retry_authorized=1))`).bind(now,interruptedBefore),
      this.db.prepare(`UPDATE notification_deliveries AS d SET status='unknown',reason='Mail sender was interrupted before confirming the outcome. Automatic resend is disabled.',updated_at=?
        WHERE status='sending' AND last_attempt_at<? AND EXISTS(SELECT 1 FROM responses r WHERE r.id=d.response_id AND (r.notification_eligible=1 OR d.explicit_retry_authorized=1))`).bind(now,interruptedBefore),
    ])
    const senderError = notificationSenderError(this.from) ?? this.configurationFailure
    if (senderError) {
      // Disabling a sender cannot resolve a transport attempted before this run.
      const unresolved = `EXISTS(SELECT 1 FROM notification_attempts a WHERE a.delivery_id=d.id AND a.event='unknown'
        AND NOT EXISTS(SELECT 1 FROM notification_attempts sent WHERE sent.delivery_id=a.delivery_id AND sent.event='sent' AND sent.ordinal>a.ordinal))`
      await this.db.batch([
        this.db.prepare(`UPDATE notification_deliveries AS d SET status=CASE WHEN ${unresolved} THEN 'unknown' ELSE 'failed' END,
          reason=?||CASE WHEN ${unresolved} THEN ' An earlier delivery outcome remains unknown. Automatic resend is disabled; sending again requires duplicate-risk confirmation.' ELSE '' END,updated_at=? WHERE status='pending'
          AND EXISTS(SELECT 1 FROM responses r WHERE r.id=d.response_id AND (r.notification_eligible=1 OR d.explicit_retry_authorized=1))`).bind(senderError,now),
        this.db.prepare(`UPDATE notification_preferences SET failure_reason=? WHERE mode='immediately'`).bind(senderError),
      ])
      return { attempted: 0, senderError }
    }
    const brands = new Map<string,Promise<NotificationBrand>>()
    const brand = (workspaceId: string) => {
      if (!brands.has(workspaceId)) brands.set(workspaceId,this.readBrand(workspaceId))
      return brands.get(workspaceId)!
    }
    let attempted = 0
    let cursor = { availableAt: '', rowid: 0 }
    while (true) {
      // The due index already orders equal timestamps by SQLite rowid. Seek
      // through it without repeatedly sorting the remaining queue. An overdue
      // retry is attempted once per scheduled instant; explicit retries stay live.
      const due = await this.db.prepare(`SELECT id,rowid,available_at AS availableAt FROM notification_deliveries
        WHERE status='pending' AND available_at<=? AND (available_at,rowid)>(?,?)
          AND (last_attempt_at IS NULL OR last_attempt_at<>? OR EXISTS(
            SELECT 1 FROM notification_attempts a WHERE a.delivery_id=notification_deliveries.id AND a.ordinal=notification_deliveries.attempts AND a.event='operator-retry'))
        ORDER BY available_at,rowid LIMIT ?`).bind(now,cursor.availableAt,cursor.rowid,now,batchSize).all<{id:string;rowid:number;availableAt:string}>()
      if (!due.results.length) break
      cursor = due.results.at(-1)!
      const claimed = await claimNotifications(this.db,due.results.map(row=>row.id),now)
      attempted += claimed.length
      const outcomes: NotificationOutcome[] = []
      for (let offset=0;offset<claimed.length;offset+=concurrency) {
        const results = await Promise.allSettled(claimed.slice(offset,offset+concurrency).map(row=>this.deliver(row,brand)))
        for (const result of results) {
          if (result.status==='rejected') throw result.reason
          if (result.value) outcomes.push(result.value)
        }
      }
      await recordNotifications(this.db,outcomes,now)
    }
    return { attempted, senderError: null }
  }
  private async deliver(row: NotificationDelivery, brand: (workspaceId:string)=>Promise<NotificationBrand>): Promise<NotificationOutcome | null> {
      let message: ReturnType<typeof composeResponseNotification>
      let preparationFailure: NotificationPreparationFailure = 'brand'
      let outcome: 'sent' | 'transient' | 'permanent' | 'unknown' = 'unknown', providerId: string | null = null
      let receipt: {provider:string|null;code:string|null} = {provider:null,code:null}
      try {
        const identity = await brand(row.workspaceId)
        preparationFailure = 'composition'
        message = composeResponseNotification({businessName:identity.businessName,supportingLine:identity.supportingLine,logo:identity.logo,flowTitle:row.flowTitle,submittedAt:row.submittedAt,timeZone:row.timeZone,resultsUrl:new URL(`/app/flows/${encodeURIComponent(row.flowId)}/results`,this.origin).href,accentColor:identity.accentColor})
        preparationFailure = 'eligibility'
        // Recheck after asynchronous composition: erased work never reaches the sender.
        if (!await this.db.prepare(`SELECT d.id FROM notification_deliveries d JOIN responses r ON r.id=d.response_id
          JOIN notification_preferences p ON p.flow_id=r.flow_id AND p.operator_id=d.operator_id
          WHERE d.id=? AND d.status='sending' AND d.attempts=? AND r.state='released' AND (r.notification_eligible=1 OR d.explicit_retry_authorized=1) AND p.mode='immediately'
          AND EXISTS(SELECT 1 FROM notification_attempts a WHERE a.id=? AND a.delivery_id=d.id AND a.ordinal=d.attempts AND a.event='started')
          AND NOT EXISTS(SELECT 1 FROM operator_auth_links l JOIN oa_operators a ON a.id=l.auth_id WHERE l.operator_id=d.operator_id AND a.status='inactive')`).bind(row.id,row.attempts,row.claimId).first()) return null
      } catch {
        return {row,outcome:'permanent',providerId:null,provider:null,code:null,preparationFailure}
      }
      try {
        const result = await this.sender.send({deliveryId:row.key,from:this.from,to:[row.email],...message,
          headers:{...message.headers,'X-Pencil-Notification-Attempt':String(row.attempts),'X-Pencil-Notification-Claim':row.claimId}})
        outcome = ['accepted','development'].includes(result.status) ? 'sent' : result.status === 'rate_limited' ? 'transient' : result.status === 'rejected' ? 'permanent' : 'unknown'
        providerId = result.providerMessageId
        receipt = safeNotificationReceipt(result.provider,result.code)
      } catch { /* An exception cannot prove that a provider did not accept the message. */ }
      return {row,outcome,providerId,...receipt}
  }
}
