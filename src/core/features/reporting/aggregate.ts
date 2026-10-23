import { choiceValidity } from './choiceValidity'
import { choiceIdsSql } from '../../shared/otherChoices'
import { ratingScale } from '../../shared/ratingScale'
import { scoreOptions } from '../../shared/scoreQuestions'
import { sqlEmail, sqlTextWithin } from './textValidity'
import { contactValidity } from './contactValidity'
import type { AnswerSummary } from './answerSummary'
import type { ReportStep, ReportChoice } from './questionReport'
import { finiteMidpoint } from './finiteMidpoint'
import { responseScope } from './scope'
import type { LedgerFilter } from '../../shared/reportFilters'
export { finiteMidpoint }

// Each statement returns at most questions or published options, never answers.
const retainedRevision = 'EXISTS (SELECT 1 FROM flow_revisions v JOIN flows f ON f.id=v.flow_id WHERE v.id=r.revision_id AND f.id=r.flow_id AND f.workspace_id=r.workspace_id)'
const value = "json_extract(a.value_json, '$')"
const kind = 'json_type(a.value_json)'
const settings = "COALESCE(s.question_settings_json, '{}')"
const arrayValid = `NOT EXISTS (SELECT 1 FROM json_each(a.value_json) j WHERE j.type != 'text' OR NOT EXISTS (SELECT 1 FROM choice_options c WHERE c.step_id = s.id AND c.stable_id = j.value)) AND json_array_length(a.value_json) = (SELECT COUNT(DISTINCT value) FROM json_each(a.value_json))`
const valid = `CASE s.question_type
 WHEN 'short_text' THEN ${kind} = 'text' AND ${sqlTextWithin(value, 200)}
 WHEN 'long_text' THEN ${kind} = 'text' AND ${sqlTextWithin(value, 5000)}
 WHEN 'email' THEN ${kind} = 'text' AND ${sqlTextWithin(value, 200)} AND ${sqlEmail(value)}
 WHEN 'single_choice' THEN ${choiceValidity(false)}
 WHEN 'dropdown' THEN ${choiceValidity(false)}
 WHEN 'multiple_choice' THEN ${choiceValidity(true)}
 WHEN 'priority' THEN ${kind} = 'array' AND ${arrayValid} AND json_array_length(a.value_json) = (SELECT COUNT(*) FROM choice_options c WHERE c.step_id = s.id)
 WHEN 'yes_no' THEN ${kind} IN ('true','false')
 WHEN 'thumbs_rating' THEN ${kind} IN ('true','false')
 WHEN 'csat' THEN ${kind} IN ('integer','real') AND ${value} = CAST(${value} AS INTEGER) AND ${value} BETWEEN 1 AND 5
 WHEN 'ces' THEN ${kind} IN ('integer','real') AND ${value} = CAST(${value} AS INTEGER) AND ${value} BETWEEN 1 AND 7
 WHEN 'emoji_rating' THEN ${kind} IN ('integer','real') AND ${value} = CAST(${value} AS INTEGER) AND ${value} BETWEEN 1 AND 5
 ${contactValidity('a.value_json')}
 WHEN 'consent' THEN ${kind} = 'object' AND json_type(a.value_json, '$.accepted') IN ('true','false') AND json_type(a.value_json, '$.statement') = 'text' AND json_extract(a.value_json, '$.statement') = json_extract(${settings}, '$.statement') AND (s.required = 0 OR json_extract(a.value_json, '$.accepted') = 1)
 WHEN 'nps' THEN ${kind} IN ('integer','real') AND ${value} = CAST(${value} AS INTEGER) AND ${value} BETWEEN 0 AND 10
 WHEN 'rating' THEN ${kind} IN ('integer','real') AND ${value} = CAST(${value} AS INTEGER) AND ${value} BETWEEN COALESCE(json_extract(${settings}, '$.min'),1) AND COALESCE(json_extract(${settings}, '$.max'),5)
 WHEN 'number' THEN ${kind} IN ('integer','real') AND abs(${value}) <= 1.7976931348623157e308 AND ${value} >= COALESCE(json_extract(${settings}, '$.min'), -1.7976931348623157e308) AND ${value} <= COALESCE(json_extract(${settings}, '$.max'), 1.7976931348623157e308) AND (json_extract(${settings}, '$.decimalPlaces') IS NULL OR round(${value},json_extract(${settings}, '$.decimalPlaces')) = ${value})
 WHEN 'date' THEN ${kind} = 'text' AND length(${value}) = 10 AND ${value} GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND substr(${value},1,4) != '0000' AND date(${value}, '+0 days') = ${value} AND ${value} >= COALESCE(json_extract(${settings}, '$.earliest'), '0001-01-01') AND ${value} <= COALESCE(json_extract(${settings}, '$.latest'), '9999-12-31')
 ELSE 0 END`
