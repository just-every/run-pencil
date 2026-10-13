import { safeNotificationReceipt } from './failure'

export type NotificationDelivery = { id: string; key: string; claimId: string; attempts: number; firstAttempt: string; operatorId: string; flowId: string; workspaceId: string; email: string; flowTitle: string; submittedAt: string; timeZone: string }
type Candidate = { id: string; attempts: number; firstAttempt: string | null; provider: string | null; providerCode: string | null; operatorRetry: number }
const eligible = `r.state='released' AND (r.notification_eligible=1 OR d.explicit_retry_authorized=1) AND p.mode='immediately'
  AND NOT EXISTS(SELECT 1 FROM operator_auth_links l JOIN oa_operators a ON a.id=l.auth_id WHERE l.operator_id=d.operator_id AND a.status='inactive')`

/** Each batch owns its started events. The claim and those events commit together
 * before any sender runs; a competing dispatcher cannot take the same ordinal. */
export async function claimNotifications(db: D1Database, ids: string[], now: string) {
  const candidates = await db.prepare(`SELECT d.id,d.attempts,d.first_attempt_at AS firstAttempt,d.provider,d.provider_code AS providerCode,
      EXISTS(SELECT 1 FROM notification_attempts a WHERE a.delivery_id=d.id AND a.event='operator-retry' AND a.ordinal=d.attempts AND a.created_at>=d.first_attempt_at) AS operatorRetry
    FROM notification_deliveries d JOIN responses r ON r.id=d.response_id
    JOIN notification_preferences p ON p.flow_id=r.flow_id AND p.operator_id=d.operator_id
    WHERE d.id IN (SELECT value FROM json_each(?)) AND d.status='pending' AND d.available_at<=? AND ${eligible}`)
    .bind(JSON.stringify(ids),now).all<Candidate>()
  const ready: Candidate[] = [], expired: Array<{id:string;attempts:number;reason:string}> = []
  for (const row of candidates.results) {
    if (row.firstAttempt && Date.parse(now)>Date.parse(row.firstAttempt)+3600_000 && !row.operatorRetry) {
      const receipt=safeNotificationReceipt(row.provider ?? '',row.providerCode ?? undefined)
      expired.push({id:row.id,attempts:row.attempts,reason:'Mail provider retry window exhausted after one hour.'+(receipt.code?` ${receipt.provider ?? 'Mail provider'}: ${receipt.code}.`:'')})
    } else ready.push(row)
  }
  if (expired.length) await db.prepare(`UPDATE notification_deliveries AS d SET status='failed',updated_at=?,
      reason=(SELECT json_extract(value,'$.reason') FROM json_each(?) WHERE json_extract(value,'$.id')=d.id)
    WHERE d.status='pending' AND EXISTS(SELECT 1 FROM json_each(?) WHERE json_extract(value,'$.id')=d.id AND json_extract(value,'$.attempts')=d.attempts)
      AND NOT EXISTS(SELECT 1 FROM notification_attempts a WHERE a.delivery_id=d.id AND a.event='operator-retry' AND a.ordinal=d.attempts AND a.created_at>=d.first_attempt_at)`)
    .bind(now,JSON.stringify(expired),JSON.stringify(expired)).run()
  if (!ready.length) return []
  const claim=crypto.randomUUID()+':', payload=JSON.stringify(ready.map(({id,attempts})=>({id,attempts})))
  const results=await db.batch([
    db.prepare(`INSERT INTO notification_attempts(id,delivery_id,ordinal,event,created_at)
      SELECT ?||d.id,d.id,d.attempts+1,'started',? FROM notification_deliveries d
      JOIN json_each(?) selected ON json_extract(selected.value,'$.id')=d.id AND json_extract(selected.value,'$.attempts')=d.attempts
      JOIN responses r ON r.id=d.response_id JOIN notification_preferences p ON p.flow_id=r.flow_id AND p.operator_id=d.operator_id
      WHERE d.status='pending' AND d.available_at<=? AND ${eligible}
        AND NOT EXISTS(SELECT 1 FROM notification_attempts a WHERE a.delivery_id=d.id AND a.ordinal=d.attempts+1 AND a.event='started')`)
      .bind(claim,now,payload,now),
    db.prepare(`UPDATE notification_deliveries AS d SET status='sending',attempts=attempts+1,first_attempt_at=COALESCE(first_attempt_at,?),last_attempt_at=?,updated_at=?
      WHERE status='pending' AND EXISTS(SELECT 1 FROM notification_attempts a WHERE a.id=?||d.id AND a.ordinal=d.attempts+1 AND a.event='started')`).bind(now,now,now,claim),
    db.prepare(`SELECT d.id,d.idempotency_key AS key,a.id AS claimId,d.attempts,d.first_attempt_at AS firstAttempt,d.operator_id AS operatorId,r.flow_id AS flowId,r.workspace_id AS workspaceId,
        o.email,v.title AS flowTitle,r.completed_at AS submittedAt,w.time_zone AS timeZone
      FROM notification_deliveries d JOIN notification_attempts a ON a.id=?||d.id AND a.ordinal=d.attempts
      JOIN responses r ON r.id=d.response_id JOIN operators o ON o.id=d.operator_id JOIN workspaces w ON w.id=r.workspace_id JOIN flow_revisions v ON v.id=r.revision_id
      WHERE d.status='sending' ORDER BY d.available_at,d.rowid`).bind(claim),
  ])
  return results[2].results as NotificationDelivery[]
}
