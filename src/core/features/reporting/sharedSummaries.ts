import { formSettings } from '../../shared/hiddenFields'
import { crossableQuestionTypes, dimensionCategories, resolveDimension } from './crosstabDimensions'
import { responseScope } from './scope'
import type { LedgerFilter } from './repository'
import type { SharedQuestion } from './savedModel'

export async function aggregateDimensions(db: D1Database, flowId: string, revisionId: string) {
  const [revision, questions] = await Promise.all([
    db.prepare("SELECT form_settings_json AS json FROM flow_revisions WHERE id=? AND flow_id=? AND state='published'").bind(revisionId, flowId).first<{ json: string }>(),
    db.prepare("SELECT stable_id AS id,question_type AS type FROM flow_steps WHERE revision_id=? AND kind='question' ORDER BY position").bind(revisionId).all<{ id: string; type: string }>(),
  ])
  const settings = formSettings(revision?.json)
  const permitted = [
    ...questions.results.filter(question => crossableQuestionTypes.includes(question.type)).map(question => `question:${question.id}`),
    ...settings.hiddenFields.filter(field => !['identifying', 'click_id'].includes(field.category)).map(field => `hidden:${field.id}`),
    ...(settings.calculations ?? []).map(calculation => `variable:${calculation.id}`),
    'collector',
  ]
  return { permitted, dimensions: await Promise.all(permitted.filter(key => key !== 'collector').map(key => resolveDimension(db, flowId, revisionId, key))) }
}

/** Fixed choice summaries remain complete; rare observed values have no published label. */
export async function sharedSummaries(db: D1Database, input: { workspaceId: string; flowId: string; revisionId: string; filter: LedgerFilter; cutoff: string; threshold: number; responseCount: number }, dimensions: Awaited<ReturnType<typeof aggregateDimensions>>['dimensions']): Promise<SharedQuestion[]> {
  const scope = responseScope(input.workspaceId, input.flowId, input.filter, input.cutoff)
  return Promise.all(dimensions.map(async dimension => {
    const result = await db.prepare(`WITH scoped AS (SELECT r.id AS rid,r.response_context_json AS ctx FROM responses r WHERE ${scope.where}), values_in_cohort AS (${dimension.valueSql}) SELECT v,COUNT(DISTINCT rid) AS n FROM values_in_cohort GROUP BY v`).bind(...scope.bindings, ...dimension.bindings).all<{ v: string | null; n: number }>()
    const totals = new Map(result.results.map(row => [row.v, row.n]))
    const categories = dimensionCategories(dimension, result.results.filter(row => row.v !== null).map(row => row.v!))
    const unanswered = totals.get(null) ?? 0
    return {
      id: dimension.key.startsWith('question:') ? dimension.key.slice(9) : dimension.key,
      prompt: dimension.label, questionType: dimension.questionType ?? dimension.kind,
      answered: input.responseCount - unanswered, unanswered, multipleSelect: dimension.multipleSelect,
      distribution: categories.flatMap(category => {
        const count = totals.get(category.key) ?? 0
        return dimension.observed && count < input.threshold ? [] : [{ label: category.label, count }]
      }),
      ...(dimension.observed ? { note: 'Observed values with fewer responses than the disclosure threshold have no published label.' } : dimension.multipleSelect ? { note: 'Multiple select: responses may appear in several categories; these counts do not partition the cohort.' } : {}),
    }
  }))
}
