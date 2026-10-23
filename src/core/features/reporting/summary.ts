import { trafficDay } from '../../shared/trafficDay'
import type { LedgerFilter } from '../../shared/reportFilters'
import { responseScope } from './scope'

export function responseRateFilter(filter: LedgerFilter) {
  return Object.entries(filter).some(([key,value]) => !['revisionId','offset','from','to'].includes(key) && value !== undefined && value !== '')
}
/** Result counts are aggregated over one selection in one D1 batch. */
export async function resultSummary(db: D1Database, input: {workspaceId:string;flowId:string;filter:LedgerFilter}) {
  const { workspaceId, flowId, filter } = input
  const cutoff = new Date().toISOString()
  const released = responseScope(workspaceId, flowId, filter, cutoff)
  const quarantined = responseScope(workspaceId, flowId, filter, cutoff, 'quarantined')
  const workspace = await db.prepare('SELECT time_zone AS zone FROM workspaces WHERE id=?').bind(workspaceId).first<{zone:string}>()
  if (!workspace) throw new Error('The results workspace is unavailable.')
  const from = filter.from ? trafficDay(filter.from, workspace.zone) : null
  const to = filter.to ? trafficDay(filter.to, workspace.zone) : null
  const revision = filter.revisionId ? ' AND v.id=?' : ''
  const selected = [flowId, ...(filter.revisionId ? [filter.revisionId] : [])]
  const period = ' AND (? IS NULL OR t.day>=?) AND (? IS NULL OR t.day<=?)'
  const [responses, cohort, counters, views, periodStarts] = await db.batch([
    db.prepare(`SELECT COUNT(*) AS completed, COALESCE(SUM(r.source='imported'),0) AS imported,
      COALESCE(SUM(r.source!='imported'),0) AS native,
      COALESCE(SUM(CASE WHEN r.source!='imported' THEN r.completion_milliseconds ELSE 0 END),0) AS duration
      FROM responses r WHERE ${released.where}`).bind(...released.bindings),
    db.prepare(`SELECT COUNT(*) AS starts FROM responses r WHERE r.source!='imported' AND ((${released.where}) OR (${quarantined.where}))`).bind(...released.bindings,...quarantined.bindings),
    db.prepare(`SELECT COALESCE(SUM(m.starts),0) AS starts, COALESCE(SUM(m.mobile_starts),0) AS mobile,
      COALESCE(SUM(m.tablet_starts),0) AS tablet, COALESCE(SUM(m.desktop_starts),0) AS desktop
      FROM flow_revisions v LEFT JOIN revision_metric_counters m ON m.revision_id=v.id WHERE v.flow_id=? AND v.state='published'${revision}`).bind(...selected),
    db.prepare(`SELECT COALESCE(SUM(t.count),0) AS count FROM revision_view_counters t JOIN flow_revisions v ON v.id=t.revision_id WHERE v.flow_id=? AND v.state='published'${revision}${period}`).bind(...selected,from,from,to,to),
    db.prepare(`SELECT COALESCE(SUM(t.count),0) AS count FROM revision_start_counters t JOIN flow_revisions v ON v.id=t.revision_id WHERE v.flow_id=? AND v.state='published'${revision}${period}`).bind(...selected,from,from,to,to),
  ])
  const counts = responses.results[0] as {completed:number;imported:number;native:number;duration:number}
  const sessions = counters.results[0] as {starts:number;mobile:number;tablet:number;desktop:number}
  const filtered = responseRateFilter(filter)
  const starts = filtered ? Number((cohort.results[0] as {starts:number}).starts) : from || to ? Number((periodStarts.results[0] as {count:number}).count) : sessions.starts
  const viewCount = Number((views.results[0] as {count:number}).count)
  const denominator = filtered ? starts : viewCount
  return {
    cutoff, starts, completedResponses:counts.completed, liveCompletedResponses:counts.native, importedResponses:counts.imported,
    completionRate:denominator === 0 ? 0 : counts.native / denominator,
    rateNumerator:counts.native, rateDenominator:denominator, rateBasis:filtered ? 'responses' as const : 'views' as const,
    views:viewCount, durationSamples:counts.native, totalCompletionMilliseconds:counts.duration,
    averageCompletionMilliseconds:counts.native === 0 ? 0 : Math.round(counts.duration / counts.native),
    deviceStarts:{mobile:sessions.mobile,tablet:sessions.tablet,desktop:sessions.desktop},
  }
}
