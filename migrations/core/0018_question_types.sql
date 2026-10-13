-- D1 migrations run in a transaction with foreign keys enabled. Deferring
-- validation would not suppress cascading deletes. Copy the parent and its
-- only remaining foreign-key child, then drop the old child before its parent.
-- Responses and session progress use stable step IDs after migrations 0004/0006;
-- branch rules also use stable IDs. None of those tables needs to be rebuilt.
-- https://developers.cloudflare.com/d1/sql-api/foreign-keys/
-- https://www.sqlite.org/lang_altertable.html
CREATE TABLE flow_steps_expanded (
  id TEXT PRIMARY KEY NOT NULL,
  revision_id TEXT NOT NULL REFERENCES flow_revisions(id),
  position INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('welcome', 'question', 'completion')),
  question_type TEXT CHECK(question_type IN ('short_text', 'long_text', 'email', 'single_choice', 'multiple_choice', 'rating', 'priority', 'dropdown', 'yes_no', 'nps', 'number', 'date', 'consent')),
  prompt TEXT NOT NULL,
  helper_text TEXT,
  required INTEGER NOT NULL CHECK(required IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  stable_id TEXT,
  next_step_stable_id TEXT,
  question_settings_json TEXT,
  UNIQUE(revision_id, position)
);
INSERT INTO flow_steps_expanded (
  id, revision_id, position, kind, question_type, prompt, helper_text, required,
  created_at, updated_at, stable_id, next_step_stable_id, question_settings_json
)
SELECT id, revision_id, position, kind, question_type, prompt, helper_text, required,
  created_at, updated_at, stable_id, next_step_stable_id, question_settings_json
FROM flow_steps;

CREATE TABLE choice_options_expanded (
  id TEXT PRIMARY KEY NOT NULL,
  step_id TEXT NOT NULL REFERENCES flow_steps_expanded(id),
  value TEXT NOT NULL,
  label TEXT NOT NULL,
  position INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  stable_id TEXT,
  UNIQUE(step_id, value),
  UNIQUE(step_id, position)
);
INSERT INTO choice_options_expanded (
  id, step_id, value, label, position, created_at, updated_at, stable_id
)
SELECT id, step_id, value, label, position, created_at, updated_at, stable_id
FROM choice_options;

DROP TABLE choice_options;
DROP TABLE flow_steps;
-- SQLite updates choice_options_expanded's FK when its new parent is renamed.
ALTER TABLE flow_steps_expanded RENAME TO flow_steps;
ALTER TABLE choice_options_expanded RENAME TO choice_options;
CREATE INDEX flow_steps_revision_id ON flow_steps(revision_id);
CREATE UNIQUE INDEX flow_steps_revision_stable_id_unique ON flow_steps(revision_id, stable_id);
CREATE UNIQUE INDEX choice_options_step_stable_id_unique ON choice_options(step_id, stable_id);
