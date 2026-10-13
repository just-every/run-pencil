/** Consume only recipient identities captured by the response's commit transaction. */
export async function materializeNotifications(db: D1Database, now: string) {
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO notification_deliveries(id,response_id,operator_id,status,idempotency_key,available_at,created_at,updated_at)
      SELECT lower(hex(randomblob(16))),r.id,p.operator_id,'pending',lower(hex(randomblob(32))),?,?,?
      FROM response_outbox x JOIN responses r ON r.id=x.response_id
      JOIN json_each(CASE WHEN json_valid(x.payload_json) THEN x.payload_json ELSE '{}' END,'$.notificationOperatorIds') recipient
      JOIN notification_preferences p ON p.flow_id=r.flow_id AND p.operator_id=recipient.value
      JOIN operators o ON o.id=p.operator_id AND o.workspace_id=r.workspace_id
      WHERE x.notification_eligible=1 AND r.notification_eligible=1 AND r.state='released' AND r.source IN ('direct','embed','invitation')
        AND x.kind='response.completed' AND x.status='pending' AND x.available_at<=? AND p.mode='immediately'
        AND recipient.type='text'`).bind(now,now,now,now),
    db.prepare(`UPDATE response_outbox SET status='dispatched',dispatched_at=?,updated_at=?
      WHERE notification_eligible=1 AND kind='response.completed' AND status='pending' AND available_at<=?
        AND EXISTS(SELECT 1 FROM responses r WHERE r.id=response_outbox.response_id AND r.notification_eligible=1 AND r.state='released' AND r.source IN ('direct','embed','invitation'))`).bind(now,now,now),
  ])
}
