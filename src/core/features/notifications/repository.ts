import { NotFoundError, ValidationError } from '../../shared/errors'
export type NotificationMode = 'immediately' | 'off'
export type NotificationState = { mode: NotificationMode; failureReason: string | null; senderError: string | null; deliveries: Array<{ id: string; status: string; reason: string | null; attempts: number; updatedAt: string; recipient: string }> }
export class NotificationRepository {
  constructor(readonly db: D1Database, readonly senderError: string | null = null) {}
  async scope(workspaceId: string, flowId: string, operatorId: string) {
    if (!await this.db.prepare('SELECT f.id FROM flows f JOIN operators o ON o.workspace_id=f.workspace_id WHERE f.id=? AND f.workspace_id=? AND o.id=?').bind(flowId,workspaceId,operatorId).first()) throw new NotFoundError('This flow is not in your workspace.')
  }
  async read(workspaceId: string, flowId: string, operatorId: string): Promise<NotificationState> {
    await this.scope(workspaceId,flowId,operatorId)
    const preference = await this.db.prepare('SELECT mode,failure_reason AS failureReason FROM notification_preferences WHERE flow_id=? AND operator_id=?').bind(flowId,operatorId).first<{mode: NotificationMode; failureReason: string | null}>()
    const deliveries = await this.db.prepare(`SELECT d.id,d.status,d.reason,d.attempts,d.updated_at AS updatedAt,o.email AS recipient FROM notification_deliveries d JOIN responses r ON r.id=d.response_id JOIN operators o ON o.id=d.operator_id WHERE r.flow_id=? AND d.operator_id=? ORDER BY d.created_at DESC,d.id DESC LIMIT 20`).bind(flowId,operatorId).all<NotificationState['deliveries'][number]>()
    return { mode: preference?.mode ?? 'off', failureReason: preference?.failureReason ?? null, senderError: this.senderError, deliveries: deliveries.results }
  }
  async set(workspaceId: string, flowId: string, operatorId: string, mode: NotificationMode, now = new Date().toISOString()) {
    await this.scope(workspaceId,flowId,operatorId)
    if (!['immediately','off'].includes(mode)) throw new ValidationError('Choose Immediately or Off.')
    await this.db.batch([
      this.db.prepare(`INSERT INTO notification_preferences(flow_id,operator_id,mode,updated_at) VALUES(?,?,?,?) ON CONFLICT(flow_id,operator_id) DO UPDATE SET mode=excluded.mode,updated_at=excluded.updated_at`).bind(flowId,operatorId,mode,now),
      this.db.prepare(`UPDATE notification_deliveries SET status='cancelled',reason='Notifications turned off.',updated_at=? WHERE operator_id=? AND status='pending' AND ?='off' AND response_id IN (SELECT id FROM responses WHERE flow_id=?)`).bind(now,operatorId,mode,flowId),
    ])
    return this.read(workspaceId,flowId,operatorId)
  }
  async retry(workspaceId: string, operatorId: string, id: string, duplicateRiskAccepted: boolean, now = new Date().toISOString()) {
    const row = await this.db.prepare(`SELECT d.status,r.flow_id AS flowId FROM notification_deliveries d JOIN responses r ON r.id=d.response_id WHERE d.id=? AND d.operator_id=? AND r.workspace_id=?`).bind(id,operatorId,workspaceId).first<{status:string;flowId:string}>()
    if (!row) throw new NotFoundError('This notification is not yours.')
    if (!['failed','unknown'].includes(row.status)) throw new ValidationError('Only failed or unknown notifications can be retried.')
    if (row.status === 'unknown' && !duplicateRiskAccepted) throw new ValidationError('Sending again may deliver a duplicate. Confirm the duplicate risk first.')
    if ((await this.read(workspaceId,row.flowId,operatorId)).mode !== 'immediately') throw new ValidationError('Choose Immediately before retrying.')
    if (this.senderError) throw new ValidationError(this.senderError)
    await this.db.batch([
      this.db.prepare(`INSERT INTO notification_attempts(id,delivery_id,ordinal,event,created_at) SELECT ?,id,attempts,'operator-retry',? FROM notification_deliveries WHERE id=? AND (status='failed' OR (status='unknown' AND ?=1))`).bind(crypto.randomUUID(),now,id,duplicateRiskAccepted ? 1 : 0),
      this.db.prepare(`UPDATE notification_deliveries SET status='pending',explicit_retry_authorized=1,available_at=?,updated_at=? WHERE id=? AND (status='failed' OR (status='unknown' AND ?=1))`).bind(now,now,id,duplicateRiskAccepted ? 1 : 0),
    ])
  }
}
