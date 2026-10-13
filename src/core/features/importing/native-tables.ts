export type NativeRow = Record<string, string | number | null>
export type NativeValue = { flowId: string; tables: Record<string, NativeRow[]> }
export const tables = {
  flows: { columns: ['id', 'workspace_id', 'slug', 'title', 'status', 'draft_version', 'last_activity_at', 'created_at', 'updated_at'], scope: 'id = ?' },
  flow_revisions: { columns: ['id', 'flow_id', 'number', 'state', 'title', 'published_at', 'is_current', 'admission_closed_at', 'admission_close_reason', 'deadline_at', 'deadline_time_zone', 'target_completed_responses', 'policy_snapshot_json', 'created_at', 'updated_at'], scope: 'flow_id = ?' },
  flow_steps: { columns: ['id', 'revision_id', 'position', 'stable_id', 'kind', 'question_type', 'prompt', 'helper_text', 'required', 'next_step_stable_id', 'question_settings_json', 'created_at', 'updated_at'], scope: 'revision_id IN (SELECT id FROM flow_revisions WHERE flow_id = ?)' },
  choice_options: { columns: ['id', 'step_id', 'stable_id', 'value', 'label', 'position', 'created_at', 'updated_at'], scope: 'step_id IN (SELECT s.id FROM flow_steps s JOIN flow_revisions r ON r.id = s.revision_id WHERE r.flow_id = ?)' },
  flow_branch_rules: { columns: ['id', 'revision_id', 'source_step_stable_id', 'predicate_kind', 'expected_value_json', 'destination_step_stable_id', 'position', 'created_at', 'updated_at'], scope: 'revision_id IN (SELECT id FROM flow_revisions WHERE flow_id = ?)' },
  form_import_revisions: { columns: ['revision_id', 'flow_id', 'source_digest', 'mapping_version'], scope: 'flow_id = ?' },
  responses: { columns: ['id', 'workspace_id', 'flow_id', 'revision_id', 'source', 'started_at', 'session_id', 'participant_id', 'session_token_hash', 'idempotency_key', 'state', 'quarantine_reason', 'released_at', 'released_by_operator_id', 'completion_milliseconds', 'completed_at', 'created_at', 'updated_at', 'notification_eligible'], scope: 'id = ?' },
  response_answers: { columns: ['id', 'response_id', 'step_id', 'value_json', 'created_at', 'updated_at'], scope: 'response_id = ?' },
  notification_preferences: { columns: ['flow_id', 'operator_id', 'mode', 'failure_reason', 'updated_at'], scope: 'flow_id = ?' },
  response_outbox: { columns: ['id', 'workspace_id', 'response_id', 'kind', 'idempotency_key', 'payload_json', 'status', 'available_at', 'dispatched_at', 'failure_reason', 'created_at', 'updated_at', 'notification_eligible'], scope: 'response_id = ?' },
  notification_deliveries: { columns: ['id', 'response_id', 'operator_id', 'status', 'idempotency_key', 'attempts', 'first_attempt_at', 'last_attempt_at', 'available_at', 'reason', 'provider_id', 'provider', 'provider_code', 'created_at', 'updated_at'], scope: 'response_id = ?' },
  notification_attempts: { columns: ['id', 'delivery_id', 'ordinal', 'event', 'provider', 'provider_code', 'created_at'], scope: 'delivery_id IN (SELECT id FROM notification_deliveries WHERE response_id = ?)' },
} as const
export type TableName = keyof typeof tables
export function tableNames(kind: string): TableName[] { if (kind === 'form') return ['flows', 'flow_revisions', 'flow_steps', 'choice_options', 'flow_branch_rules', 'form_import_revisions', 'notification_preferences']; if (kind === 'response') return ['responses', 'response_answers', 'response_outbox', 'notification_deliveries', 'notification_attempts']; throw new Error('Unknown import target.') }
