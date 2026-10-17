import { NotFoundError } from '../../shared/errors'
import { builtinStatuses, submissionLimits, type SubmissionDetail, type SubmissionMetadata, type SubmissionNote, type SubmissionOptions, type SubmissionOperator, type SubmissionStatus } from './model'
export const releasedSubmission = "r.state='released' AND (r.source!='imported' OR EXISTS(SELECT 1 FROM form_import_targets it WHERE it.target_id=r.id AND it.kind='response' AND it.workspace_id=r.workspace_id))"
export async function requireSubmissionFlow(db: D1Database, workspaceId: string, flowId: string) {
  if (!await db.prepare('SELECT id FROM flows WHERE id=? AND workspace_id=?').bind(flowId, workspaceId).first()) throw new NotFoundError('This form is not in your workspace.')
}
export async function submissionOptions(db: D1Database, workspaceId: string, flowId: string): Promise<SubmissionOptions> {
  await requireSubmissionFlow(db, workspaceId, flowId)
  const [statuses, operators] = await db.batch([
    db.prepare('SELECT id,name,1 AS custom FROM submission_statuses WHERE flow_id=? ORDER BY created_at,id').bind(flowId),
    db.prepare('SELECT id,display_name AS displayName FROM operators WHERE workspace_id=? ORDER BY display_name,id').bind(workspaceId),
  ])
  return { statuses: [...builtinStatuses, ...(statuses.results as SubmissionStatus[]).map(status => ({ ...status, custom: true }))], operators: operators.results as SubmissionOperator[], limits: submissionLimits }
}
export async function readSubmissions(db: D1Database, workspaceId: string, flowId: string, responseIds: string[]): Promise<{ submissions: SubmissionMetadata[] }> {
  await requireSubmissionFlow(db, workspaceId, flowId)
  const ids = JSON.stringify(responseIds)
  // All reads have the same bounded response cohort; no answer or note body is loaded for a page.
  const [rows, tags] = await db.batch([
    db.prepare(`SELECT r.id AS responseId,COALESCE(w.version,0) AS version,COALESCE(w.status_id,'new') AS statusId,w.updated_at AS updatedAt,
      o.id AS assigneeId,o.display_name AS assigneeName,(SELECT count(*) FROM submission_notes n WHERE n.response_id=r.id) AS noteCount
      FROM responses r LEFT JOIN submission_workflows w ON w.response_id=r.id LEFT JOIN operators o ON o.id=w.assignee_id AND o.workspace_id=r.workspace_id
      WHERE r.workspace_id=? AND r.flow_id=? AND ${releasedSubmission} AND r.id IN (SELECT value FROM json_each(?))`).bind(workspaceId, flowId, ids),
    db.prepare(`SELECT t.response_id AS responseId,t.tag FROM submission_tags t JOIN responses r ON r.id=t.response_id WHERE r.workspace_id=? AND r.flow_id=? AND ${releasedSubmission} AND r.id IN (SELECT value FROM json_each(?)) ORDER BY t.tag`).bind(workspaceId, flowId, ids),
  ])
  type Row = Omit<SubmissionMetadata, 'assignee' | 'tags'> & { assigneeId: string | null; assigneeName: string | null }
  if (rows.results.length !== responseIds.length) throw new NotFoundError('One or more released submissions are not in this form.')
  const items = rows.results as Row[], tagRows = tags.results as Array<{ responseId: string; tag: string }>
  return { submissions: responseIds.map(id => { const { assigneeId, assigneeName, ...row } = items.find(item => item.responseId === id)!; return { ...row, assignee: assigneeId ? { id: assigneeId, displayName: assigneeName! } : null, tags: tagRows.filter(tag => tag.responseId === id).map(tag => tag.tag) } }) }
}
export async function submissionDetail(db: D1Database, workspaceId: string, flowId: string, responseId: string, notesOffset: number): Promise<SubmissionDetail> {
  const { submissions: [submission] } = await readSubmissions(db, workspaceId, flowId, [responseId])
  const rows = (await db.prepare(`SELECT n.id,n.text,n.created_at AS createdAt,o.id AS authorId,o.display_name AS authorName FROM submission_notes n
    JOIN responses r ON r.id=n.response_id LEFT JOIN operators o ON o.id=n.author_id AND o.workspace_id=r.workspace_id
    WHERE n.response_id=? AND r.workspace_id=? AND r.flow_id=? AND ${releasedSubmission} ORDER BY n.created_at,n.id LIMIT 50 OFFSET ?`).bind(responseId, workspaceId, flowId, notesOffset).all<{ id: string; text: string; createdAt: string; authorId: string | null; authorName: string | null }>()).results
  const notes: SubmissionNote[] = rows.map(({ authorId, authorName, ...note }) => ({ ...note, author: authorId ? { id: authorId, displayName: authorName! } : null }))
  return { submission, notes, notesOffset, ...(notesOffset + notes.length < submission.noteCount ? { nextNotesOffset: notesOffset + notes.length } : {}) }
}
