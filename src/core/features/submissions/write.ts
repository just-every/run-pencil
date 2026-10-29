import { ConflictError } from '../../shared/errors'
import { builtinStatuses, type SubmissionBulkInput } from './model'
import { releasedSubmission } from './read'

const builtinIds = builtinStatuses.map(status => `'${status.id}'`).join(',')
const cte = `WITH input AS (SELECT ? AS changes,? AS workspace,? AS flow,? AS actor,? AS now),
  selected AS (SELECT json_extract(value,'$.id') AS id,json_extract(value,'$.version') AS version FROM json_each(?)) `
const cohort = `FROM responses r JOIN selected s ON s.id=r.id LEFT JOIN submission_workflows w ON w.response_id=r.id CROSS JOIN input i WHERE r.workspace_id=i.workspace AND r.flow_id=i.flow`
const statusChanged = "(json_type(i.changes,'$.statusId') IS NOT NULL AND json_extract(i.changes,'$.statusId')!=COALESCE(w.status_id,'new'))"
const assignmentChanged = "(json_type(i.changes,'$.assigneeId') IS NOT NULL AND json_extract(i.changes,'$.assigneeId') IS NOT w.assignee_id)"
const tagsChanged = `(EXISTS(SELECT 1 FROM json_each(i.changes,'$.addTags') a WHERE NOT EXISTS(SELECT 1 FROM submission_tags t WHERE t.response_id=r.id AND t.tag=a.value))
  OR EXISTS(SELECT 1 FROM submission_tags t JOIN json_each(i.changes,'$.removeTags') d ON d.value=t.tag WHERE t.response_id=r.id))`
const noteAdded = "json_type(i.changes,'$.note') IS NOT NULL"
const changed = `(${statusChanged} OR ${assignmentChanged} OR ${tagsChanged} OR ${noteAdded})`

/** A failed guard aborts D1's entire batch, including audit and notes. Never retry a write on behalf of a caller. */
export async function submissionBatch(db: D1Database, statements: D1PreparedStatement[]) {
  try { await db.batch(statements) } catch (error) {
    const message = String(error instanceof Error ? `${error.message} ${error.cause ?? ''}` : error)
    if (/submission_write_assertions|submission_write_valid|submission_statuses.flow_id|submission_status_name/i.test(message)) throw new ConflictError('The submissions or available options changed. Reload the form and try again.')
    throw error
  }
}
export async function bulkSubmissions(db: D1Database, workspaceId: string, flowId: string, operatorId: string, input: SubmissionBulkInput, attribution: Record<string, unknown> = {}) {
  const args = [JSON.stringify(input.changes), workspaceId, flowId, operatorId, new Date().toISOString(), JSON.stringify(input.responses)]
  const statement = (sql: string) => db.prepare(cte + sql).bind(...args)
  const guard = `EXISTS(SELECT 1 FROM flows f,input i WHERE f.id=i.flow AND f.workspace_id=i.workspace)
    AND EXISTS(SELECT 1 FROM operators o,input i WHERE o.id=i.actor AND o.workspace_id=i.workspace)
    AND NOT EXISTS(SELECT 1 FROM selected s LEFT JOIN responses r ON r.id=s.id LEFT JOIN submission_workflows w ON w.response_id=r.id CROSS JOIN input i
      WHERE r.id IS NULL OR r.workspace_id!=i.workspace OR r.flow_id!=i.flow OR NOT (${releasedSubmission}) OR COALESCE(w.version,0)!=s.version)
    AND NOT EXISTS(SELECT 1 FROM input i WHERE json_type(i.changes,'$.statusId') IS NOT NULL AND json_extract(i.changes,'$.statusId') NOT IN (${builtinIds})
      AND NOT EXISTS(SELECT 1 FROM submission_statuses st WHERE st.flow_id=i.flow AND st.id=json_extract(i.changes,'$.statusId')))
    AND NOT EXISTS(SELECT 1 FROM input i WHERE json_type(i.changes,'$.assigneeId')='text'
      AND NOT EXISTS(SELECT 1 FROM operators o WHERE o.workspace_id=i.workspace AND o.id=json_extract(i.changes,'$.assigneeId')))
    AND NOT EXISTS(SELECT 1 FROM selected s CROSS JOIN input i WHERE
      (SELECT count(*) FROM (SELECT t.tag FROM submission_tags t WHERE t.response_id=s.id AND t.tag NOT IN(SELECT value FROM json_each(i.changes,'$.removeTags'))
        UNION SELECT value FROM json_each(i.changes,'$.addTags'))) > 20
      OR (json_type(i.changes,'$.note') IS NOT NULL AND (SELECT count(*) FROM submission_notes n WHERE n.response_id=s.id)>=200))`
  const audit = (kind: string, predicate: string) => db.prepare(cte + `INSERT INTO audit_entries(id,workspace_id,kind,actor_operator_id,subject_type,subject_id,details_json,created_at)
    SELECT lower(hex(randomblob(16))),i.workspace,'${kind}',i.actor,'response',r.id,json(?),i.now ${cohort} AND ${predicate}`).bind(...args, JSON.stringify({ fields: 1, ...attribution }))
  await submissionBatch(db, [
    statement(`INSERT INTO submission_write_assertions(ok) SELECT CASE WHEN ${guard} THEN 1 ELSE 0 END`),
    audit('submission.status_changed', statusChanged), audit('submission.assignment_changed', assignmentChanged), audit('submission.tags_changed', tagsChanged), audit('submission.note_added', noteAdded),
    statement(`INSERT INTO submission_workflows(response_id,status_id,assignee_id,version,updated_at)
      SELECT r.id,COALESCE(json_extract(i.changes,'$.statusId'),COALESCE(w.status_id,'new')),
        CASE WHEN json_type(i.changes,'$.assigneeId') IS NOT NULL THEN json_extract(i.changes,'$.assigneeId') ELSE w.assignee_id END,COALESCE(w.version,0)+1,i.now ${cohort} AND ${changed}
      ON CONFLICT(response_id) DO UPDATE SET status_id=excluded.status_id,assignee_id=excluded.assignee_id,version=excluded.version,updated_at=excluded.updated_at`),
    statement(`DELETE FROM submission_tags WHERE response_id IN(SELECT id FROM selected) AND tag IN(SELECT value FROM input i,json_each(i.changes,'$.removeTags'))`),
    statement(`INSERT INTO submission_tags(response_id,tag) SELECT DISTINCT s.id,a.value FROM selected s CROSS JOIN input i JOIN json_each(i.changes,'$.addTags') a WHERE NOT EXISTS(SELECT 1 FROM submission_tags t WHERE t.response_id=s.id AND t.tag=a.value) ON CONFLICT(response_id,tag) DO NOTHING`),
    statement(`INSERT INTO submission_notes(id,response_id,text,author_id,created_at) SELECT lower(hex(randomblob(16))),s.id,json_extract(i.changes,'$.note'),i.actor,i.now FROM selected s CROSS JOIN input i WHERE ${noteAdded}`),
    db.prepare('DELETE FROM submission_write_assertions'),
  ])
}
