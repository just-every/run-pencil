import { NotFoundError, ValidationError } from '../../shared/errors'
import type { SavedView, SavedViewDefinition, SavedDashboard } from './savedModel'

type SavedRow = { id: string; workspaceId: string; flowId: string; revisionId: string; name: string; definitionJson: string; cutoff: string; threshold: number; savedById: string | null; savedByName: string; createdAt: string }
export type StoredSavedView = SavedView & { workspaceId: string }
const viewColumns = 'id,workspace_id AS workspaceId,flow_id AS flowId,revision_id AS revisionId,name,definition_json AS definitionJson,cutoff,threshold,saved_by AS savedById,saved_by_name AS savedByName,created_at AS createdAt'
function view(row: SavedRow): StoredSavedView {
  const { definitionJson, savedById, savedByName, ...rest } = row
  return { ...rest, definition: JSON.parse(definitionJson) as SavedViewDefinition, savedBy: { id: savedById, name: savedByName } }
}
export function viewMetadata(stored: StoredSavedView): SavedView {
  const { workspaceId: _workspaceId, ...metadata } = stored
  return metadata
}
export async function loadSavedView(db: D1Database, workspaceId: string, id: string): Promise<StoredSavedView> {
  const row = await db.prepare(`SELECT ${viewColumns} FROM saved_report_views WHERE id=? AND workspace_id=?`).bind(id, workspaceId).first<SavedRow>()
  if (!row) throw new NotFoundError('This saved view is unavailable.')
  return view(row)
}
export async function listSavedViews(db: D1Database, workspaceId: string, flowId?: string) {
  return (await db.prepare(`SELECT ${viewColumns} FROM saved_report_views WHERE workspace_id=?${flowId ? ' AND flow_id=?' : ''} ORDER BY created_at DESC,id`).bind(workspaceId, ...(flowId ? [flowId] : [])).all<SavedRow>()).results.map(row => viewMetadata(view(row)))
}

type DashboardRow = { id: string; name: string; scope: 'form' | 'program'; flowId: string | null; viewIdsJson: string; savedById: string | null; savedByName: string; createdAt: string; updatedAt: string }
const dashboardColumns = 'id,name,scope,flow_id AS flowId,view_ids_json AS viewIdsJson,saved_by AS savedById,saved_by_name AS savedByName,created_at AS createdAt,updated_at AS updatedAt'
function dashboard(row: DashboardRow): SavedDashboard {
  const { viewIdsJson, savedById, savedByName, ...rest } = row
  return { ...rest, viewIds: JSON.parse(viewIdsJson) as string[], savedBy: { id: savedById, name: savedByName } }
}
export async function loadDashboard(db: D1Database, workspaceId: string, id: string) {
  const row = await db.prepare(`SELECT ${dashboardColumns} FROM saved_report_dashboards WHERE id=? AND workspace_id=?`).bind(id, workspaceId).first<DashboardRow>()
  if (!row) throw new NotFoundError('This dashboard is unavailable.')
  return dashboard(row)
}
export async function listDashboards(db: D1Database, workspaceId: string) {
  return (await db.prepare(`SELECT ${dashboardColumns} FROM saved_report_dashboards WHERE workspace_id=? ORDER BY created_at,id`).bind(workspaceId).all<DashboardRow>()).results.map(dashboard)
}
export async function validateDashboardViews(db: D1Database, workspaceId: string, input: { scope: 'form' | 'program'; flowId?: string; viewIds: string[] }) {
  if (input.flowId && !await db.prepare('SELECT id FROM flows WHERE id=? AND workspace_id=?').bind(input.flowId, workspaceId).first()) throw new NotFoundError('This form is unavailable.')
  const views = await Promise.all(input.viewIds.map(id => loadSavedView(db, workspaceId, id)))
  if (input.scope === 'form' && views.some(item => item.flowId !== input.flowId)) throw new ValidationError('A form dashboard can contain only views of that form.')
}
