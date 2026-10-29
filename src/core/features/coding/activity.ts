/** Native coding activity retains the preparer while relations keep the real operator. */
export function codingActivity(db: D1Database, workspaceId: string, operatorId: string | null, responseId: string | null, kind: string, at: string, attribution: Record<string, unknown>, condition = '1', bindings: unknown[] = [], subjectId: string | null = responseId) {
  return db.prepare(`INSERT INTO audit_entries(id,workspace_id,kind,actor_operator_id,subject_type,subject_id,details_json,created_at)
    SELECT ?,?,?,?, ?,?,?,? WHERE ${condition}`).bind(crypto.randomUUID(), workspaceId, kind, operatorId, responseId ? 'response' : 'code', subjectId, JSON.stringify({ changes: 1, ...attribution }), at, ...bindings)
}

/** The preceding annotation write and this activity share one native transaction. */
export function codingAssignmentActivity(db: D1Database, workspaceId: string, operatorId: string, responseId: string, answerId: string, codeId: string, at: string, attribution: Record<string, unknown>) {
  return db.prepare(`INSERT INTO audit_entries(id,workspace_id,kind,actor_operator_id,subject_type,subject_id,details_json,created_at)
    SELECT ?,ca.workspace_id,'coding.assigned',ca.actor_operator_id,'response',?,
      json_set(?, '$.coding_assignment_id',ca.id,'$.coding_assignment_source',ca.source,'$.coding_assignment_quote_id',ca.quote_id),?
    FROM answer_code_assignments ca WHERE changes()>0 AND ca.workspace_id=? AND ca.answer_id=? AND ca.code_id=? AND ca.actor_operator_id=? AND ca.created_at=?`)
    .bind(crypto.randomUUID(),responseId,JSON.stringify({changes:1,...attribution}),at,workspaceId,answerId,codeId,operatorId,at)
}

/** Resolve only the current native effect's retained agent preparer. */
export const assignmentActorLabel = `(SELECT json_extract(activity.details_json,'$.prepared_by.label') FROM audit_entries activity
  WHERE activity.workspace_id=ca.workspace_id AND activity.kind='coding.assigned'
    AND activity.actor_operator_id=ca.actor_operator_id AND activity.created_at=ca.created_at
    AND json_extract(activity.details_json,'$.coding_assignment_id')=ca.id
    AND json_extract(activity.details_json,'$.coding_assignment_source')=ca.source
    AND json_extract(activity.details_json,'$.coding_assignment_quote_id') IS ca.quote_id
    AND json_type(activity.details_json,'$.prepared_by.label')='text' ORDER BY activity.rowid DESC LIMIT 1)`
