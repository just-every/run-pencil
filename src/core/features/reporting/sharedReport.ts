import { disclosureThreshold } from '../analysis'
import { crosstab } from './crosstab'
import { reportCohorts } from './sharedCohorts'
import { aggregateDimensions, sharedSummaries } from './sharedSummaries'
import type { StoredSavedView } from './savedRepository'
import type { SharedCrosstab, SharedReport } from './savedModel'

export const recoveryReason = 'A suppressed cell would be recoverable from the report’s other figures. This crosstab’s cells, totals and chi-square are withheld.'
export const protectionNotice = 'Presentation protection applies within this report at this cutoff. It is not anonymisation and does not protect against differencing between separate links, files, emails, tool calls, filters or cutoffs. Raw-authorized operators retain the ledger and exports.'

/** Recompute from retained responses so erasure cannot be undone by an old saved cutoff. */
export async function sharedReport(db: D1Database, view: StoredSavedView, thresholdFloor = view.threshold): Promise<SharedReport> {
  const threshold = Math.max(view.threshold, thresholdFloor, await disclosureThreshold(db, view.workspaceId))
  const cohorts = await reportCohorts(db, view, threshold)
  const reports = await Promise.all(cohorts.map(async cohort => {
    const base = { id: cohort.id, name: cohort.name, responseCount: cohort.responseCount }
    if (cohort.reason) return { ...base, breakdownWithheld: true, reason: cohort.reason, questions: [], crosstabs: [] }
    const revisionId = cohort.filter.revisionId!
    const dimensions = await aggregateDimensions(db, view.flowId, revisionId)
    const questions = await sharedSummaries(db, { workspaceId: view.workspaceId, flowId: view.flowId, revisionId, filter: cohort.filter, cutoff: view.cutoff, threshold, responseCount: cohort.responseCount }, dimensions.dimensions)
    const tables: SharedCrosstab[] = await Promise.all(view.definition.crosstabs.filter(cross => dimensions.permitted.includes(cross.rows) && dimensions.permitted.includes(cross.columns)).map(async cross => {
      const table = await crosstab(db, { workspaceId: view.workspaceId, flowId: view.flowId, revisionId, filter: cohort.filter, rows: cross.rows, columns: cross.columns, cutoff: view.cutoff, thresholdFloor: threshold })
      if (table.suppressedCells) return { id: cross.id, withheld: true as const, reason: recoveryReason }
      const { filter: _filter, ...safeTable } = table
      return { id: cross.id, withheld: false as const, table: { ...safeTable, filter: { revisionId, offset: undefined } } }
    }))
    return { ...base, breakdownWithheld: false, questions, crosstabs: tables }
  }))
  const safeChartIds = new Set(reports.flatMap(cohort => cohort.questions.map(question => question.id)))
  return { name: view.name, cutoff: view.cutoff, threshold, policy: 'analysis.disclosure.v1', protectionNotice, charts: view.definition.charts.filter(id => safeChartIds.has(id)), cohorts: reports }
}
