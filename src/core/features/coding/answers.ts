import { activeAssignment } from './visibility'
import { NotFoundError, ValidationError } from '../../shared/errors'
import { isOtherAnswer } from '../../shared/otherChoices'
import { retainedTextValid } from '../reporting'
import { responseScope } from '../reporting'
import type { LedgerFilter } from '../reporting'

/** Committed retained responses only; imported publication is an explicit custody boundary. */
export const releasedAnswerResponse = `r.state='released' AND r.completed_at IS NOT NULL AND r.released_at IS NOT NULL
  AND (r.source!='imported' OR EXISTS (SELECT 1 FROM form_import_targets it WHERE it.target_id=r.id
    AND it.kind='response' AND it.workspace_id=r.workspace_id AND it.committed_at IS NOT NULL))`

/** No contact/identity types: only plain text questions and explicit Other write-ins. */
export const codableAnswer = `(s.kind='question' AND (
  (s.question_type IN ('long_text','short_text') AND json_type(a.value_json)='text' AND length(trim(json_extract(a.value_json,'$')))>0)
  OR (s.question_type IN ('single_choice','multiple_choice','dropdown') AND json_type(a.value_json)='object'
    AND json_type(a.value_json,'$.otherText')='text' AND length(trim(json_extract(a.value_json,'$.otherText')))>0
    AND EXISTS (SELECT 1 FROM json_each(a.value_json,'$.choiceIds') j WHERE j.value=json_extract(s.question_settings_json,'$.otherChoiceId')))))`
export const answerJoins = `FROM response_answers a JOIN responses r ON r.id=a.response_id
  JOIN flow_steps s ON s.revision_id=r.revision_id AND s.stable_id=a.step_id`
export const answerColumns = `a.id AS answerId,r.id AS responseId,r.flow_id AS flowId,r.revision_id AS revisionId,
  a.step_id AS questionId,s.prompt,s.question_type AS questionType,s.question_settings_json AS settingsJson,a.value_json AS valueJson`
export type AnswerRow = { answerId: string; responseId: string; flowId: string; revisionId: string; questionId: string; prompt: string; questionType: string; settingsJson: string | null; valueJson: string }
export function answerText(row: AnswerRow) {
  const value: unknown = JSON.parse(row.valueJson)
  const settings = JSON.parse(row.settingsJson ?? '{}') as { otherChoiceId?: string }
  const text = isOtherAnswer(value) && settings.otherChoiceId && value.choiceIds.includes(settings.otherChoiceId) ? value.otherText : value
  if (!retainedTextValid(isOtherAnswer(value) ? 'short_text' : row.questionType,text) || !text.trim()) throw new ValidationError('This retained answer is not valid open text.')
  return text
}
export async function ownedFlow(db: D1Database, workspaceId: string, flowId: string) {
  if (!await db.prepare('SELECT id FROM flows WHERE id=? AND workspace_id=?').bind(flowId,workspaceId).first()) throw new NotFoundError('This form is not in your workspace.')
}
export async function retainedAnswer(db: D1Database, workspaceId: string, responseId: string, questionId: string) {
  const row = await db.prepare(`SELECT ${answerColumns} ${answerJoins} WHERE r.workspace_id=? AND r.id=? AND a.step_id=?
    AND ${releasedAnswerResponse} AND ${codableAnswer}`).bind(workspaceId,responseId,questionId).first<AnswerRow>()
  if (!row) throw new NotFoundError('This released text answer is not available.')
  answerText(row)
  return row
}
export const assignmentColumns = `ca.id,ca.answer_id AS answerId,ca.code_id AS codeId,cc.label,ca.source,
  ca.actor_operator_id AS actorOperatorId,ca.quote_id AS quoteId,aq.run_id AS runId,aq.theme_id AS themeId,ca.created_at AS createdAt`
export const assignmentJoins = `FROM answer_code_assignments ca JOIN workspace_codes cc ON cc.id=ca.code_id AND cc.workspace_id=ca.workspace_id
  LEFT JOIN analysis_quotes aq ON aq.id=ca.quote_id
  JOIN response_answers caa ON caa.id=ca.answer_id JOIN responses r ON r.id=caa.response_id`
export async function listAnswers(db: D1Database, workspaceId: string, flowId: string, input: LedgerFilter & { questionId?: string; after?: string }) {
  await ownedFlow(db,workspaceId,flowId)
  const {where,bindings}=responseScope(workspaceId,flowId,input,new Date().toISOString())
  const rows=(await db.prepare(`SELECT ${answerColumns} ${answerJoins} WHERE ${where} AND ${codableAnswer}
    ${input.questionId ? 'AND a.step_id=?' : ''} ${input.after ? 'AND a.id>?' : ''} ORDER BY a.id LIMIT 51`)
    .bind(...bindings,...(input.questionId ? [input.questionId] : []),...(input.after ? [input.after] : [])).all<AnswerRow>()).results
  const page=rows.slice(0,50), ids=page.map(row=>row.answerId)
  const assignments=ids.length ? (await db.prepare(`SELECT ${assignmentColumns} ${assignmentJoins}
    WHERE ca.workspace_id=? AND ${activeAssignment} AND ca.answer_id IN (SELECT value FROM json_each(?)) ORDER BY ca.created_at,ca.id`).bind(workspaceId,JSON.stringify(ids)).all()).results : []
  return { answers:page.map(row=>({answerId:row.answerId,responseId:row.responseId,questionId:row.questionId,revisionId:row.revisionId,prompt:row.prompt,text:answerText(row),assignments:assignments.filter(c=>c.answerId===row.answerId)})),nextAfter:rows.length>50 ? page.at(-1)!.answerId : null }
}
