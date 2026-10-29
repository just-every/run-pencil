import { codingActivity } from './activity'
import { activeAssignment } from './visibility'
import { ulid } from 'ulid'
import { ConflictError } from '../../shared/errors'
import { retainedAnswer, assignmentColumns, assignmentJoins, releasedAnswerResponse } from './answers'
import { workspaceCode } from './catalog'
export async function assignManually(db: D1Database, workspaceId: string, operatorId: string, responseId: string, questionId: string, codeId: string, attribution: Record<string, unknown> = {}) {
  const answer=await retainedAnswer(db,workspaceId,responseId,questionId)
  await workspaceCode(db,workspaceId,codeId)
  const at=new Date().toISOString()
  await db.batch([db.prepare(`INSERT INTO answer_code_assignments(id,workspace_id,answer_id,code_id,source,actor_operator_id,created_at)
    SELECT ?,?,?,?,'manual',?,? WHERE EXISTS (SELECT 1 FROM response_answers a JOIN responses r ON r.id=a.response_id
      WHERE a.id=? AND a.value_json=? AND r.workspace_id=? AND ${releasedAnswerResponse})
      AND EXISTS (SELECT 1 FROM workspace_codes WHERE id=? AND workspace_id=?)
    ON CONFLICT(answer_id,code_id) DO UPDATE SET source='manual',actor_operator_id=excluded.actor_operator_id,quote_id=NULL,created_at=excluded.created_at
      WHERE EXISTS (SELECT 1 FROM answer_code_assignments ca JOIN response_answers caa ON caa.id=ca.answer_id JOIN responses r ON r.id=caa.response_id
        WHERE ca.id=answer_code_assignments.id AND NOT ${activeAssignment})`).bind(ulid(),workspaceId,answer.answerId,codeId,operatorId,at,answer.answerId,answer.valueJson,workspaceId,codeId,workspaceId),
    codingActivity(db,workspaceId,operatorId,responseId,'coding.assigned',at,attribution,'EXISTS(SELECT 1 FROM answer_code_assignments WHERE workspace_id=? AND answer_id=? AND code_id=? AND actor_operator_id=? AND created_at=?)',[workspaceId,answer.answerId,codeId,operatorId,at])])
  const stored=await db.prepare(`SELECT ${assignmentColumns} ${assignmentJoins} WHERE ca.workspace_id=? AND ca.answer_id=? AND ca.code_id=?`).bind(workspaceId,answer.answerId,codeId).first()
  if (!stored) throw new ConflictError('This answer changed while its code was being saved. Refresh the answers.')
  return stored
}
export async function removeAssignment(db: D1Database, workspaceId: string, responseId: string, questionId: string, codeId: string, operatorId: string | null = null, attribution: Record<string, unknown> = {}) {
  const answer=await retainedAnswer(db,workspaceId,responseId,questionId)
  await workspaceCode(db,workspaceId,codeId)
  const at=new Date().toISOString()
  await db.batch([codingActivity(db,workspaceId,operatorId,responseId,'coding.removed',at,attribution,'EXISTS(SELECT 1 FROM answer_code_assignments WHERE workspace_id=? AND answer_id=? AND code_id=?)',[workspaceId,answer.answerId,codeId]),
    db.prepare('DELETE FROM answer_code_assignments WHERE workspace_id=? AND answer_id=? AND code_id=?').bind(workspaceId,answer.answerId,codeId)])
}
