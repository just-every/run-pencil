import { NotFoundError } from '../../shared/errors'
import { ReportingRepository, type LedgerFilter } from './repository'
export class ReportingService {
  constructor(private readonly repository: ReportingRepository) {}
  private async requireFlow(workspaceId: string, flowId: string) {
    const flow = await this.repository.flow(workspaceId, flowId)
    if (!flow) throw new NotFoundError('This flow is not available in your workspace.')
    return flow
  }
  async ledger(workspaceId: string, flowId: string, filter: LedgerFilter) {
    const flow = await this.requireFlow(workspaceId, flowId)
    const cutoff = new Date().toISOString()
    return { flow, cutoff, filter, revisions: await this.repository.revisions(flowId), ...await this.repository.ledger(workspaceId, flowId, filter, cutoff) }
  }
  async questions(workspaceId: string, flowId: string, revisionId: string) {
    await this.requireFlow(workspaceId, flowId)
    if (!(await this.repository.revisions(flowId)).some((revision) => revision.id === revisionId)) throw new NotFoundError('This published revision is not part of the selected flow.')
    return this.repository.questionReport(revisionId)
  }
  async compareRevisions(workspaceId: string, flowId: string, offset = 0) {
    const flow = await this.requireFlow(workspaceId, flowId)
    return { flow, ...await this.repository.revisionComparison(workspaceId, flowId, offset) }
  }
}
