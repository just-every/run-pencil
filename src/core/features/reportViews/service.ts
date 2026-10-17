import { ulid } from 'ulid'
import { crossTab } from '../reporting/crosstabs'
import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors'
import { reportDashboardSchema, reportViewCreateSchema, reportViewLimit, type ReportDashboard, type ReportView, type ReportViewCreate, type ReportViewRow, type ReportViewScope } from './model'
import { ReportViewRepository } from './repository'

const bytes = (value: string) => new TextEncoder().encode(value).byteLength
function present(row: ReportViewRow): ReportView {
  return { id:row.id,name:row.name,definition:JSON.parse(row.definitionJson),cutoff:row.cutoff,snapshot:JSON.parse(row.snapshotJson),createdAt:row.createdAt,
    createdBy:row.creatorId === null ? null : {id:row.creatorId,name:row.creatorName!} }
}
export class ReportViews {
  private readonly repository: ReportViewRepository
  constructor(private readonly db: D1Database, private readonly scope: ReportViewScope) { this.repository = new ReportViewRepository(db,scope) }
  async list(): Promise<ReportDashboard> {
    const dashboard = await this.repository.dashboard()
    if (!dashboard.state) throw new NotFoundError('This form dashboard is not available in your workspace.')
    if (dashboard.views.length > reportViewLimit) throw new ValidationError(`This form exceeds the ${reportViewLimit} saved-view limit. Delete a saved view before reopening its dashboard.`)
    return {version:dashboard.state.version,views:dashboard.views.map(present)}
  }
  async get(id: string): Promise<ReportView> {
    const row = await this.repository.get(id)
    if (!row) throw new NotFoundError('This saved view is not available in the selected form.')
    return present(row)
  }
  async create(raw: ReportViewCreate): Promise<ReportView> {
    const parsed = reportViewCreateSchema.safeParse(raw)
    if (!parsed.success) throw new ValidationError('Choose a name, published revision, two categorical dimensions and supported filters for the saved view.')
    const state = await this.repository.state()
    if (!state) throw new NotFoundError('This form dashboard is not available in your workspace.')
    if (state.count >= reportViewLimit) throw new ValidationError(`A form can hold ${reportViewLimit} saved views. Delete a saved view before saving another.`)
    const input = parsed.data, cutoff = input.cutoff ?? new Date().toISOString(), now = new Date().toISOString()
    if (Date.parse(cutoff) > Date.parse(now)) throw new ValidationError('A saved view cutoff cannot be in the future.')
    const snapshot = await crossTab(this.db,this.scope.workspaceId,this.scope.flowId,{...input.definition,cutoff})
    const definition = JSON.stringify(input.definition), encoded = JSON.stringify(snapshot)
    if (bytes(definition)>16384 || bytes(encoded)>262144) throw new ValidationError('This saved crosstab is too large. Choose fewer categories or a narrower filter before saving.')
    const id = ulid()
    if (!await this.repository.create({id,name:input.name,definition,cutoff:snapshot.cutoff,snapshot:encoded,now,generation:state.generation})) throw new ConflictError(`The evidence changed or the dashboard reached ${reportViewLimit} saved views while saving. Reload the report before saving again.`)
    return this.get(id)
  }
  async erase(id: string) {
    if (!await this.repository.erase(id,new Date().toISOString())) throw new NotFoundError('This saved view is not available in the selected form.')
  }
  async arrange(raw: {version:number;viewIds:string[]}): Promise<ReportDashboard> {
    const parsed = reportDashboardSchema.safeParse(raw)
    if (!parsed.success) throw new ValidationError('Arrange each saved view once with the current dashboard version.')
    if (!await this.repository.arrange(parsed.data.version,parsed.data.viewIds,new Date().toISOString())) throw new ConflictError('The dashboard changed or includes a view from another form. Reload before arranging it again.')
    return this.list()
  }
}
