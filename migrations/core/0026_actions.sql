-- Owned actions (ACT-001 to ACT-008). Actions hold operator-written text and frozen aggregate figures only:
-- no response identifiers, answer excerpts or cohort filters, so response erasure never needs to reach them.
CREATE TABLE actions (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id),
 title TEXT NOT NULL, rationale TEXT NOT NULL,
 owner_operator_id TEXT REFERENCES operators(id) ON DELETE SET NULL,
 state TEXT NOT NULL CHECK(state IN ('planned','in_progress','ready_for_review','effective','ineffective','closed')),
 verdict TEXT CHECK(verdict IN ('effective','ineffective')),
 review_date TEXT NOT NULL CHECK(review_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
 source TEXT NOT NULL CHECK(source IN ('manual','analysis')),
 analysis_id TEXT,
 metric_name TEXT NOT NULL, metric_unit TEXT NOT NULL,
 metric_direction TEXT NOT NULL CHECK(metric_direction IN ('increase','decrease')),
 baseline_value REAL NOT NULL, baseline_source TEXT NOT NULL, baseline_observed_at TEXT NOT NULL,
 version INTEGER NOT NULL DEFAULT 1,
 -- Names the history row written with the latest change, so that row is written in the same batch only when the change was.
 last_event_id TEXT NOT NULL,
 created_by_operator_id TEXT REFERENCES operators(id) ON DELETE SET NULL,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 -- ACT-008: a manual recommendation has no analysis; an action from an analysis must name it.
 CHECK((source = 'manual' AND analysis_id IS NULL) OR (source = 'analysis' AND analysis_id IS NOT NULL))
);
CREATE INDEX actions_workspace_state ON actions(workspace_id, state, review_date);
-- The figures shown when the action was created, kept as they were.
CREATE TABLE action_evidence (
 action_id TEXT PRIMARY KEY REFERENCES actions(id),
 flow_id TEXT NOT NULL REFERENCES flows(id), revision_id TEXT NOT NULL REFERENCES flow_revisions(id),
 question_stable_id TEXT, figures_json TEXT NOT NULL, captured_at TEXT NOT NULL
);
-- Append-only history: creation, every transition and every edit.
CREATE TABLE action_events (
 id TEXT PRIMARY KEY, action_id TEXT NOT NULL REFERENCES actions(id),
 kind TEXT NOT NULL CHECK(kind IN ('created','transition','edited','measurement')),
 from_state TEXT, to_state TEXT, note TEXT, changes_json TEXT,
 operator_id TEXT REFERENCES operators(id) ON DELETE SET NULL, created_at TEXT NOT NULL
);
CREATE INDEX action_events_action ON action_events(action_id, created_at, id);
CREATE TABLE action_measurements (
 id TEXT PRIMARY KEY, action_id TEXT NOT NULL REFERENCES actions(id),
 flow_id TEXT NOT NULL REFERENCES flows(id), revision_id TEXT REFERENCES flow_revisions(id),
 observed_value REAL NOT NULL, unit TEXT NOT NULL, observed_at TEXT NOT NULL,
 operator_id TEXT REFERENCES operators(id) ON DELETE SET NULL, created_at TEXT NOT NULL
);
CREATE INDEX action_measurements_action ON action_measurements(action_id, created_at, id);
-- One external task per action: one idempotency key for its whole life (ACT-003, ACT-007).
CREATE TABLE action_task_deliveries (
 action_id TEXT PRIMARY KEY REFERENCES actions(id),
 idempotency_key TEXT NOT NULL UNIQUE,
 state TEXT NOT NULL CHECK(state IN ('pending','confirmed','unknown','failed')),
 payload_json TEXT NOT NULL, payload_sha256 TEXT NOT NULL, action_version INTEGER NOT NULL,
 confirmed_by_operator_id TEXT REFERENCES operators(id) ON DELETE SET NULL, confirmed_at TEXT NOT NULL,
 in_flight_attempt_id TEXT, remote_task_id TEXT, updated_at TEXT NOT NULL
);
-- One row per attempt, written before the call; its outcome is written once afterwards.
CREATE TABLE action_task_attempts (
 id TEXT PRIMARY KEY, action_id TEXT NOT NULL REFERENCES action_task_deliveries(action_id),
 ordinal INTEGER NOT NULL, idempotency_key TEXT NOT NULL, payload_sha256 TEXT NOT NULL,
 operator_id TEXT REFERENCES operators(id) ON DELETE SET NULL, started_at TEXT NOT NULL,
 outcome TEXT CHECK(outcome IN ('confirmed','failed','unknown')),
 outcome_class TEXT CHECK(outcome_class IN ('2xx','3xx','4xx','5xx','invalid-response','timeout','network','refused','abandoned')),
 http_status INTEGER, remote_task_id TEXT, finished_at TEXT,
 UNIQUE(action_id, ordinal)
);
