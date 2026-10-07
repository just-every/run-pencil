ALTER TABLE flow_revisions ADD COLUMN is_current INTEGER NOT NULL DEFAULT 0 CHECK(is_current IN (0, 1));
ALTER TABLE flow_revisions ADD COLUMN admission_closed_at TEXT;
ALTER TABLE flow_revisions ADD COLUMN admission_close_reason TEXT CHECK(admission_close_reason IN ('manual', 'deadline', 'target', 'archive'));
ALTER TABLE flow_revisions ADD COLUMN deadline_at TEXT;
ALTER TABLE flow_revisions ADD COLUMN deadline_time_zone TEXT;
ALTER TABLE flow_revisions ADD COLUMN target_completed_responses INTEGER;
ALTER TABLE flow_revisions ADD COLUMN policy_snapshot_json TEXT;

UPDATE flow_revisions
SET is_current = 1
WHERE state = 'published'
  AND number = (
    SELECT MAX(candidate.number)
    FROM flow_revisions AS candidate
    WHERE candidate.flow_id = flow_revisions.flow_id
      AND candidate.state = 'published'
  );
CREATE INDEX flow_revisions_current_published ON flow_revisions(flow_id, is_current, state);

ALTER TABLE flow_steps ADD COLUMN stable_id TEXT;
ALTER TABLE flow_steps ADD COLUMN next_step_stable_id TEXT;
ALTER TABLE flow_steps ADD COLUMN question_settings_json TEXT;
UPDATE flow_steps SET stable_id = id WHERE stable_id IS NULL;
UPDATE flow_steps
SET next_step_stable_id = (
  SELECT later.stable_id
  FROM flow_steps AS later
  WHERE later.revision_id = flow_steps.revision_id
    AND later.position = flow_steps.position + 1
)
WHERE kind != 'completion';
CREATE UNIQUE INDEX flow_steps_revision_stable_id_unique ON flow_steps(revision_id, stable_id);

ALTER TABLE choice_options ADD COLUMN stable_id TEXT;
UPDATE choice_options SET stable_id = id WHERE stable_id IS NULL;
CREATE UNIQUE INDEX choice_options_step_stable_id_unique ON choice_options(step_id, stable_id);

CREATE TABLE flow_branch_rules (
  id TEXT PRIMARY KEY NOT NULL,
  revision_id TEXT NOT NULL REFERENCES flow_revisions(id),
  source_step_stable_id TEXT NOT NULL,
  predicate_kind TEXT NOT NULL CHECK(predicate_kind IN ('equals', 'greater_than', 'greater_than_or_equal', 'less_than', 'less_than_or_equal', 'any_of', 'all_of')),
  expected_value_json TEXT NOT NULL,
  destination_step_stable_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(revision_id, source_step_stable_id, position)
);
CREATE INDEX flow_branch_rules_revision_source ON flow_branch_rules(revision_id, source_step_stable_id, position);

ALTER TABLE respondent_sessions ADD COLUMN session_token_hash TEXT;
ALTER TABLE respondent_sessions ADD COLUMN metric_folded_at TEXT;
ALTER TABLE respondent_sessions ADD COLUMN completion_outcome TEXT CHECK(completion_outcome IN ('released', 'quarantined'));
UPDATE respondent_sessions SET session_token_hash = id WHERE session_token_hash IS NULL;
CREATE UNIQUE INDEX respondent_sessions_token_hash_unique ON respondent_sessions(session_token_hash);

CREATE TABLE respondent_session_step_events (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL REFERENCES respondent_sessions(id),
  revision_id TEXT NOT NULL REFERENCES flow_revisions(id),
  step_stable_id TEXT NOT NULL,
  counted_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(session_id, step_stable_id)
);
CREATE INDEX respondent_session_step_events_session ON respondent_session_step_events(session_id);

