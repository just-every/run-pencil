PRAGMA foreign_keys = ON;

CREATE TABLE workspaces (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  time_zone TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE operators (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(workspace_id, email)
);

CREATE TABLE operator_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  operator_id TEXT NOT NULL REFERENCES operators(id),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  last_active_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX operator_sessions_operator_id ON operator_sessions(operator_id);

CREATE TABLE flows (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('draft', 'open', 'closed', 'archived')),
  draft_version INTEGER NOT NULL,
  last_activity_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(workspace_id, slug)
);
CREATE INDEX flows_workspace_activity ON flows(workspace_id, last_activity_at);

CREATE TABLE flow_revisions (
  id TEXT PRIMARY KEY NOT NULL,
  flow_id TEXT NOT NULL REFERENCES flows(id),
  number INTEGER NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('draft', 'published')),
  title TEXT NOT NULL,
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(flow_id, number)
);
CREATE INDEX flow_revisions_flow_state ON flow_revisions(flow_id, state);

CREATE TABLE flow_steps (
  id TEXT PRIMARY KEY NOT NULL,
  revision_id TEXT NOT NULL REFERENCES flow_revisions(id),
  position INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('welcome', 'question', 'completion')),
  question_type TEXT CHECK(question_type IN ('short_text', 'long_text', 'email', 'single_choice', 'multiple_choice', 'rating', 'priority')),
  prompt TEXT NOT NULL,
  helper_text TEXT,
  required INTEGER NOT NULL CHECK(required IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(revision_id, position)
);
CREATE INDEX flow_steps_revision_id ON flow_steps(revision_id);

CREATE TABLE choice_options (
  id TEXT PRIMARY KEY NOT NULL,
  step_id TEXT NOT NULL REFERENCES flow_steps(id),
  value TEXT NOT NULL,
  label TEXT NOT NULL,
  position INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(step_id, value),
  UNIQUE(step_id, position)
);

CREATE TABLE respondent_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  revision_id TEXT NOT NULL REFERENCES flow_revisions(id),
  source TEXT NOT NULL CHECK(source IN ('direct', 'embed', 'invitation')),
  device_class TEXT NOT NULL CHECK(device_class IN ('mobile', 'tablet', 'desktop')),
  furthest_step_id TEXT REFERENCES flow_steps(id),
  completed_at TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX respondent_sessions_revision_id ON respondent_sessions(revision_id);
CREATE INDEX respondent_sessions_expiry ON respondent_sessions(expires_at);

CREATE TABLE responses (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  flow_id TEXT NOT NULL REFERENCES flows(id),
  revision_id TEXT NOT NULL REFERENCES flow_revisions(id),
  session_id TEXT NOT NULL REFERENCES respondent_sessions(id),
  idempotency_key TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(session_id, idempotency_key)
);
CREATE INDEX responses_revision_completed ON responses(revision_id, completed_at);

CREATE TABLE response_answers (
  id TEXT PRIMARY KEY NOT NULL,
  response_id TEXT NOT NULL REFERENCES responses(id),
  step_id TEXT NOT NULL REFERENCES flow_steps(id),
  value_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(response_id, step_id)
);
CREATE INDEX response_answers_step_id ON response_answers(step_id);

CREATE TABLE revision_metric_counters (
  id TEXT PRIMARY KEY NOT NULL,
  revision_id TEXT NOT NULL REFERENCES flow_revisions(id),
  starts INTEGER NOT NULL,
  completions INTEGER NOT NULL,
  total_completion_milliseconds INTEGER NOT NULL,
  mobile_starts INTEGER NOT NULL,
  tablet_starts INTEGER NOT NULL,
  desktop_starts INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(revision_id)
);
