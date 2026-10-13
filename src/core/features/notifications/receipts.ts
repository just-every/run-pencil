import { notificationPreparationReasons, type NotificationPreparationFailure } from './failure'
import { retryInstant } from '../distribution'
import type { NotificationDelivery } from './claims'

export type NotificationOutcome = { row: NotificationDelivery; outcome: 'sent' | 'transient' | 'permanent' | 'unknown'; providerId: string | null; provider: string | null; code: string | null; preparationFailure?: NotificationPreparationFailure }

/** Keep one outcome per durable ordinal, but persist a completed batch in four
 * writes rather than spending four D1 statements on each recipient. */
export async function recordNotifications(db: D1Database, outcomes: NotificationOutcome[], now: string) {
  if (!outcomes.length) return
  // A later local failure or rejection says nothing about an earlier transport.
  // Only a confirmed delivery resolves the logical work; retain every attempt.
  const uncertain = await db.prepare(`SELECT DISTINCT a.delivery_id FROM notification_attempts a
    WHERE a.event='unknown' AND a.delivery_id IN (SELECT value FROM json_each(?))
      AND NOT EXISTS(SELECT 1 FROM notification_attempts sent WHERE sent.delivery_id=a.delivery_id AND sent.event='sent' AND sent.ordinal>a.ordinal)`)
    .bind(JSON.stringify(outcomes.map(({row})=>row.id))).all<{delivery_id:string}>()
  const unresolved = new Set(uncertain.results.map(row=>row.delivery_id))
  const payload=JSON.stringify(outcomes.map(({row,outcome,providerId,provider,code,preparationFailure})=>{
    const retry=outcome==='transient'?retryInstant(row.firstAttempt,row.attempts):null
    const priorUnknown=unresolved.has(row.id) && outcome!=='sent'
    const canRetry=!priorUnknown && retry!==null && Date.parse(now)<Date.parse(row.firstAttempt)+3600_000
    const status=outcome==='sent'?'sent':outcome==='unknown'||priorUnknown?'unknown':canRetry?'pending':'failed'
    const currentExplanation=preparationFailure?notificationPreparationReasons[preparationFailure]:outcome==='sent'?null:outcome==='unknown'?'Mail sender returned an unknown outcome. Automatic resend is disabled.':outcome==='permanent'?'Mail provider rejected this operator notification.':priorUnknown?'Mail provider rate limited this attempt.':canRetry?'Mail provider rate limited this notification; retry scheduled.':'Mail provider retry limit exhausted after five retries within one hour.'
    const explanation=priorUnknown ? `Attempt ${row.attempts}: ${currentExplanation} An earlier delivery outcome remains unknown. Automatic resend is disabled; sending again requires duplicate-risk confirmation.` : currentExplanation
    return {id:row.id,attempts:row.attempts,flowId:row.flowId,operatorId:row.operatorId,workspaceId:row.workspaceId,outcome:preparationFailure ? `preparation-${preparationFailure}-failed` : outcome,status,
      reason:explanation && code?`${explanation} ${provider ?? 'Mail provider'}: ${code}.`:explanation,
      providerId,provider,code,availableAt:canRetry?retry:now,eventId:crypto.randomUUID(),auditId:crypto.randomUUID()}
  }))
  await db.batch([
    db.prepare(`INSERT INTO notification_attempts(id,delivery_id,ordinal,event,provider,provider_code,created_at)
      SELECT json_extract(o.value,'$.eventId'),d.id,d.attempts,json_extract(o.value,'$.outcome'),json_extract(o.value,'$.provider'),json_extract(o.value,'$.code'),?
      FROM json_each(?) o JOIN notification_deliveries d ON d.id=json_extract(o.value,'$.id')
      WHERE d.status='sending' AND d.attempts=json_extract(o.value,'$.attempts')`).bind(now,payload),
    db.prepare(`WITH outcomes AS (SELECT value FROM json_each(?)) UPDATE notification_deliveries AS d
      SET (status,reason,provider_id,provider,provider_code,available_at,updated_at)=(
        SELECT json_extract(value,'$.status'),json_extract(value,'$.reason'),json_extract(value,'$.providerId'),json_extract(value,'$.provider'),json_extract(value,'$.code'),json_extract(value,'$.availableAt'),?
        FROM outcomes WHERE json_extract(value,'$.id')=d.id)
      WHERE EXISTS(SELECT 1 FROM outcomes o JOIN notification_attempts a ON a.id=json_extract(o.value,'$.eventId') WHERE json_extract(o.value,'$.id')=d.id)`).bind(payload,now),
    db.prepare(`WITH outcomes AS (SELECT key,value FROM json_each(?)) UPDATE notification_preferences AS p
      SET failure_reason=(SELECT json_extract(o.value,'$.reason') FROM outcomes o JOIN notification_attempts a ON a.id=json_extract(o.value,'$.eventId')
        WHERE json_extract(o.value,'$.flowId')=p.flow_id AND json_extract(o.value,'$.operatorId')=p.operator_id ORDER BY o.key DESC LIMIT 1)
      WHERE EXISTS(SELECT 1 FROM outcomes o JOIN notification_attempts a ON a.id=json_extract(o.value,'$.eventId') WHERE json_extract(o.value,'$.flowId')=p.flow_id AND json_extract(o.value,'$.operatorId')=p.operator_id)`).bind(payload),
    db.prepare(`INSERT INTO audit_entries(id,workspace_id,kind,actor_operator_id,subject_type,subject_id,details_json,created_at)
      SELECT json_extract(o.value,'$.auditId'),json_extract(o.value,'$.workspaceId'),'notification.delivery',NULL,'notification',NULL,json_object('status',json_extract(o.value,'$.status')),?
      FROM json_each(?) o JOIN notification_attempts a ON a.id=json_extract(o.value,'$.eventId')`).bind(now,payload),
  ])
}
