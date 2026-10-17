import { responseScope } from '../scope'
import { sqlChoiceAnswerValid, sqlChoiceSelection } from '../choiceValidity'
import { sqlSpecialChoiceText } from '../choiceReports'
import type { DimensionOption, CrossTabInput } from './model'
import type { Question, Option } from './options'

type Part = { sql: string; bindings: unknown[] }
export type AggregateRow = { kind: 'cell'|'row'|'column'|'stats'; rowKey:string|null; columnKey:string|null; count:number; total:number|null; invalid:number|null }
const value = "json_extract(a.value_json,'$')"
function validity(question: Question, choices: Option[]) {
  if (['single_choice','multiple_choice','dropdown'].includes(question.type)) {
    const text = sqlSpecialChoiceText([{id:question.stableId,questionType:question.type,settingsJson:question.settingsJson}],choices)
    return `(${sqlChoiceAnswerValid()}) AND (${text})`
  }
  if (question.type === 'yes_no' || question.type === 'thumbs_rating') return "json_type(a.value_json) IN ('true','false')"
  if (question.type === 'consent') return "json_type(a.value_json)='object' AND (SELECT COUNT(*) FROM json_each(a.value_json))=2 AND json_type(a.value_json,'$.accepted') IN ('true','false') AND json_type(a.value_json,'$.statement')='text' AND json_extract(a.value_json,'$.statement')=json_extract(s.question_settings_json,'$.statement') AND (s.required=0 OR json_extract(a.value_json,'$.accepted')=1)"
  const min=question.type==='nps'?'0':question.type==='rating'?"COALESCE(json_extract(s.question_settings_json,'$.min'),1)":'1'
  const max=question.type==='nps'?'10':question.type==='ces'?'7':question.type==='rating'?"COALESCE(json_extract(s.question_settings_json,'$.max'),5)":'5'
  return `json_type(a.value_json) IN ('integer','real') AND ${value}=CAST(${value} AS INTEGER) AND ${value} BETWEEN ${min} AND ${max}`
}
function parts(dimension: DimensionOption, questions: Question[], choices: Option[]): { members: Part; invalid: Part } {
  if (dimension.dimension.kind === 'collector') return {
    members: {sql:'SELECT x.responseId,json_quote(c.id) AS bucket FROM scoped x JOIN response_collector rc ON rc.response_id=x.responseId JOIN collectors c ON c.id=rc.collector_id AND c.flow_id=x.flowId',bindings:[]},
    invalid: {sql:'SELECT x.responseId FROM scoped x WHERE NOT EXISTS(SELECT 1 FROM response_collector rc JOIN collectors c ON c.id=rc.collector_id WHERE rc.response_id=x.responseId AND c.flow_id=x.flowId)',bindings:[]},
  }
  const question = questions.find(question => question.stableId === (dimension.dimension as {stepId:string}).stepId)!
  const from = 'FROM scoped x JOIN response_answers a ON a.response_id=x.responseId AND a.step_id=? JOIN flow_steps s ON s.revision_id=x.revisionId AND s.stable_id=a.step_id'
  const choice = ['single_choice','multiple_choice','dropdown'].includes(question.type)
  const bool = ['yes_no','consent','thumbs_rating'].includes(question.type)
  const scalar = question.type === 'consent' ? "json_extract(a.value_json,'$.accepted')" : value
  const key = choice ? 'json_quote(j.value)' : bool ? `CASE WHEN ${scalar}=1 THEN 'true' ELSE 'false' END` : `CAST(CAST(${value} AS INTEGER) AS TEXT)`
  return {
    members:{sql:`SELECT DISTINCT x.responseId,${key} AS bucket ${from}${choice?` JOIN json_each(${sqlChoiceSelection()}) j`:''}`,bindings:[question.stableId]},
    invalid:{sql:`SELECT x.responseId ${from} WHERE CASE WHEN (${validity(question,choices)}) THEN 0 ELSE 1 END=1`,bindings:[question.stableId]},
  }
}

/** All operations return at most one row per bucket/cell, never respondent data. */
export async function aggregateCrossTab(db: D1Database, workspaceId:string,flowId:string,input:CrossTabInput,cutoff:string,row:DimensionOption,column:DimensionOption,questions:Question[],choices:Option[]) {
  const scope = responseScope(workspaceId,flowId,{...input.filter,revisionId:input.revisionId},cutoff)
  const rows = parts(row,questions,choices), columns = parts(column,questions,choices)
  return (await db.prepare(`WITH scoped AS MATERIALIZED (SELECT r.id AS responseId,r.flow_id AS flowId,r.revision_id AS revisionId FROM responses r WHERE ${scope.where}),
    row_members AS MATERIALIZED (${rows.members.sql}), column_members AS MATERIALIZED (${columns.members.sql}),
    paired AS MATERIALIZED (SELECT DISTINCT a.responseId FROM row_members a WHERE EXISTS(SELECT 1 FROM column_members b WHERE b.responseId=a.responseId)),
    invalid AS (${rows.invalid.sql} UNION ${columns.invalid.sql})
    SELECT 'cell' AS kind,a.bucket AS rowKey,b.bucket AS columnKey,COUNT(*) AS count,NULL AS total,NULL AS invalid
      FROM row_members a JOIN column_members b ON b.responseId=a.responseId GROUP BY a.bucket,b.bucket
    UNION ALL SELECT 'row',a.bucket,NULL,COUNT(*),NULL,NULL FROM row_members a JOIN paired p ON p.responseId=a.responseId GROUP BY a.bucket
    UNION ALL SELECT 'column',NULL,b.bucket,COUNT(*),NULL,NULL FROM column_members b JOIN paired p ON p.responseId=b.responseId GROUP BY b.bucket
    UNION ALL SELECT 'stats',NULL,NULL,(SELECT COUNT(*) FROM paired),(SELECT COUNT(*) FROM scoped),(SELECT COUNT(*) FROM invalid)`)
    .bind(...scope.bindings,...rows.members.bindings,...columns.members.bindings,...rows.invalid.bindings,...columns.invalid.bindings).all<AggregateRow>()).results
}
