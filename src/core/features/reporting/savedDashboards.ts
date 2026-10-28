import { ulid } from 'ulid'
import { loadDashboard, validateDashboardViews } from './savedRepository'
import { savedViewDetail, type ReportActor } from './savedService'

type DashboardInput = { name: string; scope: 'form' | 'program'; flowId?: string; viewIds: string[] }
export async function writeDashboard(db: D1Database, actor: ReportActor, input: DashboardInput, existingId?: string) {
  if (existingId) await loadDashboard(db, actor.workspaceId, existingId)
  await validateDashboardViews(db, actor.workspaceId, input)
  const now = new Date().toISOString(), id = existingId ?? ulid()
  if (existingId) await db.prepare('UPDATE saved_report_dashboards SET name=?,scope=?,flow_id=?,view_ids_json=?,updated_at=? WHERE id=? AND workspace_id=?').bind(input.name, input.scope, input.flowId ?? null, JSON.stringify(input.viewIds), now, id, actor.workspaceId).run()
  else await db.prepare('INSERT INTO saved_report_dashboards(id,workspace_id,name,scope,flow_id,view_ids_json,saved_by,saved_by_name,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id, actor.workspaceId, input.name, input.scope, input.flowId ?? null, JSON.stringify(input.viewIds), actor.operatorId, actor.displayName, now, now).run()
  return loadDashboard(db, actor.workspaceId, id)
}
export async function dashboardDetail(db: D1Database, workspaceId: string, id: string) {
  const dashboard = await loadDashboard(db, workspaceId, id)
  return { dashboard, views: await Promise.all(dashboard.viewIds.map(viewId => savedViewDetail(db, workspaceId, viewId))) }
}
