import type { AuditSnapshot, AuditRow } from './model'
import { auditDetails } from './model'

// Association comes only from live workspace-owned records. Erased references,
// subject-less delivery and old orphan events deliberately have no form.
const formJoin = `LEFT JOIN flows f ON f.workspace_id = a.workspace_id AND f.id = CASE a.subject_type
  WHEN 'flow' THEN a.subject_id
  WHEN 'flow-revision' THEN (SELECT r.flow_id FROM flow_revisions r JOIN flows own ON own.id = r.flow_id AND own.workspace_id = a.workspace_id WHERE r.id = a.subject_id)
  WHEN 'response' THEN (SELECT r.flow_id FROM responses r WHERE r.id = a.subject_id AND r.workspace_id = a.workspace_id)
  WHEN 'action' THEN (SELECT e.flow_id FROM action_evidence e JOIN actions own ON own.id = e.action_id AND own.workspace_id = a.workspace_id WHERE e.action_id = a.subject_id)
  END`
type ReadRow = { id: string; kind: string; createdAt: string; actorId: string | null; actorName: string | null; flowId: string | null; flowName: string | null; detailsJson: string }

export async function readAuditRows(db: D1Database, snapshot: AuditSnapshot, limit: number): Promise<AuditRow[]> {
  const clauses = ['a.workspace_id = ?', 'a.created_at <= ?', 'a.rowid <= ?']
  const params: (string | number)[] = [snapshot.workspaceId, snapshot.cutoff, snapshot.ceiling]
  const { actorId, flowId, kind, from, to } = snapshot.filters
  for (const [value, clause] of [[actorId, 'o.id = ?'], [flowId, 'f.id = ?'], [kind, 'a.kind = ?'], [from, 'a.created_at >= ?'], [to, 'a.created_at <= ?']] as const) {
    if (value !== undefined) { clauses.push(clause); params.push(value) }
  }
  if (snapshot.after) {
    clauses.push('(a.created_at < ? OR (a.created_at = ? AND a.id < ?))')
    params.push(snapshot.after.createdAt, snapshot.after.createdAt, snapshot.after.id)
  }
  const result = await db.prepare(`SELECT a.id, a.kind, a.created_at AS createdAt,
    o.id AS actorId, o.display_name AS actorName, f.id AS flowId, f.title AS flowName, a.details_json AS detailsJson
    FROM audit_entries a LEFT JOIN operators o ON o.id = a.actor_operator_id AND o.workspace_id = a.workspace_id
    ${formJoin} WHERE ${clauses.join(' AND ')} ORDER BY a.created_at DESC, a.id DESC LIMIT ?`).bind(...params, limit).all<ReadRow>()
  return result.results.map(row => ({
    id: row.id, kind: row.kind, createdAt: row.createdAt,
    actor: row.actorId === null ? null : { id: row.actorId, name: row.actorName! },
    form: row.flowId === null ? null : { id: row.flowId, name: row.flowName! },
    details: auditDetails(row.kind, row.detailsJson),
  }))
}
