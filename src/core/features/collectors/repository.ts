import { ulid } from 'ulid'
import { collectorLimits, type CollectorRow, type CollectorSettings } from './model'

const selection = `SELECT c.id,c.flow_id AS flowId,c.name,c.channel,c.public_key AS publicKey,c.system_source AS systemSource,
 c.deadline_at AS deadlineAt,c.deadline_time_zone AS deadlineTimeZone,c.response_limit AS responseLimit,c.closed_at AS closedAt,
 c.created_at AS createdAt,c.updated_at AS updatedAt,
 (SELECT count(*) FROM response_collector rc WHERE rc.collector_id=c.id) AS retained,
 (SELECT count(*) FROM response_collector rc JOIN responses r ON r.id=rc.response_id
  WHERE rc.collector_id=c.id AND r.flow_id=c.flow_id AND r.workspace_id=f.workspace_id AND r.state='released'
  AND r.completed_at<=? AND r.released_at<=?
  AND (r.source!='imported' OR EXISTS(SELECT 1 FROM form_import_targets t WHERE t.target_id=r.id AND t.kind='response'
    AND t.workspace_id=r.workspace_id AND t.committed_at<=?))) AS released
 FROM collectors c JOIN flows f ON f.id=c.flow_id`
type MutationIdentity = { workspaceId: string; flowId: string; operatorId: string; id: string; now: string }
export class CollectorRepository {
  constructor(private readonly db: D1Database) {}
  async flow(workspaceId: string, flowId: string) {
    return this.db.prepare(`SELECT f.id,f.slug,f.status,w.time_zone AS timeZone FROM flows f JOIN workspaces w ON w.id=f.workspace_id
      WHERE f.id=? AND f.workspace_id=?`).bind(flowId, workspaceId).first<{ id: string; slug: string; status: string; timeZone: string }>()
  }
  async actor(workspaceId: string, operatorId: string) {
    return !!await this.db.prepare('SELECT id FROM operators WHERE id=? AND workspace_id=?').bind(operatorId, workspaceId).first()
  }
  async list(workspaceId: string, flowId: string) {
    const cutoff = new Date().toISOString()
    return (await this.db.prepare(`${selection} WHERE f.workspace_id=? AND f.id=? ORDER BY c.created_at,c.id LIMIT ?`)
      .bind(cutoff, cutoff, cutoff, workspaceId, flowId, collectorLimits.perFlow + 5).all<CollectorRow>()).results
  }
  async get(workspaceId: string, flowId: string, id: string) {
    const cutoff = new Date().toISOString()
    return this.db.prepare(`${selection} WHERE f.workspace_id=? AND f.id=? AND c.id=?`).bind(cutoff, cutoff, cutoff, workspaceId, flowId, id).first<CollectorRow>()
  }
  async publicKey(flowId: string, key: string) {
    const cutoff = new Date().toISOString()
    return this.db.prepare(`${selection} WHERE f.id=? AND c.public_key=?`).bind(cutoff, cutoff, cutoff, flowId, key).first<CollectorRow>()
  }
  async publicDefault(flowId: string, id: string) {
    const cutoff = new Date().toISOString()
    return this.db.prepare(`${selection} WHERE f.id=? AND c.id=? AND c.system_source IS NOT NULL`).bind(cutoff, cutoff, cutoff, flowId, id).first<CollectorRow>()
  }
  async publicInvitation(flowId: string, token: string) {
    const cutoff = new Date().toISOString()
    return this.db.prepare(`${selection} JOIN invitation_launch_collector lc ON lc.collector_id=c.id
      JOIN invitation_participants p ON p.launch_id=lc.launch_id WHERE f.id=? AND p.token=? AND p.workspace_id=f.workspace_id`)
      .bind(cutoff, cutoff, cutoff, flowId, token).first<CollectorRow>()
  }
  async publicSession(flowId: string, sessionId: string) {
    const cutoff = new Date().toISOString()
    return this.db.prepare(`${selection} JOIN session_collector sc ON sc.collector_id=c.id
      JOIN respondent_sessions s ON s.id=sc.session_id JOIN flow_revisions v ON v.id=s.revision_id
      WHERE f.id=? AND s.id=? AND v.flow_id=f.id`)
      .bind(cutoff, cutoff, cutoff, flowId, sessionId).first<CollectorRow>()
  }
  private audit(input: MutationIdentity, kind: string) {
    return this.db.prepare(`INSERT INTO audit_entries(id,workspace_id,kind,actor_operator_id,subject_type,subject_id,details_json,created_at)
      SELECT ?,?,?,(SELECT id FROM operators WHERE id=? AND workspace_id=?),'collector',c.id,'{}',?
      FROM collectors c JOIN flows f ON f.id=c.flow_id WHERE c.id=? AND f.id=? AND f.workspace_id=? AND c.system_source IS NULL`)
      .bind(ulid(), input.workspaceId, kind, input.operatorId, input.workspaceId, input.now, input.id, input.flowId, input.workspaceId)
  }
  async create(input: MutationIdentity & CollectorSettings & { publicKey: string }) {
    const results = await this.db.batch<{ id: string }>([
      this.db.prepare(`INSERT INTO collectors(id,flow_id,name,channel,public_key,deadline_at,deadline_time_zone,response_limit,created_at,updated_at)
        SELECT ?,f.id,?,?,?,?,?,?,?,? FROM flows f WHERE f.id=? AND f.workspace_id=?
        AND (SELECT count(*) FROM collectors WHERE flow_id=f.id AND system_source IS NULL)<? RETURNING id`)
        .bind(input.id, input.name, input.channel, input.publicKey, input.deadlineAt, input.deadlineTimeZone, input.responseLimit, input.now, input.now, input.flowId, input.workspaceId, collectorLimits.perFlow),
      this.db.prepare(`INSERT INTO audit_entries(id,workspace_id,kind,actor_operator_id,subject_type,subject_id,details_json,created_at)
        SELECT ?,?,'collector.created',(SELECT id FROM operators WHERE id=? AND workspace_id=?),'collector',id,'{}',? FROM collectors WHERE id=?`)
        .bind(ulid(), input.workspaceId, input.operatorId, input.workspaceId, input.now, input.id),
    ])
    return results[0].results.some(row => row.id === input.id)
  }
  async update(input: MutationIdentity & CollectorSettings) {
    const results = await this.db.batch<{ id: string }>([
      this.db.prepare(`UPDATE collectors SET name=?,channel=?,deadline_at=?,deadline_time_zone=?,response_limit=?,updated_at=?
        WHERE id=? AND flow_id=? AND system_source IS NULL AND EXISTS(SELECT 1 FROM flows WHERE id=collectors.flow_id AND workspace_id=?) RETURNING id`)
        .bind(input.name, input.channel, input.deadlineAt, input.deadlineTimeZone, input.responseLimit, input.now, input.id, input.flowId, input.workspaceId),
      this.audit(input, 'collector.updated'),
    ])
    return results[0].results.some(row => row.id === input.id)
  }
  async setClosed(input: MutationIdentity, closed: boolean) {
    const results = await this.db.batch<{ id: string }>([
      this.db.prepare(`UPDATE collectors SET closed_at=?,updated_at=? WHERE id=? AND flow_id=? AND system_source IS NULL
        AND EXISTS(SELECT 1 FROM flows WHERE id=collectors.flow_id AND workspace_id=?) RETURNING id`)
        .bind(closed ? input.now : null, input.now, input.id, input.flowId, input.workspaceId),
      this.audit(input, closed ? 'collector.closed' : 'collector.reopened'),
    ])
    return results[0].results.some(row => row.id === input.id)
  }
  async erase(input: MutationIdentity) {
    const auditId = ulid()
    const results = await this.db.batch<{ id: string }>([
      this.db.prepare(`INSERT INTO audit_entries(id,workspace_id,kind,actor_operator_id,subject_type,subject_id,details_json,created_at)
        SELECT ?,?,'collector.deleted',(SELECT id FROM operators WHERE id=? AND workspace_id=?),'collector',NULL,'{}',?
        FROM collectors c JOIN flows f ON f.id=c.flow_id WHERE c.id=? AND c.flow_id=? AND f.workspace_id=? AND c.system_source IS NULL
        AND NOT EXISTS(SELECT 1 FROM session_collector WHERE collector_id=c.id)
        AND NOT EXISTS(SELECT 1 FROM response_collector WHERE collector_id=c.id)
        AND NOT EXISTS(SELECT 1 FROM invitation_launch_collector WHERE collector_id=c.id)`)
        .bind(auditId, input.workspaceId, input.operatorId, input.workspaceId, input.now, input.id, input.flowId, input.workspaceId),
      this.db.prepare(`DELETE FROM collectors WHERE id=? AND flow_id=? AND system_source IS NULL
        AND EXISTS(SELECT 1 FROM flows WHERE id=collectors.flow_id AND workspace_id=?)
        AND EXISTS(SELECT 1 FROM audit_entries WHERE id=?) RETURNING id`)
        .bind(input.id, input.flowId, input.workspaceId, auditId),
    ])
    return results[1].results.some(row => row.id === input.id)
  }
}
