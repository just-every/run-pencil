import { responseScope } from './scope'
import type { StoredSavedView } from './savedRepository'

export async function reportCohorts(db: D1Database, view: StoredSavedView, threshold: number) {
  const definitions = [{ id: 'selection', name: 'Saved selection', filter: view.definition.filter }, ...view.definition.cohorts]
  const selections = definitions.map(cohort => {
    const filter = { ...view.definition.filter, ...cohort.filter, revisionId: cohort.filter.revisionId ?? view.revisionId, offset: undefined }
    return { ...cohort, filter, scope: responseScope(view.workspaceId, view.flowId, filter, view.cutoff) }
  })
  const counts = await db.batch(selections.map(cohort => db.prepare(`SELECT COUNT(*) AS n FROM responses r WHERE ${cohort.scope.where}`).bind(...cohort.scope.bindings)))
  const cohorts = selections.map((cohort, i) => ({ ...cohort, responseCount: Number((counts[i].results[0] as { n: number }).n), reason: undefined as string | undefined }))
  for (const cohort of cohorts) if (cohort.responseCount < threshold) cohort.reason = 'This cohort has fewer included responses than the disclosure threshold; no breakdown is published.'
  const comparisons: Array<{ smaller: number; statement: D1PreparedStatement }> = []
  for (let i = 0; i < cohorts.length; i++) for (let j = i + 1; j < cohorts.length; j++) {
    const difference = Math.abs(cohorts[i].responseCount - cohorts[j].responseCount)
    if (difference < 1 || difference >= threshold) continue
    comparisons.push({ smaller: cohorts[i].responseCount < cohorts[j].responseCount ? i : j,
      statement: db.prepare(`SELECT COUNT(*) AS n FROM responses r WHERE (${cohorts[i].scope.where}) AND (${cohorts[j].scope.where})`).bind(...cohorts[i].scope.bindings, ...cohorts[j].scope.bindings) })
  }
  const overlaps = comparisons.length ? await db.batch(comparisons.map(comparison => comparison.statement)) : []
  for (const [index, comparison] of comparisons.entries()) if (Number((overlaps[index].results[0] as { n: number }).n) === cohorts[comparison.smaller].responseCount) cohorts[comparison.smaller].reason = 'This subset cohort differs from another cohort in this report by fewer responses than the disclosure threshold; no breakdown is published.'
  return cohorts
}
