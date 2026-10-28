-- A non-bearer digest locates explicitly saved responses after delivery removes
-- its plaintext address. It expires and is erased with that saved response.
ALTER TABLE respondent_saves ADD COLUMN privacy_email_hash TEXT;
CREATE INDEX respondent_saves_privacy_email ON respondent_saves(privacy_email_hash);
