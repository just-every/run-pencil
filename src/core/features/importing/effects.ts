import { nativeAnswerString, type NativeValueEncoder } from './effect-values'
import type { TargetEffect, Json } from '../../../base/import-kit/src/d1/index'
import { stableId } from './fields'
import { mappingVersion, type ImportForm, type ParsedResponse } from './model'
import type { NativeValue } from './native-tables'
export function formEffect(form: ImportForm, flowId: string, workspaceId: string, digest: string, now: string): TargetEffect {
  // A fixed timestamp belongs to the reviewed plan; replay is byte-identical.
  const imported = stableId(flowId, 'imported-revision'), draft = stableId(flowId, 'draft-revision')
  const value: NativeValue = { flowId, tables: { flows: [{ id: flowId, workspace_id: workspaceId, slug: `imported-${flowId.slice(2)}`, title: form.title, status: 'draft', draft_version: 0, last_activity_at: now, created_at: now, updated_at: now }], flow_revisions: [], flow_steps: [], choice_options: [], flow_branch_rules: [], notification_preferences: [], form_import_revisions: [{ revision_id: imported, flow_id: flowId, source_digest: digest, mapping_version: mappingVersion }] } }
  for (const [index, revision] of [imported, draft].entries()) {
    value.tables.flow_revisions.push({ id: revision, flow_id: flowId, number: index + 1, state: index === 0 ? 'published' : 'draft', title: form.title, published_at: index === 0 ? now : null, is_current: index === 0 ? 1 : 0, admission_closed_at: index === 0 ? now : null, admission_close_reason: index === 0 ? 'manual' : null, deadline_at: null, deadline_time_zone: null, target_completed_responses: null, policy_snapshot_json: null, ...(form.settings ? { form_settings_json: JSON.stringify(form.settings) } : {}), created_at: now, updated_at: now })
    for (const [position, s] of form.steps.entries()) {
      const id = stableId(revision, s.id)
      value.tables.flow_steps.push({ id, revision_id: revision, position, stable_id: s.id, kind: s.kind, question_type: s.questionType, prompt: s.prompt, helper_text: s.helperText, required: Number(s.required), next_step_stable_id: s.next, question_settings_json: JSON.stringify(s.settings), created_at: now, updated_at: now })
      s.choices.forEach((c, i) => value.tables.choice_options.push({ id: stableId(id, c.id), step_id: id, stable_id: c.id, value: c.id, label: c.label, position: i, created_at: now, updated_at: now }))
    }
    form.rules.forEach((r, i) => value.tables.flow_branch_rules.push({ id: stableId(revision, `rule-${i}`), revision_id: revision, source_step_stable_id: r.source, predicate_kind: r.predicate, expected_value_json: JSON.stringify(r.expected), destination_step_stable_id: r.destination, position: r.position, created_at: now, updated_at: now }))
  }
  for (const rows of Object.values(value.tables)) rows.sort((a, b) => String(a.id ?? a.revision_id).localeCompare(String(b.id ?? b.revision_id)))
  return { targetKind: 'form', targetId: flowId, value: value as unknown as Json }
}
export function responseEffect(response: ParsedResponse, flowId: string, workspaceId: string, encodeValue: NativeValueEncoder = JSON.stringify, consentSteps?: ReadonlySet<string>): TargetEffect {
  const id = stableId(flowId, `response-${response.row}`), now = response.submittedAt
  const value: NativeValue = { flowId, tables: { response_outbox: [], notification_deliveries: [], notification_attempts: [], responses: [{ id, workspace_id: workspaceId, flow_id: flowId, revision_id: stableId(flowId, 'imported-revision'), source: 'imported', notification_eligible: 0, started_at: response.startedAt, session_id: id, participant_id: null, session_token_hash: '', idempotency_key: id, state: 'released', quarantine_reason: null, released_at: now, released_by_operator_id: null, completion_milliseconds: 0, completed_at: now, created_at: now, updated_at: now }], response_answers: Object.entries(response.answers).map(([step, answer]) => ({ id: stableId(id, step), response_id: id, step_id: step, value_json: nativeAnswerString(answer, encodeValue, consentSteps?.has(step) ?? false), created_at: now, updated_at: now })).sort((a, b) => a.id.localeCompare(b.id)) } }
  return { targetKind: 'response', targetId: id, value: value as unknown as Json }
}
