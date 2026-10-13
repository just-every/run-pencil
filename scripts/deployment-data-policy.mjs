import { withoutDevRows } from './deployment-data-dev.mjs';
// Every persisted column is reviewed here. A migration cannot silently add data
// to an archive: both new tables and new columns fail closed until classified.
const retained = {
  d1_migrations: 'id name applied_at',
  _rer_deploy_migrations: 'name sha256 state',
  // Actions hold operator-written text and frozen aggregate counts, never answers or response IDs. The task key is
  // never stored, so nothing here is a credential; the confirmed payload and every attempt travel as recorded.
  actions: 'id workspace_id title rationale owner_operator_id state verdict review_date source analysis_id metric_name metric_unit metric_direction baseline_value baseline_source baseline_observed_at version last_event_id created_by_operator_id created_at updated_at',
  action_evidence: 'action_id flow_id revision_id question_stable_id figures_json captured_at',
  action_events: 'id action_id kind from_state to_state note changes_json operator_id created_at',
  action_measurements: 'id action_id flow_id revision_id observed_value unit observed_at operator_id created_at',
  action_task_deliveries: 'action_id idempotency_key state payload_json payload_sha256 action_version confirmed_by_operator_id confirmed_at in_flight_attempt_id remote_task_id updated_at',
  action_task_attempts: 'id action_id ordinal idempotency_key payload_sha256 operator_id started_at outcome outcome_class http_status remote_task_id finished_at',
  // Analysis: runs, their fixed evidence (response IDs), validated themes, members, exact quotes, the one recommendation, the
  // policies and per-call usage. No provider credential or request body is stored; erasure removes a response from all of them.
  analysis_policies: 'workspace_id autorun_enabled autorun_minimum disclosure_threshold selection updated_by_operator_id updated_at',
  analysis_runs: 'id workspace_id flow_id revision_id trigger requested_by_operator_id state question_ids_json policy_json evidence_count evidence_cutoff request_sha256 provider_origin model attempts first_attempt_at error_code error_message insufficient_reason summary redacted_at created_at started_at finished_at updated_at',
  analysis_evidence: 'run_id response_id position',
  analysis_themes: 'id run_id rank title summary is_primary',
  analysis_theme_members: 'theme_id run_id response_id',
  analysis_quotes: 'id theme_id run_id response_id question_id start_offset end_offset excerpt',
  analysis_recommendations: 'run_id title rationale theme_ids_json confidence expected_impact effort',
  analysis_calls: 'id workspace_id run_id feature provider provider_origin model attempt outcome error_code input_tokens output_tokens cost_microusd cost_source receipt_id day created_at',
  // Base ai's local dev capture: the schema travels, rows never do.
  rer_ai_development_outbox: 'sequence id created_at',
  audit_entries: 'id workspace_id kind actor_operator_id subject_type subject_id details_json created_at',
  auth_magic_links: 'id operator_id token_hash expires_at consumed_at created_at revoked_at',
  choice_options: 'id step_id value label position created_at updated_at stable_id',
  contact_consent_events: 'id contact_id workspace_id consent actor source created_at',
  distribution_contacts: 'id workspace_id email name opted_out_at created_at updated_at fields_json',
  distribution_segments: 'id workspace_id name rules_json created_at updated_at',
  invitation_candidates: 'id launch_id contact_id email_snapshot name_snapshot outcome',
  flow_branch_rules: 'id revision_id source_step_stable_id predicate_kind expected_value_json destination_step_stable_id position created_at updated_at',
  flow_revisions: 'id flow_id number state title published_at created_at updated_at is_current admission_closed_at admission_close_reason deadline_at deadline_time_zone target_completed_responses policy_snapshot_json invitation_reserved_count',
  flow_steps: 'id revision_id position kind question_type prompt helper_text required created_at updated_at stable_id next_step_stable_id question_settings_json',
  flows: 'id workspace_id slug title status draft_version last_activity_at created_at updated_at',
  invitation_launches: 'id workspace_id revision_id command_key policy_json actor_operator_id created_at',
  invitation_participants: 'id launch_id workspace_id revision_id contact_id email_snapshot name_snapshot delivery_status response_status completed_at completion_step_id created_at',
  local_dev_inbox: 'id to_email expires_at created_at',
  local_fixture_initializations: 'id initialized_at',
  local_mail_outbox: 'delivery_id created_at',
  mail_deliveries: 'id participant_id kind status idempotency_key available_at first_attempt_at last_attempt_at attempts provider_id reason created_at updated_at',
  mail_delivery_attempts: 'id delivery_id ordinal event actor_operator_id reason provider_id created_at',
  oa_bootstrap: 'singleton claim_id claimed_at',
  // Local dev identity bookkeeping: its rows never travel (deployment-data-dev.mjs).
  oa_dev_credentials: 'credential id created_at',
  oa_domain_rules: 'domain provider_id created_by created_at',
  oa_step_up_challenges: 'id token_hash session_id operator_id operator_version action return_to created_at expires_at consumed_at',
  oa_external_identities: 'issuer subject operator_id',
  oa_limits: 'key window count',
  oa_operators: 'id email display_name role status version created_at',
  oa_sessions: 'id token_hash operator_id operator_version kind source_token_id created_at expires_at revoked_at',
  oa_tokens: 'id token_hash kind operator_id operator_version issuer_id issuer_version return_to created_at expires_at consumed_at revoked_at',
  oa_invitation_cancellations: 'operator_id operator_version',
  // Provider sign-in controls (off until an identity provider is linked): the setting, its audit, provider-issued
  // session bindings, consumed logout token ids, minted credential hashes and session pins. No bearer secret is stored.
  oa_auth_settings: 'singleton idp_sign_in generation first_setup',
  oa_auth_audit: 'id actor_id action value created_at',
  oa_provider_sessions: 'session_id issuer subject sid generation',
  oa_logout_events: 'issuer jti consumed_at',
  oa_credentials: 'id token_hash operator_id operator_version kind expires_at revoked_at',
  oa_provider_session_pins: 'session_id provider_id issuer client_id linked_at',
  // Ephemeral app-local provider setup attempts: the schema travels, rows never do.
  oa_setup_links: 'interface attempt_id expires_at owner_id owner_version session_id completed',
  oc_idp_grants: 'issuer client_id jti subject sector_id',
  // Consumed claim identity is durable admission state, never a bearer token.
  oc_owner_claims: 'singleton jti installation_id email issued_at expires_at consumed_at operator_id session_id completed',
  operator_auth_links: 'operator_id auth_id',
  operator_sessions: 'id operator_id token_hash expires_at last_active_at revoked_at created_at updated_at',
  operators: 'id workspace_id email display_name created_at updated_at is_setup_operator',
  public_rate_limit_windows: 'id scope address_hash window_started_at count expires_at created_at updated_at',
  respondent_session_step_events: 'id session_id revision_id step_stable_id counted_at created_at',
  respondent_sessions: 'id revision_id source device_class furthest_step_id completed_at expires_at created_at updated_at session_token_hash metric_folded_at completion_outcome',
  // Anonymous report consistency metadata contains no answers or respondent identities.
  reporting_generations: 'workspace_id generation',
  reporting_changes: 'workspace_id flow_id eligible_at generation',
  response_answers: 'id response_id step_id value_json created_at updated_at',
  response_outbox: 'id workspace_id response_id kind idempotency_key payload_json status available_at dispatched_at failure_reason created_at updated_at',
  responses: 'id workspace_id flow_id revision_id session_id session_token_hash idempotency_key state quarantine_reason released_at released_by_operator_id completion_milliseconds completed_at created_at updated_at source started_at participant_id',
  revision_metric_counters: 'id revision_id starts completions total_completion_milliseconds mobile_starts tablet_starts desktop_starts created_at updated_at',
  revision_step_metric_counters: 'id revision_id step_stable_id reached dropped created_at updated_at',
  workspaces: 'id name time_zone created_at updated_at sending_window_start sending_window_end setup_operator_initialized_at embed_allowed_origins_json brand_configured brand_supporting_line brand_accent brand_logo_base64 brand_logo_mime brand_logo_version public_flow_slug first_run_completed_at reminder_delay_hours',
  notification_preferences: 'flow_id operator_id mode failure_reason updated_at',
  notification_deliveries: 'id response_id operator_id status idempotency_key attempts first_attempt_at last_attempt_at available_at reason provider_id provider provider_code created_at updated_at',
  notification_attempts: 'id delivery_id ordinal event provider provider_code created_at',
  rer_mail_development_outbox: 'sequence id created_at',
  ik_jobs: 'id destination namespace mapping_version principal_id fingerprint operation_key plan_json state checkpoint total fence error reversal_policy reversal_policy_hash reversal_cursor reversal_hash',
  ik_original_sets: 'job_id version',
  ik_originals: 'job_id kind original_key name sha256 size',
  ik_sources: 'identity source_hash mapping_version effects_hash job_id',
  ik_provenance: 'id job_id ordinal effect_ordinal source_identity destination target_kind target_id reversed record_json',
  ik_stages: 'job_id fence effect_id sha256',
  ik_batches: 'job_id action position end_position fence',
  ik_targets: 'destination kind id revision value_json attachment_json',
  ik_d1_plan_chunks: 'job_id ordinal body',
  ik_d1_original_chunks: 'job_id kind original_key ordinal',
  ik_d1_history: 'id job_id ordinal effect_ordinal source_identity destination target_kind target_id reversed record_json successor_id',
  ik_d1_entries: 'job_id ordinal source_identity owner_job_id effects_hash',
  ik_d1_assertions: 'ok',
  ik_d1_creation_plans: 'job_id ordinal body released',
  ik_d1_reversal_reports: 'job_id effect_id position record_json',
  ik_d1_streams: 'id destination namespace mapping_version principal_id fingerprint operation_key total layout_hash state',
  ik_d1_stream_revisions: 'stream_id destination namespace mapping_version principal_id fingerprint operation_key total layout_hash layout_revision progress_revision',
  ik_d1_stream_pages: 'stream_id ordinal job_id total erased_records',
  ik_d1_stream_origins: 'job_id stream_id ordinal page_total job_operation_key parent_destination parent_namespace parent_mapping_version parent_principal_id parent_fingerprint parent_operation_key parent_total parent_layout_hash',
  ik_d1_erased_sources: 'destination identity',
  ik_d1_erased_targets: 'destination identity',
  ik_d1_indexed_jobs: 'job_id fingerprint',
  ik_d1_plan_index: 'job_id ordinal source_identity target_identity',
  ik_d1_staging: 'id generation destination namespace mapping_version principal_id fingerprint operation_key total pages layout_hash reversal_policy revision registered_revision sealed_revision',
  ik_d1_staging_pages: 'stage_id ordinal job_id total fingerprint plan_json body_hash body_size chunks identities index_hash policy_hash inline_plan',
  ik_d1_staging_chunks: 'stage_id page_ordinal ordinal body body_hash body_size',
  ik_d1_staging_index: 'stage_id page_ordinal ordinal source_identity target_identity',
  ik_d1_staging_originals: 'stage_id original_key name sha256 size',
  ik_d1_preparation_receipts: 'stage_id generation codec_id header_hash header_size header_chunks',
  ik_d1_staging_headers: 'stage_id ordinal body body_hash body_size',
  ik_d1_publication_fences: 'stream_id job_id',
  ik_d1_custody_revisions: 'job_id revision seal',
  ik_d1_native_staging: 'id generation destination namespace mapping_version principal_id job_id fingerprint job_fence action values_count chunks_count identities revision registered_revision sealed_revision',
  ik_d1_native_staging_index: 'stage_id ordinal source_identity target_identity',
  ik_d1_native_staging_values: 'stage_id value_ordinal ordinal body body_hash body_size value_chunks',
  ik_d1_custody_states: 'job_id revision',
  ik_d1_reversal_fences: 'job_id action fence state_revision erased_records reused',
  // The append-only erasure journal and retired jobs travel, so an older archive's custody can be explained and fenced.
  // Neither holds an erased value; the tally is transaction-local and always empty between batches.
  ik_d1_erasure_journal: 'id destination recorded_at records_erased jobs_retired streams_retired stores_json',
  ik_d1_retirements: 'id kind destination receipt_id retired_at',
  ik_d1_erasure_tally: 'receipt_id store image',
  restore_erasure_checkpoint: 'singleton epoch',
  form_import_native_clock: 'id revision',
  form_import_native_epochs: 'target_id revision seal',
  form_import_native_publication_fences: 'stage_id target_id',
  form_import_targets: 'target_id workspace_id kind revision flow_id committed_at',
  form_import_revisions: 'revision_id flow_id source_digest mapping_version',
};
const nul = { type: 'null' };
const captured = { local_mail_outbox: ['message_json'], rer_mail_development_outbox: ['message'], rer_ai_development_outbox: ['record'] };
export const exclusions = {
  invitation_launches: { resume_enabled: { type: 'integer', value: '0' } },
  invitation_participants: { token: nul, opt_out_token: nul },
  local_dev_inbox: { magic_link_token: { type: 'text', value: '' } },
  ik_jobs: { lease_token: nul, lease_expires: nul },
  ik_originals: { bytes: nul },
  ik_stages: { bytes: { type: 'blob', value: '' } },
  ik_d1_original_chunks: { bytes: { type: 'blob', value: '' } },
  // Restoring old response history cannot make it eligible for a new send.
  responses: { notification_eligible: { type: 'integer', value: '0' } },
  response_outbox: { notification_eligible: { type: 'integer', value: '0' } },
  notification_deliveries: { explicit_retry_authorized: { type: 'integer', value: '0' } },
  // A restored analysis never calls a provider by itself: a queued run waits for an operator's retry, a running one fails.
  analysis_runs: { next_attempt_at: nul, lease_until: nul },
};
export function classify(table) {
  const known = retained[table.name];
  if (!known || table.columns.some(column => !known.split(' ').includes(column) && !(column in (exclusions[table.name] ?? {})) && !(captured[table.name] ?? []).includes(column))) {
    throw Object.assign(new Error('Archive schema differs from the explicit table/column privacy classification.'), { recoveryCode: 'UNCLASSIFIED_SCHEMA' });
  }
  return Object.fromEntries(table.columns.map(column => [column, table.name in captured ? 'excluded-capture' : column in (exclusions[table.name] ?? {}) ? 'redacted' : /(?:^|_)token_hash$|^address_hash$/.test(column) ? 'credential-hash' : 'retained']));
}
// Base messages require a real sender and at least one recipient. Captured mail
// cannot be represented as valid empty-address messages without fabrication.
// Preserve these tables in the required schema, but exclude their private rows.
export const excludedCaptureTables = new Set(['local_mail_outbox', 'rer_mail_development_outbox', 'oa_dev_credentials', 'oa_setup_links', 'rer_ai_development_outbox']);
export function sanitize(table) {
  classify(table);
  if (excludedCaptureTables.has(table.name)) return { ...table, rows: [] };
  const replacements = exclusions[table.name] ?? {};
  const rows = withoutDevRows(table, table.rows.map(row => row.map((value, index) => replacements[table.columns[index]] ?? value)));
  rows.sort((left, right) => JSON.stringify(left) < JSON.stringify(right) ? -1 : JSON.stringify(left) > JSON.stringify(right) ? 1 : 0);
  return { ...table, rows };
}
