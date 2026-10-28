import { ulid } from 'ulid'
import { ValidationError, NotFoundError } from '../../shared/errors'
import { disclosureThreshold } from '../analysis/disclosure'
import { ReportingRepository } from './repository'
import { aggregateDimensions } from './sharedSummaries'
import { sharedDimensionPattern } from './sharedDimensions'
import { sharedReport } from './sharedReport'
import { loadSavedView, viewMetadata, type StoredSavedView } from './savedRepository'
import type { SavedViewDefinition, SavedViewDetail } from './savedModel'

export type ReportActor = { workspaceId: string; operatorId: string; displayName: string }
export async function savedViewDetail(db: D1Database, workspaceId: string, id: string): Promise<SavedViewDetail> {
  const view = await loadSavedView(db, workspaceId, id)
  return { view: viewMetadata(view), report: await sharedReport(db, view) }
}
export async function createSavedView(db: D1Database, actor: ReportActor, flowId: string, definition: SavedViewDefinition): Promise<SavedViewDetail> {
  const repository = new ReportingRepository(db)
  if (!await repository.flow(actor.workspaceId, flowId)) throw new NotFoundError('This form is unavailable.')
  const revisions = await repository.revisions(flowId)
  for (const revisionId of [definition.revisionId, ...definition.cohorts.map(cohort => cohort.filter.revisionId ?? definition.revisionId)]) if (!revisions.some(revision => revision.id === revisionId)) throw new ValidationError('Each compared cohort must use a published revision of this form.')
  const now = new Date().toISOString()
  const codeKeys = [...new Set(definition.crosstabs.flatMap(cross => [cross.rows, cross.columns]).filter(key => key.startsWith('code:')))]
  const dimensions = await aggregateDimensions(db, actor.workspaceId, flowId, definition.revisionId, now, codeKeys)
  const steps = (await db.prepare("SELECT stable_id AS id FROM flow_steps WHERE revision_id=? AND kind='question'").bind(definition.revisionId).all<{ id: string }>()).results
  if (definition.charts.some(id => !steps.some(step => step.id === id))) throw new ValidationError('Choose charts from this published revision.')
  for (const cross of definition.crosstabs) {
    if (!sharedDimensionPattern.test(cross.rows) || !sharedDimensionPattern.test(cross.columns) || cross.rows === cross.columns) throw new ValidationError('Choose two different dimensions for each crosstab.')
    // Identifying hidden dimensions are deliberately absent from aggregate reports.
    for (const key of [cross.rows, cross.columns]) if (!dimensions.permitted.includes(key) && !key.startsWith('hidden:')) throw new ValidationError('Choose a structured question or declared context value for a crosstab.')
  }
  const view: StoredSavedView = { id: ulid(), workspaceId: actor.workspaceId, flowId, revisionId: definition.revisionId, name: definition.name, definition, cutoff: now, threshold: await disclosureThreshold(db, actor.workspaceId), savedBy: { id: actor.operatorId, name: actor.displayName }, createdAt: now }
  const report = await sharedReport(db, view)
  await db.prepare('INSERT INTO saved_report_views(id,workspace_id,flow_id,revision_id,name,definition_json,cutoff,threshold,saved_by,saved_by_name,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(view.id, view.workspaceId, flowId, view.revisionId, view.name, JSON.stringify(definition), view.cutoff, view.threshold, actor.operatorId, actor.displayName, now).run()
  return { view: viewMetadata(view), report }
}
