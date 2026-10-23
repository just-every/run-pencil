import { NotFoundError } from '../../shared/errors'
import { hasResponseFilter, type LedgerFilter } from '../../shared/reportFilters'
import { responseScope } from './scope'

export type DeviceReport = {
  basis: 'sessions' | 'responses'; total: number
  counts: { mobile: number; tablet: number; desktop: number; unknown: number }
  nativeResponses: number; unknownResponses: number; importedResponses: number
  sessionsWithoutResponse: number
}
/** No response identifier leaves this aggregate. Unlinked sessions are never filtered by an answer. */
export async function deviceReport(db: D1Database, workspaceId: string, flowId: string, filter: LedgerFilter): Promise<DeviceReport> {
  const flow = await db.prepare('SELECT id FROM flows WHERE id=? AND workspace_id=?').bind(flowId, workspaceId).first()
  if (!flow) throw new NotFoundError('This flow is not available in your workspace.')
  if (filter.revisionId && !await db.prepare("SELECT id FROM flow_revisions WHERE id=? AND flow_id=? AND state='published'").bind(filter.revisionId, flowId).first()) throw new NotFoundError('This published revision is not part of the selected flow.')
  const scope = responseScope(workspaceId, flowId, filter, new Date().toISOString())
  const revision = filter.revisionId ? ' AND v.id=?' : ''
  const selected = [flowId, ...(filter.revisionId ? [filter.revisionId] : [])]
  const [responses, sessions, unlinked] = await db.batch([
    db.prepare(`SELECT COALESCE(r.device_class,'unknown') AS device, r.source='imported' AS imported, COUNT(*) AS count FROM responses r WHERE ${scope.where} GROUP BY device, imported`).bind(...scope.bindings),
    db.prepare(`SELECT COALESCE(SUM(m.mobile_starts),0) AS mobile, COALESCE(SUM(m.tablet_starts),0) AS tablet, COALESCE(SUM(m.desktop_starts),0) AS desktop FROM flow_revisions v LEFT JOIN revision_metric_counters m ON m.revision_id=v.id WHERE v.flow_id=? AND v.state='published'${revision}`).bind(...selected),
    db.prepare(`SELECT (SELECT COUNT(*) FROM respondent_sessions s JOIN flow_revisions v ON v.id=s.revision_id WHERE v.flow_id=? AND v.state='published'${revision} AND s.completed_at IS NULL) + (SELECT COALESCE(SUM(m.dropped),0) FROM revision_step_metric_counters m JOIN flow_revisions v ON v.id=m.revision_id WHERE v.flow_id=? AND v.state='published'${revision}) AS count`).bind(...selected,...selected),
  ])
  const counts = { mobile: 0, tablet: 0, desktop: 0, unknown: 0 }
  let importedResponses = 0
  for (const row of responses.results as Array<{device:keyof typeof counts; imported:number; count:number}>) {
    if (row.imported) importedResponses += row.count
    else counts[row.device] += row.count
  }
  const nativeResponses = Object.values(counts).reduce((sum, count) => sum + count, 0)
  const unknownResponses = counts.unknown
  const basis = hasResponseFilter(filter) ? 'responses' : 'sessions'
  const displayed = basis === 'responses' ? counts : { ...(sessions.results[0] as {mobile:number;tablet:number;desktop:number}), unknown: 0 }
  return { basis, counts: displayed, total: Object.values(displayed).reduce((sum,count) => sum+count,0), nativeResponses, unknownResponses, importedResponses, sessionsWithoutResponse: Number((unlinked.results[0] as {count:number} | undefined)?.count ?? 0) }
}
