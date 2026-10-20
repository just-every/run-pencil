-- ACT-009: additive delivery eligibility and durable action reminder outbox.
-- Existing actions and every historical row remain intact; recovery disables eligibility.
ALTER TABLE actions ADD COLUMN reminders_enabled INTEGER NOT NULL DEFAULT 1 CHECK(reminders_enabled IN (0,1));
CREATE TABLE action_reminders (
 id TEXT PRIMARY KEY,
 action_id TEXT NOT NULL REFERENCES actions(id) ON DELETE CASCADE,
 operator_id TEXT REFERENCES operators(id) ON DELETE SET NULL,
 kind TEXT NOT NULL CHECK(kind IN ('before','on_date','overdue')),
 due_date TEXT NOT NULL,
 review_date TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('pending','sending','sent','failed','unknown','cancelled')),
 idempotency_key TEXT NOT NULL UNIQUE,
 attempts INTEGER NOT NULL DEFAULT 0,
 first_attempt_at TEXT, last_attempt_at TEXT,
 available_at TEXT NOT NULL,
 reason TEXT, provider_id TEXT, provider TEXT, provider_code TEXT,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 UNIQUE(action_id,kind,due_date)
);
CREATE INDEX action_reminders_due ON action_reminders(status,available_at,due_date);
CREATE TABLE action_reminder_attempts (
 id TEXT PRIMARY KEY,
 reminder_id TEXT NOT NULL REFERENCES action_reminders(id) ON DELETE CASCADE,
 ordinal INTEGER NOT NULL,
 event TEXT NOT NULL CHECK(event IN ('started','sent','transient','permanent','unknown')),
 provider TEXT, provider_code TEXT,
 created_at TEXT NOT NULL,
 UNIQUE(reminder_id,ordinal,event)
);
-- An operator verdict cancels queued mail in the verdict transaction, not at the next cron.
-- Changed dates/owners invalidate the old recipient schedule; sent history stays intact.
CREATE TRIGGER action_reminders_changed AFTER UPDATE OF verdict,state,review_date,owner_operator_id ON actions
BEGIN
 UPDATE action_reminders SET status='cancelled',reason='Action reviewed, closed, or its reminder schedule changed.',updated_at=NEW.updated_at
 WHERE action_id=NEW.id AND status IN ('pending','sending')
 AND (NEW.verdict IS NOT NULL OR NEW.state='closed' OR NEW.review_date<>OLD.review_date
   OR (NEW.owner_operator_id IS NOT OLD.owner_operator_id AND (status='sending' OR attempts>0)));
 UPDATE action_reminders SET operator_id=NEW.owner_operator_id,reason=NULL,updated_at=NEW.updated_at
 WHERE action_id=NEW.id AND status='pending' AND attempts=0 AND NEW.owner_operator_id IS NOT OLD.owner_operator_id;
END;
