import { ulid } from 'ulid'
import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors'
import { answerJoins, answerColumns, codableAnswer, answerText, ownedFlow, releasedAnswerResponse, type AnswerRow } from './answers'
import { workspaceCode } from './catalog'

import { activeAssignment, visibleSuggestion } from './visibility'
const quoteFrom = `${answerJoins} JOIN analysis_quotes aq ON aq.response_id=r.id AND aq.question_id=a.step_id
  JOIN analysis_runs ar ON ar.id=aq.run_id JOIN analysis_themes at ON at.id=aq.theme_id AND at.run_id=ar.id`
const quoteColumns = `${answerColumns},aq.id AS quoteId,aq.run_id AS runId,aq.theme_id AS themeId,at.title AS suggestedLabel,
  aq.start_offset AS start,aq.end_offset AS end,aq.excerpt`
type QuoteRow=AnswerRow & {quoteId:string;runId:string;themeId:string;suggestedLabel:string;start:number;end:number;excerpt:string}
function exactQuote(row:QuoteRow) { return answerText(row).slice(row.start,row.end)===row.excerpt }
export async function suggestions(db:D1Database,workspaceId:string,flowId:string,after?:string) {
  await ownedFlow(db,workspaceId,flowId)
  const rows=(await db.prepare(`SELECT ${quoteColumns} ${quoteFrom} WHERE r.workspace_id=? AND r.flow_id=?
    AND ${releasedAnswerResponse} AND ${codableAnswer} AND ${visibleSuggestion}
    ${after ? 'AND aq.id>?' : ''} ORDER BY aq.id LIMIT 51`).bind(workspaceId,flowId,...(after ? [after] : [])).all<QuoteRow>()).results
  const page=rows.slice(0,50), decisions=page.length ? (await db.prepare(`SELECT quote_id AS quoteId,decision,code_id AS codeId,actor_operator_id AS actorOperatorId,decided_at AS decidedAt
    FROM code_suggestion_decisions WHERE workspace_id=? AND quote_id IN (SELECT value FROM json_each(?))`).bind(workspaceId,JSON.stringify(page.map(row=>row.quoteId))).all()).results : []
  return {suggestions:page.filter(exactQuote).map(row=>({id:row.quoteId,runId:row.runId,themeId:row.themeId,responseId:row.responseId,questionId:row.questionId,prompt:row.prompt,suggestedLabel:row.suggestedLabel,start:row.start,end:row.end,excerpt:row.excerpt,decision:decisions.find(d=>d.quoteId===row.quoteId) ?? null})),nextAfter:rows.length>50 ? page.at(-1)!.quoteId : null}
}
export async function decideSuggestion(db:D1Database,workspaceId:string,operatorId:string,quoteId:string,input:{decision:'accepted'|'rejected';codeId?:string}) {
  if ((input.decision==='accepted')!==!!input.codeId) throw new ValidationError('Accept a suggestion with a workspace code; reject it without a code.')
  const row=await db.prepare(`SELECT ${quoteColumns} ${quoteFrom} WHERE aq.id=? AND r.workspace_id=? AND ${releasedAnswerResponse} AND ${codableAnswer} AND ${visibleSuggestion}`).bind(quoteId,workspaceId).first<QuoteRow>()
  if (!row || !exactQuote(row)) throw new NotFoundError('This exact analysis quote is not available for coding.')
  if(input.codeId) await workspaceCode(db,workspaceId,input.codeId)
  const previous=await db.prepare('SELECT quote_id AS quoteId,decision,code_id AS codeId,actor_operator_id AS actorOperatorId,decided_at AS decidedAt FROM code_suggestion_decisions WHERE quote_id=? AND workspace_id=?').bind(quoteId,workspaceId).first<{quoteId:string;decision:string;codeId:string|null;actorOperatorId:string;decidedAt:string}>()
  if(previous) {
    if(previous.decision!==input.decision || previous.codeId!==(input.codeId ?? null)) throw new ConflictError('This suggestion has already been decided differently.')
    return previous
  }
  const at=new Date().toISOString()
  const guard=`EXISTS (SELECT 1 ${quoteFrom} WHERE aq.id=? AND a.value_json=? AND r.workspace_id=? AND ${releasedAnswerResponse} AND ${codableAnswer} AND ${visibleSuggestion})`
  await db.batch([
    db.prepare(`INSERT INTO code_suggestion_decisions(quote_id,workspace_id,decision,code_id,actor_operator_id,decided_at)
      SELECT ?,?,?,?,?,? WHERE ${guard} ON CONFLICT(quote_id) DO NOTHING`).bind(quoteId,workspaceId,input.decision,input.codeId ?? null,operatorId,at,quoteId,row.valueJson,workspaceId),
    db.prepare(`INSERT INTO answer_code_assignments(id,workspace_id,answer_id,code_id,source,actor_operator_id,quote_id,created_at)
      SELECT ?,d.workspace_id,?,d.code_id,'ai_suggestion',d.actor_operator_id,d.quote_id,d.decided_at
      FROM code_suggestion_decisions d JOIN workspace_codes cc ON cc.id=d.code_id AND cc.workspace_id=d.workspace_id
      WHERE d.quote_id=? AND d.workspace_id=? AND d.decision='accepted' AND d.code_id=?
      AND d.actor_operator_id=? AND d.decided_at=? AND ${guard}
      ON CONFLICT(answer_id,code_id) DO UPDATE SET quote_id=excluded.quote_id,actor_operator_id=excluded.actor_operator_id,created_at=excluded.created_at
      WHERE EXISTS (SELECT 1 FROM answer_code_assignments ca JOIN response_answers caa ON caa.id=ca.answer_id JOIN responses r ON r.id=caa.response_id
        WHERE ca.id=answer_code_assignments.id AND NOT ${activeAssignment})`).bind(ulid(),row.answerId,quoteId,workspaceId,input.codeId ?? null,operatorId,at,quoteId,row.valueJson,workspaceId),
  ])
  const decision=await db.prepare('SELECT quote_id AS quoteId,decision,code_id AS codeId,actor_operator_id AS actorOperatorId,decided_at AS decidedAt FROM code_suggestion_decisions WHERE quote_id=? AND workspace_id=?').bind(quoteId,workspaceId).first<{quoteId:string;decision:string;codeId:string|null;actorOperatorId:string;decidedAt:string}>()
  if(!decision || decision.decision!==input.decision || decision.codeId!==(input.codeId ?? null)) throw new ConflictError('This suggestion has already been decided differently or its evidence changed.')
  return decision
}
