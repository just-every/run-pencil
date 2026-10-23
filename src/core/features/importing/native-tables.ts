export type NativeRow = Record<string, string | number | null>
export type NativeValue = { flowId: string; tables: Record<string, NativeRow[]> }
export const tables = {
  confirmation_deliveries: { columns: ['id', 'response_id', 'recipient', 'message_json', 'status', 'attempts', 'first_attempt_at', 'last_attempt_at', 'available_at', 'provider_id', 'reason', 'created_at', 'updated_at', 'armed'], scope: 'response_id = ?' },
  confirmation_attempts: { columns: ['id', 'delivery_id', 'ordinal', 'event', 'provider', 'provider_code', 'created_at'], scope: 'delivery_id IN (SELECT id FROM confirmation_deliveries WHERE response_id = ?)' },

  flows: { columns: ['id', 'workspace_id', 'slug', 'title', 'status', 'draft_version', 'last_activity_at', 'created_at', 'updated_at'], scope: 'id = ?' },
  flow_revisions: { columns: ['id', 'flow_id', 'number', 'state', 'title', 'published_at', 'is_current', 'admission_closed_at', 'admission_close_reason', 'deadline_at', 'deadline_time_zone', 'target_completed_responses', 'policy_snapshot_json', 'form_settings_json', 'created_at', 'updated_at'], scope: 'flow_id = ?' },
  flow_steps: { columns: ['id', 'revision_id', 'position', 'stable_id', 'kind', 'question_type', 'prompt', 'helper_text', 'required', 'next_step_stable_id', 'question_settings_json', 'created_at', 'updated_at'], scope: 'revision_id IN (SELECT id FROM flow_revisions WHERE flow_id = ?)' },
  choice_options: { columns: ['id', 'step_id', 'stable_id', 'value', 'label', 'position', 'created_at', 'updated_at'], scope: 'step_id IN (SELECT s.id FROM flow_steps s JOIN flow_revisions r ON r.id = s.revision_id WHERE r.flow_id = ?)' },
  flow_branch_rules: { columns: ['id', 'revision_id', 'source_step_stable_id', 'predicate_kind', 'expected_value_json', 'condition_json', 'destination_step_stable_id', 'position', 'created_at', 'updated_at'], scope: 'revision_id IN (SELECT id FROM flow_revisions WHERE flow_id = ?)' },
  form_import_revisions: { columns: ['revision_id', 'flow_id', 'source_digest', 'mapping_version'], scope: 'flow_id = ?' },
  submission_statuses: { columns: ['id', 'flow_id', 'name', 'created_at'], scope: 'flow_id = ?' },
  submission_workflows: { columns: ['response_id', 'status_id', 'assignee_id', 'version', 'updated_at'], scope: 'response_id = ?' },
  submission_tags: { columns: ['response_id', 'tag'], scope: 'response_id = ?' },
  submission_notes: { columns: ['id', 'response_id', 'text', 'author_id', 'created_at'], scope: 'response_id = ?' },
  responses: { columns: ['id', 'workspace_id', 'flow_id', 'revision_id', 'source', 'started_at', 'session_id', 'participant_id', 'session_token_hash', 'idempotency_key', 'state', 'quarantine_reason', 'released_at', 'released_by_operator_id', 'completion_milliseconds', 'completed_at', 'created_at', 'updated_at', 'notification_eligible', 'response_context_json'], scope: 'id = ?' },
  response_answers: { columns: ['id', 'response_id', 'step_id', 'value_json', 'created_at', 'updated_at'], scope: 'response_id = ?' },
  notification_preferences: { columns: ['flow_id', 'operator_id', 'mode', 'failure_reason', 'updated_at'], scope: 'flow_id = ?' },
  response_outbox: { columns: ['id', 'workspace_id', 'response_id', 'kind', 'idempotency_key', 'payload_json', 'status', 'available_at', 'dispatched_at', 'failure_reason', 'created_at', 'updated_at', 'notification_eligible'], scope: 'response_id = ?' },
  notification_deliveries: { columns: ['id', 'response_id', 'operator_id', 'status', 'idempotency_key', 'attempts', 'first_attempt_at', 'last_attempt_at', 'available_at', 'reason', 'provider_id', 'provider', 'provider_code', 'created_at', 'updated_at'], scope: 'response_id = ?' },
  notification_attempts: { columns: ['id', 'delivery_id', 'ordinal', 'event', 'provider', 'provider_code', 'created_at'], scope: 'delivery_id IN (SELECT id FROM notification_deliveries WHERE response_id = ?)' },
} as const
export type TableName = keyof typeof tables
export function tableNames(kind: string): TableName[] { if (kind === 'form') return ['flows', 'flow_revisions', 'flow_steps', 'choice_options', 'flow_branch_rules', 'form_import_revisions', 'notification_preferences', 'submission_statuses']; if (kind === 'response') return ['responses', 'confirmation_deliveries', 'confirmation_attempts', 'response_answers', 'response_outbox', 'notification_deliveries', 'notification_attempts', 'submission_workflows', 'submission_tags', 'submission_notes']; throw new Error('Unknown import target.') }

/** Newly inventoried empty sidecars were absent from older retained plan bytes.
 * Omit their empty images on reads so native hashes retain that exact meaning. */
export const optionalNativeTables = new Set<TableName>(['confirmation_deliveries','confirmation_attempts','submission_statuses', 'submission_workflows', 'submission_tags', 'submission_notes'])

/** Old retained plans predate the nullable condition column. Preserve their
 * canonical images until an actual tree changes that row. */
export function nativeSnapshotRows(name: TableName, rows: NativeRow[]) {
  return rows.map(row => { const next = {...row}; if (name === 'flow_branch_rules' && next.condition_json === null) delete next.condition_json; if (name === 'flow_revisions' && next.form_settings_json === '{}') delete next.form_settings_json; if (name === 'responses' && next.response_context_json === '{}') delete next.response_context_json; return next })
}
