import { structuredAnswerFilter } from './answerFilter'
import type { LedgerFilter } from './repository'
export function responseScope(workspaceId: string, flowId: string, filter: LedgerFilter, cutoff: string, state: 'released' | 'quarantined' = 'released') {
    const parts = ['r.workspace_id = ?', 'r.flow_id = ?', 'r.state = ?', 'r.completed_at <= ?']
    const bindings: unknown[] = [workspaceId, flowId, state, cutoff]
    parts.push("(r.source != 'imported' OR EXISTS (SELECT 1 FROM form_import_targets t WHERE t.target_id = r.id AND t.kind = 'response' AND t.workspace_id = r.workspace_id AND t.committed_at <= ?))")
    bindings.push(cutoff)
    if (state === 'released') { parts.push('r.released_at <= ?'); bindings.push(cutoff) }
    for (const [value, sql] of [[filter.revisionId, 'r.revision_id = ?'], [filter.source, 'r.source = ?'], [filter.from, 'r.completed_at >= ?'], [filter.to, 'r.completed_at <= ?']] as const) if (value) { parts.push(sql); bindings.push(value) }
    if (filter.collectorId) { parts.push('EXISTS (SELECT 1 FROM response_collector rc JOIN collectors c ON c.id=rc.collector_id WHERE rc.response_id=r.id AND c.flow_id=r.flow_id AND c.id=?)'); bindings.push(filter.collectorId) }
    if (filter.answerStepId && filter.answerValue !== undefined) {
      const answer = structuredAnswerFilter(filter.answerStepId, filter.answerValue)
      parts.push(answer.sql)
      bindings.push(...answer.bindings)
    }
    if (filter.participantStatus) {
      parts.push(`EXISTS (SELECT 1 FROM invitation_participants p LEFT JOIN distribution_contacts c ON c.id = p.contact_id WHERE p.id = r.participant_id AND p.workspace_id = r.workspace_id AND ${filter.participantStatus === 'bounced' ? "p.delivery_status = 'bounced'" : filter.participantStatus === 'opted-out' ? 'c.opted_out_at IS NOT NULL' : "c.id IS NOT NULL AND c.opted_out_at IS NULL AND p.delivery_status != 'bounced'"})`)
    }
    const where = parts.join(' AND ')
    return { where, bindings }
}
