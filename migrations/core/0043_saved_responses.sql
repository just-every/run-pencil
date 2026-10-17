-- Explicit respondent-controlled saves are private session state, never partial
-- responses. A receipt survives session deletion only after final commitment.
CREATE TABLE respondent_saves (
  session_id TEXT PRIMARY KEY NOT NULL,
  revision_id TEXT NOT NULL REFERENCES flow_revisions(id),
  token_hash TEXT,
  command_key TEXT NOT NULL,
  delivery_id TEXT NOT NULL UNIQUE,
  delivery_email TEXT,
  delivery_state TEXT NOT NULL CHECK(delivery_state IN ('sending','sent','failed','completed')),
  current_step_id TEXT,
  answers_json TEXT,
  participant_id TEXT REFERENCES invitation_participants(id) ON DELETE CASCADE,
  response_id TEXT REFERENCES responses(id) ON DELETE CASCADE,
  completion_step_id TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX respondent_saves_token_hash ON respondent_saves(token_hash);
CREATE INDEX respondent_saves_expiry ON respondent_saves(expires_at);

CREATE TRIGGER respondent_save_completed AFTER INSERT ON responses BEGIN
  UPDATE respondent_saves SET response_id=NEW.id,answers_json=NULL,current_step_id=NULL,
    delivery_email=NULL,delivery_state='completed',updated_at=NEW.completed_at
    WHERE session_id=NEW.session_id;
  DELETE FROM rer_mail_development_outbox WHERE json_extract(message,'$.deliveryId') IN (
    SELECT delivery_id FROM respondent_saves WHERE session_id=NEW.session_id);
END;
CREATE TRIGGER respondent_save_session_deleted AFTER DELETE ON respondent_sessions BEGIN
  DELETE FROM respondent_saves WHERE session_id=OLD.id AND response_id IS NULL;
END;
CREATE TRIGGER respondent_save_deleted AFTER DELETE ON respondent_saves BEGIN
  DELETE FROM rer_mail_development_outbox WHERE json_extract(message,'$.deliveryId')=OLD.delivery_id;
END;
CREATE TRIGGER respondent_save_replaced AFTER UPDATE OF delivery_id ON respondent_saves
WHEN OLD.delivery_id!=NEW.delivery_id BEGIN
  DELETE FROM rer_mail_development_outbox WHERE json_extract(message,'$.deliveryId')=OLD.delivery_id;
END;
-- Closure and invitation erasure end the saved capability immediately. Completed
-- receipts remain readable until their original expiry or response erasure.
CREATE TRIGGER respondent_save_revision_closed AFTER UPDATE OF admission_closed_at ON flow_revisions
WHEN NEW.admission_closed_at IS NOT NULL BEGIN
  DELETE FROM respondent_saves WHERE revision_id=NEW.id AND response_id IS NULL;
END;
CREATE TRIGGER respondent_save_invitation_erased AFTER UPDATE OF token ON invitation_participants
WHEN NEW.token IS NULL BEGIN
  DELETE FROM respondent_saves WHERE participant_id=NEW.id AND response_id IS NULL;
END;
CREATE TRIGGER respondent_save_collector_closed AFTER UPDATE OF closed_at ON collectors
WHEN NEW.closed_at IS NOT NULL BEGIN
  DELETE FROM respondent_saves WHERE response_id IS NULL AND session_id IN(
    SELECT session_id FROM session_collector WHERE collector_id=NEW.id);
END;

-- Audit each requested delivery before mail leaves the installation. No address,
-- bearer, session or answer enters this retained feature fact. Restored saves
-- have no bearer hash, so restoration never creates a new outbound action.
CREATE TRIGGER respondent_save_delivery_requested AFTER INSERT ON respondent_saves
WHEN NEW.token_hash IS NOT NULL AND NEW.delivery_state='sending' BEGIN
  INSERT INTO audit_entries(id,workspace_id,kind,actor_operator_id,subject_type,subject_id,details_json,created_at)
  SELECT lower(hex(randomblob(16))),f.workspace_id,'response.resume-requested',NULL,'flow',f.id,
    json_object('revisionId',NEW.revision_id),NEW.updated_at
  FROM flow_revisions r JOIN flows f ON f.id=r.flow_id WHERE r.id=NEW.revision_id;
END;
CREATE TRIGGER respondent_save_delivery_retried AFTER UPDATE OF delivery_state ON respondent_saves
WHEN NEW.token_hash IS NOT NULL AND NEW.delivery_state='sending' BEGIN
  INSERT INTO audit_entries(id,workspace_id,kind,actor_operator_id,subject_type,subject_id,details_json,created_at)
  SELECT lower(hex(randomblob(16))),f.workspace_id,'response.resume-requested',NULL,'flow',f.id,
    json_object('revisionId',NEW.revision_id),NEW.updated_at
  FROM flow_revisions r JOIN flows f ON f.id=r.flow_id WHERE r.id=NEW.revision_id;
END;
