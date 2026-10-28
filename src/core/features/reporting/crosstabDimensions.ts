import { matrixRows, matrixMultiple } from '../../shared/matrix'
import { matrixValidity } from './matrixValidity'
import { ValidationError } from '../../shared/errors'
import { choiceIdsSql } from '../../shared/otherChoices'
import { ratingScale } from '../../shared/ratingScale'
import { scoreOptions } from '../../shared/scoreQuestions'
import { formSettings } from '../../shared/hiddenFields'
import type { CrosstabCategory } from './crosstabStats'

/** `question:<stable step ID>`, `hidden:<field ID>`, `variable:<calculation ID>` `matrix:<stable step ID>:<stable row ID>` or `collector`. */
export type DimensionKey = string
export type DimensionKind = 'question' | 'matrix' | 'hidden' | 'variable' | 'collector'
/** Fixed categories come from the published revision; observed ones are the distinct retained values. */
export type Dimension = { key: DimensionKey; kind: DimensionKind; label: string; questionType?: string; multipleSelect: boolean; categories?: CrosstabCategory[]; observed?: 'text' | 'number' | 'mixed'; omitEmpty?: boolean; valueSql: string; bindings: unknown[]; note?: string }
export const observedCategoryLimit = 50
export const crossableQuestionTypes = ['single_choice', 'dropdown', 'multiple_choice', 'priority', 'yes_no', 'consent', 'thumbs_rating', 'rating', 'nps', 'csat', 'ces', 'emoji_rating', 'number', 'date']
export const dimensionPattern = /^(?:(?:question|hidden|variable):[^\u0000-\u001f\u007f]{1,200}|matrix:[^:\u0000-\u001f\u007f]{1,200}:[^:\u0000-\u001f\u007f]{1,200}|collector)$/

const answerJoin = 'LEFT JOIN response_answers a ON a.response_id = s.rid AND a.step_id = ?'
const integerKey = "CAST(CAST(json_extract(a.value_json, '$') AS INTEGER) AS TEXT)"
/** Numbers are keyed as JSON reals so that 3 and 3.0 are one category. */
const contextKey = (alias: string) => `CASE WHEN ${alias}.key IS NULL THEN NULL ELSE CASE ${alias}.type WHEN 'true' THEN 'true' WHEN 'false' THEN 'false' WHEN 'null' THEN NULL WHEN 'integer' THEN json_quote(CAST(${alias}.value AS REAL)) WHEN 'real' THEN json_quote(${alias}.value) ELSE json_quote(${alias}.value) END END`

