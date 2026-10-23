import { ValidationError } from '../../shared/errors'
import { responseCodeFilter } from '../coding'
import { responseSearch } from './search'
import { workflowScope } from '../submissions'
import { structuredAnswerFilter } from './answerFilter'
import type { LedgerFilter } from './repository'
export type ResponseSelection = 'released' | 'quarantined' | 'with-automated-exclusions' | 'automated-exclusions'
export function responseScope(workspaceId: string, flowId: string, filter: LedgerFilter, cutoff: string, state: ResponseSelection = 'released') {
    const parts = ['r.workspace_id = ?', 'r.flow_id = ?', 'r.completed_at <= ?']
    const bindings: unknown[] = [workspaceId, flowId, cutoff]
    const automated = "(r.state = 'quarantined' AND r.quarantine_reason IN ('honeypot','minimum-fill-time'))"
    if (state === 'with-automated-exclusions') { parts.push(`((r.state = 'released' AND r.released_at <= ?) OR ${automated})`); bindings.push(cutoff) }
    else if (state === 'automated-exclusions') parts.push(automated)
    else { parts.push('r.state = ?'); bindings.push(state) }
    parts.push("(r.source != 'imported' OR EXISTS (SELECT 1 FROM form_import_targets t WHERE t.target_id = r.id AND t.kind = 'response' AND t.workspace_id = r.workspace_id AND t.committed_at <= ?))")
    bindings.push(cutoff)
    if (state === 'released') { parts.push('r.released_at <= ?'); bindings.push(cutoff) }
    for (const [value, sql] of [[filter.revisionId, 'r.revision_id = ?'], [filter.source, 'r.source = ?'], [filter.from, 'r.completed_at >= ?'], [filter.to, 'r.completed_at <= ?']] as const) if (value) { parts.push(sql); bindings.push(value) }
    if (filter.deviceClass) { parts.push("COALESCE(r.device_class,'unknown') = ?"); bindings.push(filter.deviceClass) }
    if (filter.collectorId) { parts.push('EXISTS (SELECT 1 FROM response_collector rc JOIN collectors c ON c.id=rc.collector_id WHERE rc.response_id=r.id AND c.flow_id=r.flow_id AND c.id=?)'); bindings.push(filter.collectorId) }
    if (filter.answerStepId && filter.answerValue !== undefined) {
      const contextKind = filter.answerStepId.startsWith('hidden:') ? 'hidden' : filter.answerStepId.startsWith('variable:') ? 'variable' : undefined
      const answer = contextKind ? contextValueFilter(contextKind, filter.answerStepId.slice(contextKind.length + 1), filter.answerValue) : structuredAnswerFilter(filter.answerStepId, filter.answerValue)
      parts.push(answer.sql)
      bindings.push(...answer.bindings)
    }
    if (filter.participantStatus) {
      parts.push(`EXISTS (SELECT 1 FROM invitation_participants p LEFT JOIN distribution_contacts c ON c.id = p.contact_id WHERE p.id = r.participant_id AND p.workspace_id = r.workspace_id AND ${filter.participantStatus === 'bounced' ? "p.delivery_status = 'bounced'" : filter.participantStatus === 'opted-out' ? 'c.opted_out_at IS NOT NULL' : "c.id IS NOT NULL AND c.opted_out_at IS NULL AND p.delivery_status != 'bounced'"})`)
    }
    if (filter.codeId) { const code = responseCodeFilter(filter.codeId); parts.push(code.sql); bindings.push(...code.bindings) }
    if (filter.search) {
      const search = responseSearch(filter.search)
      parts.push(search.sql); bindings.push(...search.bindings)
    }
    const workflow = workflowScope(filter)
    parts.push(...workflow.parts); bindings.push(...workflow.bindings)
    const where = parts.join(' AND ')
    return { where, bindings }
}

function contextValueFilter(kind: 'hidden' | 'variable', id: string, encoded: string) {
  const label = kind === 'hidden' ? 'hidden-field' : 'calculated'
  let value: unknown
  try { value = JSON.parse(encoded) } catch { throw new ValidationError(`Choose a valid ${label} value.`) }
  const valid = kind === 'hidden' ? ['string', 'number', 'boolean'].includes(typeof value) : value === null || ['string', 'number'].includes(typeof value)
  if (!valid || typeof value === 'number' && !Number.isFinite(value)) throw new ValidationError(`Choose a valid ${label} value.`)
  const values = kind === 'hidden' ? 'hidden' : 'calculations', definitions = kind === 'hidden' ? 'hiddenFields' : 'calculations'
  return {
    sql: `EXISTS (SELECT 1 FROM json_each(r.response_context_json, '$.${values}') stored
      JOIN flow_revisions stored_revision ON stored_revision.id=r.revision_id AND stored_revision.flow_id=r.flow_id
      JOIN json_each(stored_revision.form_settings_json, '$.${definitions}') declared ON json_extract(declared.value, '$.id')=stored.key
      WHERE stored.key=? AND (stored.type=json_type(?) OR stored.type IN ('integer','real') AND json_type(?) IN ('integer','real')) AND stored.value IS json_extract(?, '$'))`,
    bindings: [id, encoded, encoded, encoded],
  }
}
