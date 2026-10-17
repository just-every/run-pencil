import { ulid } from 'ulid'
import { submissionBatch, bulkSubmissions } from './write'
import { readSubmissions, submissionDetail, submissionOptions } from './read'
import { submissionBulkSchema, submissionReadSchema, submissionStatusSchema, type SubmissionBulkInput, type SubmissionStatus } from './model'

export class SubmissionService {
  constructor(private readonly db: D1Database) {}
  options(workspaceId: string, flowId: string) { return submissionOptions(this.db, workspaceId, flowId) }
  read(workspaceId: string, flowId: string, responseIds: string[]) { return readSubmissions(this.db, workspaceId, flowId, submissionReadSchema.parse({ responseIds }).responseIds) }
  detail(workspaceId: string, flowId: string, responseId: string, notesOffset = 0) { return submissionDetail(this.db, workspaceId, flowId, responseId, notesOffset) }
  async createStatus(workspaceId: string, flowId: string, operatorId: string, name: string): Promise<{ status: SubmissionStatus }> {
    name = submissionStatusSchema.parse({ name }).name
    const id = ulid(), now = new Date().toISOString()
    await submissionBatch(this.db, [
      this.db.prepare(`INSERT INTO submission_write_assertions(ok) SELECT CASE WHEN
        EXISTS(SELECT 1 FROM flows WHERE id=? AND workspace_id=?) AND EXISTS(SELECT 1 FROM operators WHERE id=? AND workspace_id=?)
        AND (SELECT count(*) FROM submission_statuses WHERE flow_id=?)<50
        AND NOT EXISTS(SELECT 1 FROM submission_statuses WHERE flow_id=? AND lower(name)=lower(?)) THEN 1 ELSE 0 END`).bind(flowId, workspaceId, operatorId, workspaceId, flowId, flowId, name),
      this.db.prepare('INSERT INTO submission_statuses(id,flow_id,name,created_at) VALUES(?,?,?,?)').bind(id, flowId, name, now),
      this.db.prepare(`INSERT INTO audit_entries(id,workspace_id,kind,actor_operator_id,subject_type,subject_id,details_json,created_at) VALUES(?,?,'submission.status_created',?,'flow',?,'{"fields":1}',?)`).bind(ulid(), workspaceId, operatorId, flowId, now),
      this.db.prepare('DELETE FROM submission_write_assertions'),
    ])
    return { status: { id, name, custom: true } }
  }
  async bulk(workspaceId: string, flowId: string, operatorId: string, input: SubmissionBulkInput) {
    input = submissionBulkSchema.parse(input)
    await bulkSubmissions(this.db, workspaceId, flowId, operatorId, input)
    return this.read(workspaceId, flowId, input.responses.map(row => row.id))
  }
}