type Aggregate = { stepId: string; answered: number; imported: number; invalid: number; average: number; minimum: number; maximum: number; earliest: string; latest: string; promoters: number; detractors: number; satisfied: number; effortTotal: number }
type Bucket = { stepId: string; value: string | number; count: number; average: number; first: number }

export async function aggregateRevision(db: D1Database, selection: { workspaceId: string; flowId: string; filter: LedgerFilter; cutoff: string }, steps: ReportStep[], choices: ReportChoice[]) {
  const scope = responseScope(selection.workspaceId, selection.flowId, selection.filter, selection.cutoff)
  const evidence = `FROM response_answers a JOIN responses r ON r.id = a.response_id
    LEFT JOIN flow_steps s ON s.revision_id = r.revision_id AND s.stable_id = a.step_id
    WHERE ${scope.where} AND ${retainedRevision}`
  const [counts, buckets, medians] = await db.batch([
    db.prepare(`SELECT s.stable_id AS stepId, COUNT(*) AS answered, SUM(r.source = 'imported') AS imported,
      SUM(CASE WHEN (${valid}) THEN 0 ELSE 1 END) AS invalid,
      AVG(CASE WHEN s.question_type = 'rating' THEN ${value} END) AS average,
      MIN(CASE WHEN s.question_type = 'number' THEN ${value} END) AS minimum,
      MAX(CASE WHEN s.question_type = 'number' THEN ${value} END) AS maximum,
      MIN(CASE WHEN s.question_type = 'date' THEN ${value} END) AS earliest,
      MAX(CASE WHEN s.question_type = 'date' THEN ${value} END) AS latest,
      SUM(s.question_type = 'nps' AND ${value} >= 9) AS promoters,
      SUM(s.question_type = 'nps' AND ${value} <= 6) AS detractors,
      SUM(s.question_type = 'csat' AND ${value} >= 4) AS satisfied,
      SUM(CASE WHEN s.question_type = 'ces' THEN ${value} ELSE 0 END) AS effortTotal
      ${evidence} GROUP BY s.stable_id`).bind(...scope.bindings),
    db.prepare(`SELECT s.stable_id AS stepId, j.value AS value, COUNT(*) AS count, SUM(j.key = 0) AS first, AVG(CAST(j.key AS INTEGER)+1) AS average
      FROM response_answers a JOIN responses r ON r.id = a.response_id
      LEFT JOIN flow_steps s ON s.revision_id = r.revision_id AND s.stable_id = a.step_id,
      json_each(CASE WHEN s.question_type = 'consent' THEN json_extract(a.value_json, '$.accepted') WHEN s.question_type IN ('single_choice','multiple_choice','dropdown') THEN ${choiceIdsSql('a.value_json')} ELSE a.value_json END) j
      WHERE ${scope.where} AND ${retainedRevision} AND s.question_type IN ('single_choice','dropdown','multiple_choice','priority','rating','nps','yes_no','consent','csat','ces','emoji_rating','thumbs_rating')
      AND (${valid}) GROUP BY s.stable_id, j.value`).bind(...scope.bindings),
    db.prepare(`WITH ranked AS (SELECT s.stable_id AS stepId, ${value} AS value,
      ROW_NUMBER() OVER (PARTITION BY s.stable_id ORDER BY ${value}) AS n,
      COUNT(*) OVER (PARTITION BY s.stable_id) AS total ${evidence} AND s.question_type = 'number')
      SELECT stepId, value AS middle FROM ranked WHERE n IN ((total+1)/2, (total+2)/2) ORDER BY stepId,n`).bind(...scope.bindings),
  ])
  const stats = new Map((counts.results as Aggregate[]).map(row => [row.stepId, row]))
  const median = new Map<string,number>()
  for (const row of medians.results as Array<{stepId:string;middle:number}>) {
    const previous = median.get(row.stepId)
    median.set(row.stepId, previous === undefined ? row.middle : finiteMidpoint(previous,row.middle))
  }
  const grouped = buckets.results as Bucket[]
  if ([...stats.values()].some(row => row.invalid)) throw new Error('Invalid retained answer. Results cannot be reported until it is corrected or erased.')
  return steps.map(step => {
    const options = choices.filter(choice => choice.stepId === step.id).map(({ id, label }) => ({ id, label }))
    const row = stats.get(step.id)
    const answered = row?.answered ?? 0
    const type = step.questionType
    const entries = grouped.filter(bucket => bucket.stepId === step.id)
    let summary: AnswerSummary = {}
    if (['short_text','long_text','email'].includes(type ?? '') || JSON.parse(step.settingsJson ?? '{}').otherChoiceId) summary = { texts: [] }
    if (answered && row) {
      if (type === 'rating') summary = { average: row.average }
      if (type === 'csat') summary = { csat: { satisfied: row.satisfied, answered, percentage: row.satisfied / answered * 100 } }
      if (type === 'ces') summary = { ces: { total: row.effortTotal, answered, mean: row.effortTotal / answered } }
      if (type === 'number') summary = { minimum: row.minimum, median: median.get(step.id), maximum: row.maximum }
      if (type === 'date') summary = { earliest: row.earliest, latest: row.latest }
      if (type === 'nps') summary = { score: (row.promoters-row.detractors)/answered*100, promoters: row.promoters, detractors: row.detractors, passives: answered-row.promoters-row.detractors }
    }
    if (type === 'priority') summary = { positions: options.map(choice => ({ ...choice, average: entries.find(bucket => bucket.value === choice.id)?.average ?? 0 })) }
    const distribution: Array<{ value: unknown; label: string; count: number }> = []
    if (['single_choice','dropdown','multiple_choice','priority'].includes(type ?? '')) for (const choice of options) distribution.push({value: choice.id, label: choice.label, count: (type === 'priority' ? entries.find(bucket => bucket.value === choice.id)?.first : entries.find(bucket => bucket.value === choice.id)?.count) ?? 0})
    if (type === 'rating' || type === 'nps') {
      const scale = type === 'rating' ? ratingScale(JSON.parse(step.settingsJson ?? '{}')) : { min:0, max:10, lowLabel:undefined, highLabel:undefined, middleLabel:undefined }
      for (let value = scale.min; value <= scale.max; value++) {
        const label = value === scale.min ? scale.lowLabel : value === scale.max ? scale.highLabel : value === (scale.min + scale.max) / 2 ? scale.middleLabel : undefined
        distribution.push({ value, label: label ? `${value} · ${label}` : String(value), count: entries.find(bucket => bucket.value === value)?.count ?? 0 })
      }
    }
    if (type && ['csat', 'ces', 'emoji_rating', 'thumbs_rating'].includes(type)) {
      for (const option of scoreOptions(type)) distribution.push({ ...option, count: entries.find(bucket => bucket.value === (typeof option.value === 'boolean' ? Number(option.value) : option.value))?.count ?? 0 })
    }
    if (type === 'yes_no' || type === 'consent') for (const value of [true,false]) distribution.push({ value, label: type === 'consent' ? value ? 'Accepted' : 'Declined' : value ? 'Yes' : 'No', count: entries.find(bucket => bucket.value === Number(value))?.count ?? 0 })
    return { ...step, importedAnswered: row?.imported ?? 0, summary, choices: options, answered, distribution, distributionLabel: type === 'multiple_choice' ? 'Multiple select; shares may total more than 100%.' : type === 'priority' ? 'First-priority choices.' : 'One answer per response.' }
  })
}
