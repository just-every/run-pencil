import { questionTypes } from '../../shared/questionKinds'
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const workspaces = sqliteTable('workspaces', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  brandConfigured: integer('brand_configured', { mode: 'boolean' }).notNull().default(false),
  brandSupportingLine: text('brand_supporting_line').notNull().default(''),
  brandAccent: text('brand_accent').notNull().default('#d4d4d4'),
  brandLogoBase64: text('brand_logo_base64'),
  brandLogoMime: text('brand_logo_mime'),
  brandLogoVersion: text('brand_logo_version'),
  publicFlowSlug: text('public_flow_slug'),
  timeZone: text('time_zone').notNull(),
  embedAllowedOriginsJson: text('embed_allowed_origins_json').notNull().default('[]'),
  sendingWindowStart: text('sending_window_start').notNull(),
  sendingWindowEnd: text('sending_window_end').notNull(),
  setupOperatorInitializedAt: text('setup_operator_initialized_at'),
  firstRunCompletedAt: text('first_run_completed_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const operators = sqliteTable(
  'operators',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    email: text('email').notNull(),
    displayName: text('display_name').notNull(),
    isSetupOperator: integer('is_setup_operator', { mode: 'boolean' }).notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [uniqueIndex('operators_workspace_email_unique').on(table.workspaceId, table.email)],
)

export const operatorSessions = sqliteTable(
  'operator_sessions',
  {
    id: text('id').primaryKey(),
    operatorId: text('operator_id')
      .notNull()
      .references(() => operators.id),
    tokenHash: text('token_hash').notNull(),
    expiresAt: text('expires_at').notNull(),
    lastActiveAt: text('last_active_at').notNull(),
    revokedAt: text('revoked_at'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [uniqueIndex('operator_sessions_token_hash_unique').on(table.tokenHash), index('operator_sessions_operator_id').on(table.operatorId)],
)

export const authMagicLinks = sqliteTable(
  'auth_magic_links',
  {
    id: text('id').primaryKey(),
    operatorId: text('operator_id')
      .notNull()
      .references(() => operators.id),
    tokenHash: text('token_hash').notNull(),
    expiresAt: text('expires_at').notNull(),
    consumedAt: text('consumed_at'),
    revokedAt: text('revoked_at'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [uniqueIndex('auth_magic_links_token_hash_unique').on(table.tokenHash), index('auth_magic_links_operator_id').on(table.operatorId)],
)

/**
 * This table is deliberately limited to local development. It is not a mail
 * adapter and production code never reads it unless MAIL_PROVIDER=local and
 * PENCIL_LOCAL_DEVELOPMENT=true are both present.
 */
export const localDevInbox = sqliteTable(
  'local_dev_inbox',
  {
    id: text('id').primaryKey(),
    toEmail: text('to_email').notNull(),
    magicLinkToken: text('magic_link_token').notNull(),
    expiresAt: text('expires_at').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('local_dev_inbox_email_created').on(table.toEmail, table.createdAt)],
)

export const flows = sqliteTable(
  'flows',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    status: text('status', { enum: ['draft', 'open', 'closed', 'archived'] }).notNull(),
    draftVersion: integer('draft_version').notNull(),
    lastActivityAt: text('last_activity_at').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [uniqueIndex('flows_workspace_slug_unique').on(table.workspaceId, table.slug), index('flows_workspace_activity').on(table.workspaceId, table.lastActivityAt)],
)

export const flowRevisions = sqliteTable(
  'flow_revisions',
  {
    id: text('id').primaryKey(),
    flowId: text('flow_id')
      .notNull()
      .references(() => flows.id),
    number: integer('number').notNull(),
    state: text('state', { enum: ['draft', 'published'] }).notNull(),
    title: text('title').notNull(),
    publishedAt: text('published_at'),
    isCurrent: integer('is_current', { mode: 'boolean' }).notNull(),
    admissionClosedAt: text('admission_closed_at'),
    admissionCloseReason: text('admission_close_reason', { enum: ['manual', 'deadline', 'target', 'archive'] }),
    deadlineAt: text('deadline_at'),
    deadlineTimeZone: text('deadline_time_zone'),
    targetCompletedResponses: integer('target_completed_responses'),
    policySnapshotJson: text('policy_snapshot_json'),
    formSettingsJson: text('form_settings_json').notNull().default('{}'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('flow_revisions_flow_number_unique').on(table.flowId, table.number),
    index('flow_revisions_flow_state').on(table.flowId, table.state),
    index('flow_revisions_current_published').on(table.flowId, table.isCurrent, table.state),
  ],
)

export const flowSteps = sqliteTable(
  'flow_steps',
  {
    id: text('id').primaryKey(),
    revisionId: text('revision_id')
      .notNull()
      .references(() => flowRevisions.id),
    position: integer('position').notNull(),
    stableId: text('stable_id').notNull(),
    kind: text('kind', { enum: ['welcome', 'question', 'payment', 'completion'] }).notNull(),
    questionType: text('question_type', { enum: questionTypes }),
    prompt: text('prompt').notNull(),
    helperText: text('helper_text'),
    required: integer('required', { mode: 'boolean' }).notNull(),
    nextStepStableId: text('next_step_stable_id'),
    questionSettingsJson: text('question_settings_json'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('flow_steps_revision_position_unique').on(table.revisionId, table.position),
    uniqueIndex('flow_steps_revision_stable_id_unique').on(table.revisionId, table.stableId),
    index('flow_steps_revision_id').on(table.revisionId),
  ],
)

export const choiceOptions = sqliteTable(
  'choice_options',
  {
    id: text('id').primaryKey(),
    stepId: text('step_id')
      .notNull(),
    stableId: text('stable_id').notNull(),
    value: text('value').notNull(),
    label: text('label').notNull(),
    position: integer('position').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('choice_options_step_value_unique').on(table.stepId, table.value),
    uniqueIndex('choice_options_step_position_unique').on(table.stepId, table.position),
    uniqueIndex('choice_options_step_stable_id_unique').on(table.stepId, table.stableId),
  ],
)

export const flowBranchRules = sqliteTable(
  'flow_branch_rules',
  {
    id: text('id').primaryKey(),
    revisionId: text('revision_id')
      .notNull()
      .references(() => flowRevisions.id),
    sourceStepStableId: text('source_step_stable_id').notNull(),
    predicateKind: text('predicate_kind', { enum: ['equals', 'greater_than', 'greater_than_or_equal', 'less_than', 'less_than_or_equal', 'any_of', 'all_of'] }).notNull(),
    expectedValueJson: text('expected_value_json').notNull(),
    conditionJson: text('condition_json'),
    destinationStepStableId: text('destination_step_stable_id').notNull(),
    position: integer('position').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('flow_branch_rules_revision_source_position_unique').on(table.revisionId, table.sourceStepStableId, table.position),
    index('flow_branch_rules_revision_source').on(table.revisionId, table.sourceStepStableId, table.position),
  ],
)

export const respondentSessions = sqliteTable(
  'respondent_sessions',
  {
    id: text('id').primaryKey(),
    revisionId: text('revision_id')
      .notNull()
      .references(() => flowRevisions.id),
    source: text('source', { enum: ['direct', 'embed', 'invitation'] }).notNull(),
    deviceClass: text('device_class', { enum: ['mobile', 'tablet', 'desktop'] }).notNull(),
    presentationJson: text('presentation_json').notNull().default('{}'),
    furthestStepId: text('furthest_step_id'),
    sessionTokenHash: text('session_token_hash').notNull(),
    completedAt: text('completed_at'),
    metricFoldedAt: text('metric_folded_at'),
    completionOutcome: text('completion_outcome', { enum: ['released', 'quarantined'] }),
    expiresAt: text('expires_at').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('respondent_sessions_token_hash_unique').on(table.sessionTokenHash),
    index('respondent_sessions_revision_id').on(table.revisionId),
    index('respondent_sessions_expiry').on(table.expiresAt),
  ],
)

export const respondentSessionStepEvents = sqliteTable(
  'respondent_session_step_events',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id')
      .notNull()
      .references(() => respondentSessions.id),
    revisionId: text('revision_id')
      .notNull()
      .references(() => flowRevisions.id),
    stepStableId: text('step_stable_id').notNull(),
    countedAt: text('counted_at'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('respondent_session_step_events_session_step_unique').on(table.sessionId, table.stepStableId),
    index('respondent_session_step_events_session').on(table.sessionId),
  ],
)

export const responses = sqliteTable(
  'responses',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    flowId: text('flow_id')
      .notNull()
      .references(() => flows.id),
    revisionId: text('revision_id')
      .notNull()
      .references(() => flowRevisions.id),
    source: text('source', { enum: ['direct', 'embed', 'invitation', 'unknown', 'imported'] }).notNull().default('unknown'),
    deviceClass: text('device_class', { enum: ['mobile', 'tablet', 'desktop'] }),
    startedAt: text('started_at'),
    sessionId: text('session_id')
      .notNull(),
    participantId: text('participant_id'),
    sessionTokenHash: text('session_token_hash').notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    state: text('state', { enum: ['released', 'quarantined'] }).notNull(),
    quarantineReason: text('quarantine_reason'),
    contextJson: text('response_context_json').notNull().default('{}'),
    releasedAt: text('released_at'),
    releasedByOperatorId: text('released_by_operator_id'),
    completionMilliseconds: integer('completion_milliseconds').notNull(),
    completedAt: text('completed_at').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('responses_session_unique').on(table.sessionId),
    uniqueIndex('responses_session_idempotency_unique').on(table.sessionId, table.idempotencyKey),
    index('responses_revision_completed').on(table.revisionId, table.completedAt),
    index('responses_revision_state').on(table.revisionId, table.state, table.completedAt),
    index('responses_session_token').on(table.sessionId, table.sessionTokenHash),
  ],
)

export const responseOutbox = sqliteTable(
  'response_outbox',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    responseId: text('response_id')
      .notNull()
      .references(() => responses.id),
    kind: text('kind').notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    payloadJson: text('payload_json').notNull(),
    status: text('status', { enum: ['pending', 'dispatched', 'failed'] }).notNull(),
    availableAt: text('available_at').notNull(),
    dispatchedAt: text('dispatched_at'),
    failureReason: text('failure_reason'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('response_outbox_response_kind_unique').on(table.responseId, table.kind),
    uniqueIndex('response_outbox_workspace_idempotency_unique').on(table.workspaceId, table.idempotencyKey),
    index('response_outbox_pending').on(table.status, table.availableAt),
  ],
)

export const responseAnswers = sqliteTable(
  'response_answers',
  {
    id: text('id').primaryKey(),
    responseId: text('response_id')
      .notNull()
      .references(() => responses.id),
    // Answers retain the revision-stable step ID even after that draft step is deleted.
    stepId: text('step_id').notNull(),
    valueJson: text('value_json').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [uniqueIndex('response_answers_response_step_unique').on(table.responseId, table.stepId), index('response_answers_step_id').on(table.stepId)],
)

export const revisionMetricCounters = sqliteTable(
  'revision_metric_counters',
  {
    id: text('id').primaryKey(),
    revisionId: text('revision_id')
      .notNull()
      .references(() => flowRevisions.id),
    starts: integer('starts').notNull(),
    completions: integer('completions').notNull(),
    totalCompletionMilliseconds: integer('total_completion_milliseconds').notNull(),
    mobileStarts: integer('mobile_starts').notNull(),
    tabletStarts: integer('tablet_starts').notNull(),
    desktopStarts: integer('desktop_starts').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [uniqueIndex('revision_metric_counters_revision_unique').on(table.revisionId)],
)

export const revisionStepMetricCounters = sqliteTable(
  'revision_step_metric_counters',
  {
    id: text('id').primaryKey(),
    revisionId: text('revision_id')
      .notNull()
      .references(() => flowRevisions.id),
    stepStableId: text('step_stable_id').notNull(),
    reached: integer('reached').notNull(),
    dropped: integer('dropped').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [uniqueIndex('revision_step_metric_counters_revision_step_unique').on(table.revisionId, table.stepStableId)],
)

export const publicRateLimitWindows = sqliteTable(
  'public_rate_limit_windows',
  {
    id: text('id').primaryKey(),
    scope: text('scope', { enum: ['request', 'session', 'submission'] }).notNull(),
    addressHash: text('address_hash').notNull(),
    windowStartedAt: text('window_started_at').notNull(),
    count: integer('count').notNull(),
    expiresAt: text('expires_at').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('public_rate_limit_windows_scope_address_window_unique').on(table.scope, table.addressHash, table.windowStartedAt),
    index('public_rate_limit_windows_expiry').on(table.expiresAt),
  ],
)

export const auditEntries = sqliteTable(
  'audit_entries',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    kind: text('kind').notNull(),
    actorOperatorId: text('actor_operator_id'),
    subjectType: text('subject_type').notNull(),
    subjectId: text('subject_id'),
    detailsJson: text('details_json').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('audit_entries_workspace_created').on(table.workspaceId, table.createdAt), index('audit_entries_subject').on(table.subjectType, table.subjectId, table.createdAt)],
)

// Explicit saved drafts are separate from operator-visible response data.
export const respondentSaves = sqliteTable('respondent_saves', {
  sessionId: text('session_id').primaryKey(),
  revisionId: text('revision_id').notNull().references(() => flowRevisions.id),
  tokenHash: text('token_hash'),
  commandKey: text('command_key').notNull(),
  deliveryId: text('delivery_id').notNull().unique(),
  deliveryEmail: text('delivery_email'),
  deliveryState: text('delivery_state', {enum:['sending','sent','failed','completed']}).notNull(),
  currentStepId: text('current_step_id'),
  answersJson: text('answers_json'),
  participantId: text('participant_id'),
  responseId: text('response_id').references(() => responses.id, {onDelete:'cascade'}),
  completionStepId: text('completion_step_id'),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, table => [uniqueIndex('respondent_saves_token_hash').on(table.tokenHash),index('respondent_saves_expiry').on(table.expiresAt)])
