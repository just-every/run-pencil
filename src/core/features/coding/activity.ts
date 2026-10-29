/** Native coding activity retains the preparer while relations keep the real operator. */
export function codingActivity(db: D1Database, workspaceId: string, operatorId: string | null, responseId: string | null, kind: string, at: string, attribution: Record<string, unknown>, condition = '1', bindings: unknown[] = []) {
  return db.prepare(`INSERT INTO audit_entries(id,workspace_id,kind,actor_operator_id,subject_type,subject_id,details_json,created_at)
    SELECT ?,?,?,?, ?,?,?,? WHERE ${condition}`).bind(crypto.randomUUID(), workspaceId, kind, operatorId, responseId ? 'response' : 'code', responseId, JSON.stringify({ changes: 1, ...attribution }), at, ...bindings)
}
