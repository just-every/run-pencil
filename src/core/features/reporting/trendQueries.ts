import { sqlChoiceSelection, sqlChoiceAnswerValid } from './choiceValidity'
import { ValidationError } from '../../shared/errors'
import { sqlEmail, sqlTextWithin } from './textValidity'
import { responseScope } from './scope'
import { contactValidity } from './contactValidity'
import type { LedgerFilter } from './repository'
import type { TrendPeriod } from './trendPeriods'

export type TrendAggregate = { period: number; denominator: number; invalid: number; numerator: number | null; value: number | null }
const value = "json_extract(a.value_json, '$')", kind = 'json_type(a.value_json)', settings = "COALESCE(s.question_settings_json,'{}')"

function answerValid(type: string): string {
  const numeric = `${kind} IN ('integer','real') AND abs(${value}) <= 1.7976931348623157e308`
  if (['nps','csat','ces','emoji_rating','rating'].includes(type)) {
    const min = type === 'nps' ? '0' : type === 'rating' ? `COALESCE(json_extract(${settings},'$.min'),1)` : '1'
    const max = type === 'nps' ? '10' : type === 'ces' ? '7' : type === 'rating' ? `COALESCE(json_extract(${settings},'$.max'),5)` : '5'
    return `${numeric} AND ${value}=CAST(${value} AS INTEGER) AND ${value} BETWEEN ${min} AND ${max}`
  }
  if (type === 'number') return `${numeric} AND ${value} >= COALESCE(json_extract(${settings},'$.min'),-1.7976931348623157e308) AND ${value} <= COALESCE(json_extract(${settings},'$.max'),1.7976931348623157e308) AND (json_extract(${settings},'$.decimalPlaces') IS NULL OR round(${value},json_extract(${settings},'$.decimalPlaces'))=${value})`
  if (type === 'yes_no' || type === 'thumbs_rating') return `${kind} IN ('true','false')`
  if (type === 'consent') return `${kind}='object' AND json_type(a.value_json,'$.accepted') IN ('true','false') AND json_extract(a.value_json,'$.statement')=json_extract(${settings},'$.statement') AND (s.required=0 OR json_extract(a.value_json,'$.accepted')=1)`
  if (['single_choice','dropdown','multiple_choice'].includes(type)) return sqlChoiceAnswerValid()
  if (type === 'short_text' || type === 'long_text' || type === 'email') return `${kind}='text' AND ${sqlTextWithin(value,type === 'long_text' ? 5000 : 200)}${type === 'email' ? ` AND ${sqlEmail(value)}` : ''}`
  if (type === 'url') return `CASE s.question_type ${contactValidity('a.value_json')} ELSE 0 END`
  if (type === 'date') return `${kind}='text' AND length(${value})=10 AND ${value} GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND substr(${value},1,4)!='0000' AND date(${value},'+0 days')=${value} AND ${value}>=COALESCE(json_extract(${settings},'$.earliest'),'0001-01-01') AND ${value}<=COALESCE(json_extract(${settings},'$.latest'),'9999-12-31')`
  throw new ValidationError('This question does not support a trend metric.')
}

export function trendAggregation(db: D1Database, input: { workspaceId: string; flowId: string; filter: LedgerFilter; cutoff: string; stableStepId: string; type: string; metric: 'score' | 'share'; shareValue?: string | number | boolean; periods: TrendPeriod[]; otherTextValid?: string }) {
  const scope = responseScope(input.workspaceId,input.flowId,input.filter,input.cutoff)
  const binding = input.shareValue === undefined ? null : input.shareValue
  const match = ['single_choice','dropdown','multiple_choice'].includes(input.type) ? `EXISTS (SELECT 1 FROM json_each(${sqlChoiceSelection()}) j WHERE j.type='text' AND j.value=json_extract(?,'$'))`
    : input.type === 'consent' ? `json_extract(a.value_json,'$.accepted')=json_extract(?,'$')` : input.type === 'email' ? `lower(${value})=lower(json_extract(?,'$'))` : `${value}=json_extract(?,'$')`
  const numeric = ['ces','rating','number','emoji_rating'].includes(input.type)
  const numerator = input.metric === 'share' ? 'SUM(matched)' : input.type === 'nps' ? 'SUM(answer>=9)-SUM(answer<=6)' : input.type === 'csat' ? 'SUM(answer>=4)' : input.type === 'thumbs_rating' ? 'SUM(answer=1)' : 'NULL'
  const mean = input.type === 'number' ? 'CASE WHEN MAX(scale)=0 THEN 0 ELSE SUM(1.0*answer/scale)/COUNT(*)*MAX(scale) END' : 'AVG(answer)'
  const metric = input.metric === 'score' && numeric ? mean : `(${numerator})*100.0/COUNT(*)`
  return db.prepare(`WITH periods AS (SELECT CAST(key AS INTEGER) AS period,json_extract(value,'$.startAt') AS startAt,json_extract(value,'$.endAt') AS endAt FROM json_each(?)),
    evidence AS MATERIALIZED (SELECT p.period,${value} AS answer,CASE WHEN (${answerValid(input.type)}) AND (${input.otherTextValid ?? '1'}) THEN 0 ELSE 1 END AS invalid,${match} AS matched
      FROM periods p JOIN responses r ON r.completed_at>=p.startAt AND r.completed_at<p.endAt
      JOIN flow_revisions v ON v.id=r.revision_id AND v.flow_id=r.flow_id AND v.state='published' AND v.published_at<=?
      JOIN flow_steps s ON s.revision_id=v.id AND s.stable_id=? AND s.kind='question'
      JOIN response_answers a ON a.response_id=r.id AND a.step_id=s.stable_id
      WHERE ${scope.where} AND s.question_type=?),
    scales AS (SELECT period,MAX(abs(answer)) AS scale FROM evidence GROUP BY period)
    SELECT e.period,COUNT(*) AS denominator,SUM(invalid) AS invalid,${numerator} AS numerator,${metric} AS value
      FROM evidence e JOIN scales t ON t.period=e.period GROUP BY e.period ORDER BY e.period`)
    .bind(JSON.stringify(input.periods.map(({startAt,endAt}) => ({startAt,endAt}))),JSON.stringify(binding),input.cutoff,input.stableStepId,...scope.bindings,input.type)
}

export const scoreTrendTypes = ['nps','csat','ces','rating','number','emoji_rating','thumbs_rating'] as const
export const shareTrendTypes = [...scoreTrendTypes,'single_choice','dropdown','multiple_choice','yes_no','consent','short_text','long_text','email','url','date'] as const
