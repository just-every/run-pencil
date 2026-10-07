-- Published step rows change on each revision; progress identifies a stable step within its revision.
-- Preserve live sessions and their counted step events while removing the obsolete row-ID foreign key.
CREATE TABLE respondent_sessions_replacement (
  id TEXT PRIMARY KEY NOT NULL,
  revision_id TEXT NOT NULL REFERENCES flow_revisions(id),
  source TEXT NOT NULL CHECK(source IN ('direct', 'embed', 'invitation')),
  device_class TEXT NOT NULL CHECK(device_class IN ('mobile', 'tablet', 'desktop')),
  furthest_step_id TEXT,
  completed_at TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  session_token_hash TEXT,
  metric_folded_at TEXT,
  completion_outcome TEXT CHECK(completion_outcome IN ('released', 'quarantined'))
);
INSERT INTO respondent_sessions_replacement
SELECT id, revision_id, source, device_class,
  COALESCE((SELECT stable_id FROM flow_steps WHERE id = respondent_sessions.furthest_step_id AND revision_id = respondent_sessions.revision_id), furthest_step_id),
  completed_at, expires_at, created_at, updated_at, session_token_hash, metric_folded_at, completion_outcome
FROM respondent_sessions;
CREATE TABLE respondent_session_step_events_replacement (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL REFERENCES respondent_sessions_replacement(id),
  revision_id TEXT NOT NULL REFERENCES flow_revisions(id),
  step_stable_id TEXT NOT NULL,
  counted_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(session_id, step_stable_id)
);
INSERT INTO respondent_session_step_events_replacement SELECT * FROM respondent_session_step_events;
DROP TABLE respondent_session_step_events;
DROP TABLE respondent_sessions;
ALTER TABLE respondent_sessions_replacement RENAME TO respondent_sessions;
ALTER TABLE respondent_session_step_events_replacement RENAME TO respondent_session_step_events;
CREATE INDEX respondent_sessions_revision_id ON respondent_sessions(revision_id);
CREATE INDEX respondent_sessions_expiry ON respondent_sessions(expires_at);
CREATE UNIQUE INDEX respondent_sessions_token_hash_unique ON respondent_sessions(session_token_hash);
CREATE INDEX respondent_session_step_events_session ON respondent_session_step_events(session_id);
