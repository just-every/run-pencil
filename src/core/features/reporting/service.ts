import { NotFoundError, ValidationError } from '../../shared/errors'
import { ReportingRepository, type LedgerFilter, type LedgerResponse } from './repository'
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
  async compareRevisions(workspaceId: string, flowId: string) {
    const flow = await this.requireFlow(workspaceId, flowId)
    return { flow, ...await this.repository.revisionComparison(workspaceId, flowId) }
  }
  async export(workspaceId: string, flowId: string, filter: LedgerFilter) {
    await this.requireFlow(workspaceId, flowId)
    const cutoff = new Date().toISOString()
    const records: LedgerResponse[] = []
    let offset = 0
    let expectedTotal: number | undefined
    for (;;) {
      const page = await this.repository.ledger(workspaceId, flowId, { ...filter, offset }, cutoff, 'released', 100)
      expectedTotal ??= page.total
      if (page.total !== expectedTotal) throw new ValidationError('Responses changed during export. Retry to create a complete export.')
      records.push(...page.responses)
      if (records.length >= page.total) break
      offset += page.responses.length
      if (!page.responses.length) throw new ValidationError('The export could not read the complete fixed response set. Retry the export.')
    }
    const check = await this.repository.ledger(workspaceId, flowId, { ...filter, offset: 0 }, cutoff, 'released', 0)
    if (check.total !== expectedTotal || new Set(records.map((record) => record.id)).size !== expectedTotal) throw new ValidationError('Responses changed during export. Retry to create a complete export.')
    const quarantined = await this.repository.ledger(workspaceId, flowId, { ...filter, offset: 0 }, cutoff, 'quarantined', 0)
    return { cutoff, filter, excludedQuarantined: quarantined.total, responses: records }
  }
}
