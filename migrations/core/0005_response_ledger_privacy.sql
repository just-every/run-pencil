-- Preserve applied migrations. Add durable ledger facts before removing completed
-- session rows, so a response cannot be joined to a session's device classification.
ALTER TABLE responses ADD COLUMN source TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE responses ADD COLUMN started_at TEXT;
UPDATE responses
SET source = COALESCE((SELECT source FROM respondent_sessions WHERE id = responses.session_id), 'unknown'),
    started_at = (SELECT created_at FROM respondent_sessions WHERE id = responses.session_id);
-- Completed session metrics are already retained in revision counters.
DELETE FROM respondent_session_step_events WHERE session_id IN (SELECT session_id FROM responses);
DELETE FROM respondent_sessions WHERE id IN (SELECT session_id FROM responses);