CREATE TABLE response_answers_replacement (
  id TEXT PRIMARY KEY NOT NULL,
  response_id TEXT NOT NULL,
  step_id TEXT NOT NULL,
  value_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(response_id, step_id)
);
INSERT INTO response_answers_replacement (id, response_id, step_id, value_json, created_at, updated_at)
SELECT id, response_id, step_id, value_json, created_at, updated_at
FROM response_answers;
DROP TABLE response_answers;

CREATE TABLE responses_replacement (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  flow_id TEXT NOT NULL REFERENCES flows(id),
  revision_id TEXT NOT NULL REFERENCES flow_revisions(id),
  session_id TEXT NOT NULL,
  session_token_hash TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('released', 'quarantined')) DEFAULT 'released',
  quarantine_reason TEXT,
  released_at TEXT,
  released_by_operator_id TEXT,
  completion_milliseconds INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(session_id),
  UNIQUE(session_id, idempotency_key)
);
INSERT INTO responses_replacement (
  id, workspace_id, flow_id, revision_id, session_id, session_token_hash, idempotency_key,
  state, quarantine_reason, released_at, released_by_operator_id,
  completion_milliseconds, completed_at, created_at, updated_at
)
SELECT response.id, response.workspace_id, response.flow_id, response.revision_id, response.session_id, session.session_token_hash, response.idempotency_key,
  'released', NULL, response.completed_at, NULL,
  0, response.completed_at, response.created_at, response.updated_at
FROM responses AS response
JOIN respondent_sessions AS session ON session.id = response.session_id;
DROP TABLE responses;
ALTER TABLE responses_replacement RENAME TO responses;
CREATE INDEX responses_revision_completed ON responses(revision_id, completed_at);
CREATE INDEX responses_revision_state ON responses(revision_id, state, completed_at);
CREATE INDEX responses_session_token ON responses(session_id, session_token_hash);

CREATE TABLE response_answers (
  id TEXT PRIMARY KEY NOT NULL,
  response_id TEXT NOT NULL REFERENCES responses(id),
  step_id TEXT NOT NULL,
  value_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(response_id, step_id)
);
INSERT INTO response_answers (id, response_id, step_id, value_json, created_at, updated_at)
SELECT id, response_id, step_id, value_json, created_at, updated_at
FROM response_answers_replacement;
DROP TABLE response_answers_replacement;
CREATE INDEX response_answers_step_id ON response_answers(step_id);

CREATE TABLE response_outbox (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  response_id TEXT NOT NULL REFERENCES responses(id),
  kind TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending', 'dispatched', 'failed')),
  available_at TEXT NOT NULL,
  dispatched_at TEXT,
  failure_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(response_id, kind),
  UNIQUE(workspace_id, idempotency_key)
);
CREATE INDEX response_outbox_pending ON response_outbox(status, available_at);

CREATE TABLE revision_step_metric_counters (
  id TEXT PRIMARY KEY NOT NULL,
  revision_id TEXT NOT NULL REFERENCES flow_revisions(id),
  step_stable_id TEXT NOT NULL,
  reached INTEGER NOT NULL DEFAULT 0,
  dropped INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(revision_id, step_stable_id)
);

CREATE TABLE public_rate_limit_windows (
  id TEXT PRIMARY KEY NOT NULL,
  scope TEXT NOT NULL CHECK(scope IN ('request', 'session', 'submission')),
  address_hash TEXT NOT NULL,
  window_started_at TEXT NOT NULL,
  count INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(scope, address_hash, window_started_at)
);
CREATE INDEX public_rate_limit_windows_expiry ON public_rate_limit_windows(expires_at);

CREATE TABLE audit_entries (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  kind TEXT NOT NULL,
  actor_operator_id TEXT,
  subject_type TEXT NOT NULL,
  subject_id TEXT,
  details_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX audit_entries_workspace_created ON audit_entries(workspace_id, created_at);
CREATE INDEX audit_entries_subject ON audit_entries(subject_type, subject_id, created_at);