/** Each dimension yields `(rid, v)` rows over the scoped responses; `v` is NULL when unanswered. */
export async function resolveDimension(db: D1Database, flowId: string, revisionId: string, key: DimensionKey): Promise<Dimension> {
  if (key === 'collector') {
    const collectors = (await db.prepare('SELECT id, name FROM collectors WHERE flow_id = ? ORDER BY created_at, id').bind(flowId).all<{ id: string; name: string }>()).results
    return { key, kind: 'collector', label: 'Collector', multipleSelect: false, omitEmpty: true, note: 'Collectors with no responses in this selection are not listed.', categories: collectors.map(collector => ({ key: collector.id, label: collector.name })),
      valueSql: 'SELECT s.rid, rc.collector_id AS v FROM scoped s LEFT JOIN response_collector rc ON rc.response_id = s.rid', bindings: [] }
  }
  const [kind, id] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)] as [DimensionKind, string]
  if (kind === 'hidden' || kind === 'variable') {
    const revision = await db.prepare("SELECT form_settings_json AS json FROM flow_revisions WHERE id = ? AND flow_id = ? AND state = 'published'").bind(revisionId, flowId).first<{ json: string }>()
    const settings = formSettings(revision?.json)
    const declared = kind === 'hidden' ? settings.hiddenFields.find(field => field.id === id) : settings.calculations?.find(calculation => calculation.id === id)
    if (!declared) throw new ValidationError(`This ${kind === 'hidden' ? 'hidden field' : 'calculated value'} is not declared on the selected revision.`)
    const numeric = declared.type === 'number'
    return { key, kind, label: kind === 'hidden' ? `Hidden field ${declared.name}` : `Calculated ${declared.name}`, multipleSelect: false, observed: numeric ? 'number' : declared.type === 'boolean' ? 'mixed' : 'text',
      note: numeric ? 'Each distinct calculated or numeric value is its own category, in numeric order.' : undefined,
      valueSql: `SELECT s.rid, ${contextKey('c')} AS v FROM scoped s LEFT JOIN json_each(s.ctx, '$.${kind === 'hidden' ? 'hidden' : 'calculations'}') c ON c.key = ?`, bindings: [id] }
  }
  const [stepId, matrixRowId] = kind === 'matrix' ? id.split(':') : [id, undefined]
  if (kind !== 'question' && kind !== 'matrix') throw new ValidationError('Choose a question, hidden field, calculated value or collector.')
  const step = await db.prepare("SELECT id AS rowId, prompt, question_type AS type, question_settings_json AS settingsJson FROM flow_steps WHERE revision_id = ? AND stable_id = ? AND kind = 'question'").bind(revisionId, stepId).first<{ rowId: string; prompt: string; type: string; settingsJson: string | null }>()
  if (!step) throw new ValidationError('This question is not part of the selected revision.')
  if (kind === 'matrix') {
    const settings = JSON.parse(step.settingsJson ?? '{}') as Record<string, unknown>
    const row = matrixRows(settings).find(row => row.id === matrixRowId)
    if (step.type !== 'matrix' || !row) throw new ValidationError('This matrix row is not part of the selected revision.')
    const options = (await db.prepare('SELECT stable_id AS key, label FROM choice_options WHERE step_id=? ORDER BY position').bind(step.rowId).all<CrosstabCategory>()).results
    return { key, kind, label: `${step.prompt}: ${row.label}`, questionType: 'matrix', multipleSelect: matrixMultiple(settings), categories: options,
      valueSql: `SELECT s.rid, CASE WHEN a.value_json IS NOT NULL AND NOT COALESCE((${matrixValidity('a.value_json', "COALESCE(q.question_settings_json, '{}')", 'q.required', 'q')}),0) THEN char(0) ELSE picked.value END AS v
        FROM scoped s ${answerJoin} JOIN flow_steps q ON q.id=?
        LEFT JOIN json_each(a.value_json) m ON m.key=?
        LEFT JOIN json_each(CASE WHEN m.type='array' THEN m.value ELSE json_array(m.value) END) picked`,
      bindings: [stepId, step.rowId, row.id] }
  }
  if (!crossableQuestionTypes.includes(step.type)) throw new ValidationError('Open-text and contact answers are not crossed. Choose a structured question.')
  const base = { key, kind, label: step.prompt, questionType: step.type, multipleSelect: step.type === 'multiple_choice', bindings: [id] }
  const settings = JSON.parse(step.settingsJson ?? '{}') as Record<string, unknown>
  if (['single_choice', 'dropdown', 'multiple_choice', 'priority'].includes(step.type)) {
    const options = (await db.prepare('SELECT stable_id AS key, label FROM choice_options WHERE step_id = ? ORDER BY position').bind(step.rowId).all<CrosstabCategory>()).results
    return { ...base, categories: options, note: step.type === 'priority' ? 'Each response counts under its first-priority choice.' : undefined,
      valueSql: step.type === 'priority' ? `SELECT s.rid, json_extract(a.value_json, '$[0]') AS v FROM scoped s ${answerJoin}`
        : `SELECT s.rid, j.value AS v FROM scoped s ${answerJoin} LEFT JOIN json_each(CASE WHEN a.value_json IS NULL THEN '[null]' ELSE ${choiceIdsSql('a.value_json')} END) j` }
  }
  if (step.type === 'yes_no' || step.type === 'consent' || step.type === 'thumbs_rating') {
    const path = step.type === 'consent' ? '$.accepted' : '$'
    const categories = step.type === 'thumbs_rating' ? scoreOptions(step.type).map(option => ({ key: String(option.value), label: option.label }))
      : [{ key: 'true', label: step.type === 'consent' ? 'Accepted' : 'Yes' }, { key: 'false', label: step.type === 'consent' ? 'Declined' : 'No' }]
    return { ...base, categories, valueSql: `SELECT s.rid, CASE json_type(a.value_json, '${path}') WHEN 'true' THEN 'true' WHEN 'false' THEN 'false' ELSE json_type(a.value_json, '${path}') END AS v FROM scoped s ${answerJoin}` }
  }
  if (['rating', 'nps', 'csat', 'ces', 'emoji_rating'].includes(step.type)) {
    let categories: CrosstabCategory[]
    if (step.type === 'rating' || step.type === 'nps') {
      const scale = step.type === 'rating' ? ratingScale(settings) : { min: 0, max: 10, lowLabel: '', middleLabel: '', highLabel: '' }
      categories = []
      for (let value = scale.min; value <= scale.max; value++) {
        const label = value === scale.min ? scale.lowLabel : value === scale.max ? scale.highLabel : value === (scale.min + scale.max) / 2 ? scale.middleLabel : ''
        categories.push({ key: String(value), label: label ? `${value} · ${label}` : String(value) })
      }
    } else categories = scoreOptions(step.type).map(option => ({ key: String(option.value), label: `${option.value} · ${option.label}` }))
    return { ...base, categories, valueSql: `SELECT s.rid, CASE WHEN a.value_json IS NULL THEN NULL WHEN json_type(a.value_json) IN ('integer','real') AND json_extract(a.value_json, '$') = CAST(json_extract(a.value_json, '$') AS INTEGER) THEN ${integerKey} ELSE json_quote(json_extract(a.value_json, '$')) END AS v FROM scoped s ${answerJoin}` }
  }
  return { ...base, observed: step.type === 'number' ? 'number' : 'text', note: step.type === 'number' ? 'Each distinct calculated or numeric value is its own category, in numeric order.' : 'Each distinct date is its own category.',
    valueSql: `SELECT s.rid, CASE WHEN a.value_json IS NULL THEN NULL WHEN json_type(a.value_json) IN ('integer','real') THEN json_quote(CAST(json_extract(a.value_json, '$') AS REAL)) ELSE json_quote(json_extract(a.value_json, '$')) END AS v FROM scoped s ${answerJoin}` }
}

/** Observed values become categories; a fixed dimension refuses a value outside its published set. */
export function dimensionCategories(dimension: Dimension, observed: string[]): CrosstabCategory[] {
  if (dimension.categories) {
    const known = new Set(dimension.categories.map(category => category.key))
    if (observed.some(value => !known.has(value))) throw new Error('A retained answer is outside its published options. Results cannot be crossed until it is corrected or erased.')
    return dimension.omitEmpty ? dimension.categories.filter(category => observed.includes(category.key)) : dimension.categories
  }
  if (observed.length > observedCategoryLimit) throw new ValidationError(`${dimension.label} has more than ${observedCategoryLimit} distinct values in this selection. Narrow the filter or choose another dimension.`)
  const parsed = observed.map(key => ({ key, value: JSON.parse(key) as string | number | boolean }))
  parsed.sort((a, b) => typeof a.value === 'number' && typeof b.value === 'number' ? a.value - b.value : a.key < b.key ? -1 : a.key > b.key ? 1 : 0)
  return parsed.map(({ key, value }) => ({ key, label: String(value) }))
}
