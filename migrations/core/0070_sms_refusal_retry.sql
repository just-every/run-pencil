ALTER TABLE mail_deliveries ADD COLUMN sms_mobile TEXT;
ALTER TABLE mail_deliveries ADD COLUMN refusal_code INTEGER;
-- Preserve existing Twilio refusals as structured state, including pre-upgrade rows.
UPDATE mail_deliveries SET refusal_code = CAST(substr(reason, instr(reason, '(error ') + 7) AS INTEGER)
WHERE status = 'failed' AND instr(reason, '(error ') > 0 AND participant_id IN (
 SELECT p.id FROM invitation_participants p JOIN invitation_launches l ON l.id = p.launch_id
 WHERE json_extract(l.policy_json, '$.channel') = 'sms'
);
CREATE TRIGGER erase_sms_retry_target AFTER UPDATE OF contact_id ON invitation_participants
WHEN NEW.contact_id IS NULL AND OLD.contact_id IS NOT NULL
BEGIN
 UPDATE mail_deliveries SET sms_mobile = NULL WHERE participant_id = OLD.id;
END;
