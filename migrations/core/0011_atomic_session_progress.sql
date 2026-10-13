-- A dedicated write view lets old code keep using its base-table batch during
-- upgrades. Creating it changes no retained sessions, events or counters.
CREATE VIEW respondent_session_progress AS
-- Resolve the parent flow once while materializing a candidate session. The
-- caller still checks its current slug and the step in the pinned revision.
SELECT s.id, s.revision_id, s.session_token_hash, s.completed_at, s.expires_at,
       s.furthest_step_id, s.updated_at, f.slug AS flow_slug
FROM respondent_sessions s
JOIN flow_revisions r ON r.id = s.revision_id
JOIN flows f ON f.id = r.flow_id;

-- Both triggers execute inside the caller's authenticated UPDATE statement.
-- Their order is immaterial: session progress and visit telemetry are disjoint,
-- and a failure in either rolls the whole statement back.
CREATE TRIGGER respondent_session_progress_update
INSTEAD OF UPDATE OF furthest_step_id ON respondent_session_progress
BEGIN
  UPDATE respondent_sessions
  SET furthest_step_id = NEW.furthest_step_id, updated_at = NEW.updated_at
  WHERE id = OLD.id;
END;

CREATE TRIGGER respondent_session_progress_visit
INSTEAD OF UPDATE OF furthest_step_id ON respondent_session_progress
WHEN NEW.furthest_step_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM respondent_session_step_events
  WHERE session_id = OLD.id AND step_stable_id = NEW.furthest_step_id
)
BEGIN
  INSERT INTO revision_step_metric_counters (
    id, revision_id, step_stable_id, reached, dropped, created_at, updated_at
  ) VALUES (
    'step-metric-' || OLD.revision_id || '-' || NEW.furthest_step_id,
    OLD.revision_id, NEW.furthest_step_id, 1, 0, NEW.updated_at, NEW.updated_at
  )
  ON CONFLICT(revision_id, step_stable_id) DO UPDATE
    SET reached = reached + 1, updated_at = excluded.updated_at;

  INSERT INTO respondent_session_step_events (
    id, session_id, revision_id, step_stable_id, counted_at, created_at
  ) VALUES (
    'event-' || OLD.id || '-' || NEW.furthest_step_id,
    OLD.id, OLD.revision_id, NEW.furthest_step_id, NEW.updated_at, NEW.updated_at
  );
END;
