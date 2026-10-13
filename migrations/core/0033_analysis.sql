-- ANLY-001..008, 010..016: grounded analysis runs. Additive only.
-- A run fixes its evidence (the exact released response IDs of one published revision) and its policy snapshot when
-- it is requested. Themes, members, quotes and the one recommendation are written only after Pencil validated the
-- provider's answer against that evidence; counts are always recomputed from analysis_theme_members.

-- The workspace's current policies: analysis.autorun.v1, analysis.disclosure.v1, recommendation.selection.v1.
-- A missing row means the defaults (autorun on close at 5 completed responses, threshold 5, highest impact).
CREATE TABLE analysis_policies (
  workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  autorun_enabled INTEGER NOT NULL DEFAULT 1 CHECK(autorun_enabled IN (0,1)),
  autorun_minimum INTEGER NOT NULL DEFAULT 5 CHECK(autorun_minimum BETWEEN 1 AND 100000),
  disclosure_threshold INTEGER NOT NULL DEFAULT 5 CHECK(disclosure_threshold BETWEEN 1 AND 1000),
  selection TEXT NOT NULL DEFAULT 'highest-impact' CHECK(selection IN ('highest-impact')),
  updated_by_operator_id TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE analysis_runs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  flow_id TEXT NOT NULL,
  revision_id TEXT NOT NULL,
  trigger TEXT NOT NULL CHECK(trigger IN ('operator','autorun')),
  requested_by_operator_id TEXT,
  state TEXT NOT NULL CHECK(state IN ('queued','running','completed','insufficient_evidence','failed')),
  question_ids_json TEXT NOT NULL CHECK(json_valid(question_ids_json)),
  policy_json TEXT NOT NULL CHECK(json_valid(policy_json)),
  evidence_count INTEGER NOT NULL CHECK(evidence_count >= 0),
  evidence_cutoff TEXT NOT NULL,
  request_sha256 TEXT,
  provider_origin TEXT,
  model TEXT,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 4),
  first_attempt_at TEXT,
  next_attempt_at TEXT,
  lease_until TEXT,
  error_code TEXT,
  error_message TEXT,
  insufficient_reason TEXT,
  summary TEXT,
  redacted_at TEXT,
  created_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  updated_at TEXT NOT NULL
);
CREATE INDEX analysis_runs_workspace ON analysis_runs(workspace_id, created_at);
CREATE INDEX analysis_runs_due ON analysis_runs(state, next_attempt_at);
-- analysis.autorun.v1 runs at most once per closed revision.
CREATE UNIQUE INDEX analysis_runs_autorun ON analysis_runs(revision_id) WHERE trigger = 'autorun';

CREATE TABLE analysis_evidence (
  run_id TEXT NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
  response_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  PRIMARY KEY(run_id, response_id)
);
CREATE INDEX analysis_evidence_response ON analysis_evidence(response_id);

CREATE TABLE analysis_themes (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK(is_primary IN (0,1)),
  UNIQUE(run_id, rank)
);
CREATE TABLE analysis_theme_members (
  theme_id TEXT NOT NULL REFERENCES analysis_themes(id) ON DELETE CASCADE,
  run_id TEXT NOT NULL,
  response_id TEXT NOT NULL,
  PRIMARY KEY(theme_id, response_id)
);
CREATE INDEX analysis_theme_members_response ON analysis_theme_members(response_id);
CREATE TABLE analysis_quotes (
  id TEXT PRIMARY KEY,
  theme_id TEXT NOT NULL REFERENCES analysis_themes(id) ON DELETE CASCADE,
  run_id TEXT NOT NULL,
  response_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  start_offset INTEGER NOT NULL CHECK(start_offset >= 0),
  end_offset INTEGER NOT NULL,
  excerpt TEXT NOT NULL,
  CHECK(end_offset > start_offset)
);
CREATE INDEX analysis_quotes_response ON analysis_quotes(response_id);

CREATE TABLE analysis_recommendations (
  run_id TEXT PRIMARY KEY REFERENCES analysis_runs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  rationale TEXT,
  theme_ids_json TEXT NOT NULL CHECK(json_valid(theme_ids_json)),
  confidence TEXT NOT NULL CHECK(confidence IN ('low','medium','high')),
  expected_impact TEXT NOT NULL CHECK(expected_impact IN ('low','medium','high')),
  effort TEXT NOT NULL CHECK(effort IN ('low','medium','high'))
);

-- ANLY-010: one row per provider call. Cost is the linked service's receipt, the owner's rates times usage, or null.
CREATE TABLE analysis_calls (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  run_id TEXT NOT NULL,
  feature TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_origin TEXT NOT NULL,
  model TEXT NOT NULL,
  attempt INTEGER NOT NULL,
  outcome TEXT NOT NULL CHECK(outcome IN ('answered','failed')),
  error_code TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_microusd INTEGER,
  cost_source TEXT NOT NULL CHECK(cost_source IN ('receipt','rates','not-reported')),
  receipt_id TEXT,
  day TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX analysis_calls_day ON analysis_calls(workspace_id, day, feature);

-- Base ai's local development capture (modules/ai/dev/outbox.mjs), created here so its schema is committed; its rows
-- never travel in archives.
CREATE TABLE IF NOT EXISTS rer_ai_development_outbox (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL, record TEXT NOT NULL
);
