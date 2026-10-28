-- A non-bearer digest locates explicitly saved responses after delivery removes
-- its plaintext address. It expires and is erased with that saved response.
ALTER TABLE respondent_saves ADD COLUMN privacy_email_hash TEXT;
CREATE INDEX respondent_saves_privacy_email ON respondent_saves(privacy_email_hash);

-- Completion returns the response to its published identity rules. The mailbox
-- chosen only for a resume link must not become an identity on an anonymous answer.
CREATE TRIGGER privacy_save_completed AFTER INSERT ON responses BEGIN
  UPDATE respondent_saves SET privacy_email_hash=NULL WHERE session_id=NEW.session_id;
END;
