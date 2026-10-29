import { nextOpening } from '../../shared/civilTime'
import { NotFoundError, ValidationError } from '../../shared/errors'
export type NotificationMode = 'immediately' | 'off' | 'daily'
export type NotificationState = { localMail?: boolean; hostedDemo?: boolean; timerLastStartedAt?: string | null; mode: NotificationMode; daily?: {zone:string;opening:string;nextOpening:string}; failureReason: string | null; senderError: string | null; deliveries: Array<{ id: string; status: string; reason: string | null; attempts: number; updatedAt: string; recipient: string; day?:string; cutoffStart?:string; cutoffEnd?:string; replayEnabled?:number }> }
export class NotificationRepository {
  constructor(readonly db: D1Database, readonly senderError: string | null = null, readonly localMail = false, readonly hostedDemo = false, readonly attribution: Record<string, unknown> = {}) {}
  attributed(attribution: Record<string, unknown>) { return new NotificationRepository(this.db, this.senderError, this.localMail, this.hostedDemo, attribution) }
  async scope(workspaceId: string, flowId: string, operatorId: string) {
    if (!await this.db.prepare('SELECT f.id FROM flows f JOIN operators o ON o.workspace_id=f.workspace_id WHERE f.id=? AND f.workspace_id=? AND o.id=?').bind(flowId,workspaceId,operatorId).first()) throw new NotFoundError('This flow is not in your workspace.')
  }
  async read(workspaceId: string, flowId: string, operatorId: string): Promise<NotificationState> {
    await this.scope(workspaceId,flowId,operatorId)
    const preference = await this.db.prepare('SELECT mode,failure_reason AS failureReason FROM notification_preferences WHERE flow_id=? AND operator_id=?').bind(flowId,operatorId).first<{mode: NotificationMode; failureReason: string | null}>()
    const deliveries = await this.db.prepare(`SELECT d.id,d.status,d.reason,d.attempts,d.updated_at AS updatedAt,o.email AS recipient FROM notification_deliveries d JOIN responses r ON r.id=d.response_id JOIN operators o ON o.id=d.operator_id WHERE r.flow_id=? AND d.operator_id=? ORDER BY d.created_at DESC,d.id DESC LIMIT 20`).bind(flowId,operatorId).all<NotificationState['deliveries'][number]>()
    const daily=await this.db.prepare('SELECT enabled,failure_reason AS failureReason,zone,window_start AS opening,next_opening AS nextOpening FROM digest_preferences WHERE flow_id=? AND operator_id=?').bind(flowId,operatorId).first<{enabled:number;failureReason:string|null;zone:string;opening:string;nextOpening:string}>()
    const digests=await this.db.prepare(`SELECT d.id,d.status,d.reason,d.day,d.cutoff_start AS cutoffStart,d.cutoff_end AS cutoffEnd,d.replay_enabled AS replayEnabled,d.attempts,d.updated_at AS updatedAt,o.email AS recipient FROM digest_deliveries d JOIN operators o ON o.id=d.operator_id WHERE d.flow_id=? AND d.operator_id=? ORDER BY d.cutoff_end DESC LIMIT 20`).bind(flowId,operatorId).all<NotificationState['deliveries'][number]>()
    deliveries.results.push(...digests.results)
    deliveries.results.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))
    const timer = await this.db.prepare('SELECT last_started_at AS lastStartedAt FROM notification_timer WHERE id=1').first<{lastStartedAt:string}>()
    return { localMail: this.localMail, ...(this.hostedDemo ? { hostedDemo: true } : {}), timerLastStartedAt: timer?.lastStartedAt ?? null, ...(daily?.enabled ? {daily:{zone:daily.zone,opening:daily.opening,nextOpening:daily.nextOpening}} : {}), mode: daily?.enabled ? 'daily' : preference?.mode ?? 'off', failureReason: daily?.enabled ? daily.failureReason : preference?.failureReason ?? null, senderError: this.senderError, deliveries: deliveries.results }
  }
  async set(workspaceId: string, flowId: string, operatorId: string, mode: NotificationMode, now = new Date().toISOString()) {
    await this.scope(workspaceId,flowId,operatorId)
    if (!['immediately','off','daily'].includes(mode)) throw new ValidationError('Choose Immediately, Daily or Off.')
    const settings=await this.db.prepare('SELECT time_zone AS zone,sending_window_start AS start FROM workspaces WHERE id=?').bind(workspaceId).first<{zone:string;start:string}>()
    const next=nextOpening(now,settings!.zone,settings!.start)
    while(await this.db.prepare('SELECT 1 FROM digest_deliveries WHERE flow_id=? AND operator_id=? AND day=?').bind(flowId,operatorId,next.day).first()) Object.assign(next,nextOpening(next.at,settings!.zone,settings!.start,next.day))
    // Re-enabling starts a new interval now; historical responses and cancelled work stay historical.
    const daily=this.db.prepare(`INSERT INTO digest_preferences(flow_id,operator_id,epoch,enabled,cutoff,next_opening,next_day,zone,window_start) VALUES(?,?,?,?,?,?,?,?,?)
      ON CONFLICT(flow_id,operator_id) DO UPDATE SET enabled=excluded.enabled,
      epoch=CASE WHEN digest_preferences.enabled=1 AND excluded.enabled=1 THEN digest_preferences.epoch ELSE excluded.epoch END,
      cutoff=CASE WHEN digest_preferences.enabled=1 AND excluded.enabled=1 THEN digest_preferences.cutoff ELSE excluded.cutoff END,
      next_opening=CASE WHEN digest_preferences.enabled=1 AND excluded.enabled=1 THEN digest_preferences.next_opening ELSE excluded.next_opening END,
      next_day=CASE WHEN digest_preferences.enabled=1 AND excluded.enabled=1 THEN digest_preferences.next_day ELSE excluded.next_day END,
      zone=CASE WHEN digest_preferences.enabled=1 AND excluded.enabled=1 THEN digest_preferences.zone ELSE excluded.zone END,
      window_start=CASE WHEN digest_preferences.enabled=1 AND excluded.enabled=1 THEN digest_preferences.window_start ELSE excluded.window_start END`).bind(flowId,operatorId,crypto.randomUUID(),mode==='daily'?1:0,now,next.at,next.day,settings!.zone,settings!.start)
    await this.db.batch([
      daily,
      this.db.prepare(`UPDATE digest_deliveries SET status='cancelled',reason='Daily email turned off.',updated_at=? WHERE flow_id=? AND operator_id=? AND status='pending' AND ?<>'daily'`).bind(now,flowId,operatorId,mode),
      this.db.prepare(`INSERT INTO notification_preferences(flow_id,operator_id,mode,updated_at) VALUES(?,?,?,?) ON CONFLICT(flow_id,operator_id) DO UPDATE SET mode=excluded.mode,updated_at=excluded.updated_at`).bind(flowId,operatorId,mode==='daily'?'off':mode,now),
      this.db.prepare(`UPDATE notification_deliveries SET status='cancelled',reason='Notifications turned off.',updated_at=? WHERE operator_id=? AND status='pending' AND ?<>'immediately' AND response_id IN (SELECT id FROM responses WHERE flow_id=?)`).bind(now,operatorId,mode,flowId),
      ...(Object.keys(this.attribution).length ? [this.db.prepare(`INSERT INTO audit_entries(id,workspace_id,kind,actor_operator_id,subject_type,subject_id,details_json,created_at) VALUES(?,?,'notification.preference_changed',?,'flow',?,?,?)`).bind(crypto.randomUUID(),workspaceId,operatorId,flowId,JSON.stringify(this.attribution),now)] : []),
    ])
    return this.read(workspaceId,flowId,operatorId)
  }
  async retry(workspaceId: string, operatorId: string, id: string, duplicateRiskAccepted: boolean, now = new Date().toISOString()) {
    const row = await this.db.prepare(`SELECT d.status,r.flow_id AS flowId FROM notification_deliveries d JOIN responses r ON r.id=d.response_id WHERE d.id=? AND d.operator_id=? AND r.workspace_id=?`).bind(id,operatorId,workspaceId).first<{status:string;flowId:string}>()
    if (!row) return this.retryDigest(workspaceId,operatorId,id,duplicateRiskAccepted,now)
    if (!['failed','unknown'].includes(row.status)) throw new ValidationError('Only failed or unknown notifications can be retried.')
    if (row.status === 'unknown' && !duplicateRiskAccepted) throw new ValidationError('Sending again may deliver a duplicate. Confirm the duplicate risk first.')
    if ((await this.read(workspaceId,row.flowId,operatorId)).mode !== 'immediately') throw new ValidationError('Choose Immediately before retrying.')
    if (this.senderError) throw new ValidationError(this.senderError)
    await this.db.batch([
      this.db.prepare(`INSERT INTO notification_attempts(id,delivery_id,ordinal,event,created_at) SELECT ?,id,attempts,'operator-retry',? FROM notification_deliveries WHERE id=? AND (status='failed' OR (status='unknown' AND ?=1))`).bind(crypto.randomUUID(),now,id,duplicateRiskAccepted ? 1 : 0),
      this.db.prepare(`UPDATE notification_deliveries SET status='pending',explicit_retry_authorized=1,available_at=?,updated_at=? WHERE id=? AND (status='failed' OR (status='unknown' AND ?=1))`).bind(now,now,id,duplicateRiskAccepted ? 1 : 0),
    ])
  }
  private async retryDigest(workspaceId:string,operatorId:string,id:string,accepted:boolean,now:string) {
    const row=await this.db.prepare(`SELECT d.status,d.replay_enabled AS replayEnabled,p.enabled FROM digest_deliveries d JOIN flows f ON f.id=d.flow_id JOIN digest_preferences p ON p.flow_id=d.flow_id AND p.operator_id=d.operator_id WHERE d.id=? AND d.operator_id=? AND f.workspace_id=?`).bind(id,operatorId,workspaceId).first<{status:string;enabled:number;replayEnabled:number}>()
    if(!row)throw new NotFoundError('This notification is not yours.')
    if(!row.replayEnabled)throw new ValidationError('Restored digest history cannot be sent again.')
    if(!row.enabled)throw new ValidationError('Choose Daily before retrying this digest.')
    if(!['failed','unknown'].includes(row.status))throw new ValidationError('Only failed or unknown digests can be retried.')
    if(row.status==='unknown'&&!accepted)throw new ValidationError('Sending again may duplicate mail. Accept the duplicate risk first.')
    if(this.senderError)throw new ValidationError(this.senderError)
    await this.db.batch([
      this.db.prepare(`INSERT OR IGNORE INTO digest_attempts(id,delivery_id,ordinal,event,created_at) SELECT ?,id,attempts,'operator-retry',? FROM digest_deliveries WHERE id=? AND (status='failed' OR (status='unknown' AND ?=1))`).bind(crypto.randomUUID(),now,id,accepted?1:0),
      this.db.prepare(`UPDATE digest_deliveries SET status='pending',retry_authorized=1,available_at=?,updated_at=? WHERE id=? AND (status='failed' OR (status='unknown' AND ?=1))`).bind(now,now,id,accepted?1:0),
    ])
  }

}
