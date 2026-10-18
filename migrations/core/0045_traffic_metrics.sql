-- Views are counts only. No session/response key or visitor metadata exists here.
CREATE TABLE revision_view_counters (
  revision_id TEXT NOT NULL REFERENCES flow_revisions(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  day TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0 CHECK(count >= 0),
  PRIMARY KEY(revision_id, source, day)
);
CREATE TABLE revision_start_counters (
  revision_id TEXT NOT NULL REFERENCES flow_revisions(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  day TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0 CHECK(count >= 0),
  PRIMARY KEY(revision_id, source, day)
);
-- The start cohort travels with existing private session/response custody.
-- There is deliberately no key pointing at an individual view.
CREATE TABLE session_traffic (
  session_id TEXT PRIMARY KEY REFERENCES respondent_sessions(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  day TEXT NOT NULL
);
CREATE TABLE response_traffic (
  response_id TEXT PRIMARY KEY REFERENCES responses(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  day TEXT NOT NULL
);
CREATE TRIGGER response_traffic_capture AFTER INSERT ON responses WHEN NEW.source != 'imported'
BEGIN
  INSERT INTO response_traffic(response_id,source,day)
    SELECT NEW.id,source,day FROM session_traffic WHERE session_id=NEW.session_id;
END;
CREATE TABLE traffic_tracking (id INTEGER PRIMARY KEY CHECK(id=1), started_at TEXT NOT NULL);
