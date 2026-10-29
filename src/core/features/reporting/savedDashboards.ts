import { ConflictError } from '../../shared/errors'
import { ulid } from 'ulid'
import { loadDashboard, validateDashboardViews } from './savedRepository'
import { savedViewDetail, type ReportActor } from './savedService'

type DashboardInput = { name: string; scope: 'form' | 'program'; flowId?: string; viewIds: string[] }
export async function writeDashboard(db: D1Database, actor: ReportActor, input: DashboardInput, existingId?: string, expectedUpdatedAt?: string) {
  if (existingId) await loadDashboard(db, actor.workspaceId, existingId)
  await validateDashboardViews(db, actor.workspaceId, input)
  const now = new Date().toISOString(), id = existingId ?? ulid()
  const changed = existingId
    ? db.prepare('UPDATE saved_report_dashboards SET name=?,scope=?,flow_id=?,view_ids_json=?,updated_at=? WHERE id=? AND workspace_id=? AND (? IS NULL OR updated_at=?) RETURNING id').bind(input.name,input.scope,input.flowId??null,JSON.stringify(input.viewIds),now,id,actor.workspaceId,expectedUpdatedAt??null,expectedUpdatedAt??null)
    : db.prepare('INSERT INTO saved_report_dashboards(id,workspace_id,name,scope,flow_id,view_ids_json,saved_by,saved_by_name,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?) RETURNING id').bind(id,actor.workspaceId,input.name,input.scope,input.flowId??null,JSON.stringify(input.viewIds),actor.operatorId,actor.displayName,now,now)
  const rows = await db.batch([changed,db.prepare(`INSERT INTO audit_entries(id,workspace_id,kind,actor_operator_id,subject_type,subject_id,details_json,created_at) SELECT ?,workspace_id,'report.dashboard_saved',?,'report-dashboard',id,?,? FROM saved_report_dashboards WHERE id=? AND workspace_id=? AND updated_at=?`).bind(ulid(),actor.operatorId,JSON.stringify({dashboards:1,...actor.attribution}),now,id,actor.workspaceId,now)])
  if (!rows[0].results.length) throw new ConflictError('The report dashboard changed. Reload it before saving.')
  return loadDashboard(db, actor.workspaceId, id)
}
export async function dashboardDetail(db: D1Database, workspaceId: string, id: string) {
  const dashboard = await loadDashboard(db, workspaceId, id)
  return { dashboard, views: await Promise.all(dashboard.viewIds.map(viewId => savedViewDetail(db, workspaceId, viewId))) }
}
