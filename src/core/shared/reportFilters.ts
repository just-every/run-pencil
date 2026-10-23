/** The same response selection drives results, the ledger and exports. */
export type LedgerFilter = {
  deviceClass?: 'mobile' | 'tablet' | 'desktop' | 'unknown'
  codeId?: string; workflowStatus?: string; workflowAssignee?: string; workflowTag?: string
  search?: string; collectorId?: string; revisionId?: string
  source?: 'direct' | 'embed' | 'invitation' | 'unknown' | 'imported'
  participantStatus?: 'eligible' | 'opted-out' | 'bounced'
  from?: string; to?: string; answerStepId?: string; answerValue?: string; offset?: number
}
export function hasResponseFilter(filter: LedgerFilter) {
  return Object.entries(filter).some(([key, value]) => !['revisionId', 'offset'].includes(key) && value !== undefined && value !== '')
}
