CREATE TABLE integration_connections_sms (kind TEXT PRIMARY KEY CHECK(kind IN('analysis','task','payment','sms')),sealed TEXT NOT NULL,updated_at TEXT NOT NULL);
INSERT INTO integration_connections_sms SELECT kind,sealed,updated_at FROM integration_connections;
DROP TABLE integration_connections;
ALTER TABLE integration_connections_sms RENAME TO integration_connections;
ALTER TABLE distribution_contacts ADD COLUMN mobile TEXT;
ALTER TABLE distribution_contacts ADD COLUMN sms_consent_at TEXT;
ALTER TABLE distribution_contacts ADD COLUMN sms_consent_mobile TEXT;
ALTER TABLE distribution_contacts ADD COLUMN sms_stopped_at TEXT;
CREATE TABLE sms_consent_events (
 id TEXT PRIMARY KEY NOT NULL,
 contact_id TEXT NOT NULL REFERENCES distribution_contacts(id) ON DELETE CASCADE,
 mobile TEXT NOT NULL,
 given INTEGER NOT NULL CHECK(given IN(0,1)),
 wording TEXT NOT NULL,
 source TEXT NOT NULL,
 actor_operator_id TEXT REFERENCES operators(id) ON DELETE SET NULL,
 actor_kind TEXT NOT NULL CHECK(actor_kind IN('operator','recipient')),
 created_at TEXT NOT NULL
);
CREATE INDEX sms_consent_contact ON sms_consent_events(contact_id,created_at);
CREATE TRIGGER cancel_stopped_sms AFTER UPDATE OF sms_stopped_at,mobile ON distribution_contacts
WHEN NEW.sms_stopped_at IS NOT NULL OR NEW.mobile IS NOT OLD.mobile
BEGIN
 UPDATE mail_deliveries SET status='cancelled',reason='SMS consent is no longer eligible.',updated_at=NEW.updated_at
 WHERE status='pending' AND participant_id IN (
  SELECT p.id FROM invitation_participants p JOIN invitation_launches l ON l.id=p.launch_id
  WHERE p.contact_id=NEW.id AND json_extract(l.policy_json,'$.channel')='sms'
 );
END;

ALTER TABLE invitation_candidates ADD COLUMN sms_mobile_snapshot TEXT;
ALTER TABLE invitation_participants ADD COLUMN sms_mobile_snapshot TEXT;
