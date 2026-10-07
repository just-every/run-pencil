-- Additive: historical anonymous responses and metrics are unchanged.
CREATE TABLE distribution_contacts (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id),
 email TEXT NOT NULL COLLATE NOCASE, name TEXT NOT NULL, opted_out_at TEXT,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 UNIQUE(workspace_id, email)
);
CREATE TABLE invitation_launches (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id),
 revision_id TEXT NOT NULL REFERENCES flow_revisions(id), command_key TEXT NOT NULL,
 policy_json TEXT NOT NULL, actor_operator_id TEXT, created_at TEXT NOT NULL,
 UNIQUE(workspace_id, command_key)
);
CREATE TABLE invitation_participants (
 id TEXT PRIMARY KEY, launch_id TEXT NOT NULL REFERENCES invitation_launches(id),
 workspace_id TEXT NOT NULL REFERENCES workspaces(id), revision_id TEXT NOT NULL REFERENCES flow_revisions(id),
 contact_id TEXT REFERENCES distribution_contacts(id), email_snapshot TEXT, name_snapshot TEXT,
 token TEXT UNIQUE, opt_out_token TEXT UNIQUE,
 delivery_status TEXT NOT NULL CHECK(delivery_status IN ('queued','sent','bounced','failed','unknown')),
 response_status TEXT NOT NULL CHECK(response_status IN ('not-started','started','completed')),
 completed_at TEXT, completion_step_id TEXT, created_at TEXT NOT NULL,
 UNIQUE(revision_id, contact_id)
);
CREATE TABLE mail_deliveries (
 id TEXT PRIMARY KEY, participant_id TEXT NOT NULL REFERENCES invitation_participants(id),
 kind TEXT NOT NULL CHECK(kind IN ('invitation','reminder')),
 status TEXT NOT NULL CHECK(status IN ('pending','sending','sent','unknown','failed','cancelled')),
 idempotency_key TEXT NOT NULL UNIQUE, available_at TEXT NOT NULL,
 first_attempt_at TEXT, last_attempt_at TEXT, attempts INTEGER NOT NULL DEFAULT 0,
 provider_id TEXT, reason TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 UNIQUE(participant_id, kind)
);
CREATE INDEX mail_deliveries_due ON mail_deliveries(status, available_at);
CREATE TABLE mail_delivery_attempts (
 id TEXT PRIMARY KEY, delivery_id TEXT NOT NULL REFERENCES mail_deliveries(id),
 ordinal INTEGER NOT NULL, event TEXT NOT NULL, actor_operator_id TEXT, reason TEXT, provider_id TEXT, created_at TEXT NOT NULL
);
CREATE INDEX mail_delivery_attempts_delivery ON mail_delivery_attempts(delivery_id, created_at);
CREATE TABLE contact_consent_events (
 id TEXT PRIMARY KEY, contact_id TEXT REFERENCES distribution_contacts(id), workspace_id TEXT NOT NULL REFERENCES workspaces(id),
 consent TEXT NOT NULL CHECK(consent IN ('opted-out','renewed')), actor TEXT NOT NULL, source TEXT NOT NULL, created_at TEXT NOT NULL
);
ALTER TABLE responses ADD COLUMN participant_id TEXT REFERENCES invitation_participants(id);
CREATE UNIQUE INDEX responses_participant_unique ON responses(participant_id) WHERE participant_id IS NOT NULL;
-- Erasure revokes all retained public capabilities and leaves delivery facts without identity.
CREATE TRIGGER invitation_response_erasure BEFORE DELETE ON responses WHEN OLD.participant_id IS NOT NULL BEGIN
 UPDATE mail_deliveries SET status = CASE WHEN status IN ('pending','sending','unknown') THEN 'cancelled' ELSE status END,
   reason = NULL, provider_id = NULL WHERE participant_id = OLD.participant_id;
 UPDATE mail_delivery_attempts SET reason = NULL, provider_id = NULL WHERE delivery_id IN (SELECT id FROM mail_deliveries WHERE participant_id = OLD.participant_id);
 UPDATE invitation_participants SET contact_id = NULL, email_snapshot = NULL, name_snapshot = NULL, token = NULL, opt_out_token = NULL, completion_step_id = NULL
   WHERE id = OLD.participant_id;
END;

CREATE TRIGGER invitation_operator_erasure AFTER DELETE ON operators BEGIN
 UPDATE invitation_launches SET actor_operator_id = NULL WHERE actor_operator_id = OLD.id;
 UPDATE contact_consent_events SET actor = 'erased-operator' WHERE actor = OLD.id AND workspace_id = OLD.workspace_id;
 UPDATE mail_delivery_attempts SET actor_operator_id = NULL WHERE actor_operator_id = OLD.id;
END;
