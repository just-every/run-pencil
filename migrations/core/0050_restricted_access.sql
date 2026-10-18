-- Private access configuration is referenced by immutable revision settings.
CREATE TABLE form_access_rules (
  id TEXT PRIMARY KEY, flow_id TEXT NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK(mode IN ('password','email','signed')),
  password_verifier TEXT, domains_json TEXT NOT NULL DEFAULT '[]', emails_json TEXT NOT NULL DEFAULT '[]', public_key TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE access_challenges (
  id TEXT PRIMARY KEY, rule_id TEXT NOT NULL REFERENCES form_access_rules(id) ON DELETE CASCADE,
  revision_id TEXT NOT NULL REFERENCES flow_revisions(id) ON DELETE CASCADE,
  email TEXT NOT NULL, code_hash TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL, created_at TEXT NOT NULL,
  delivery_state TEXT NOT NULL CHECK(delivery_state IN ('pending','sent','failed'))
);
CREATE INDEX access_challenge_expiry ON access_challenges(expires_at);
CREATE TABLE session_access (
  session_id TEXT PRIMARY KEY REFERENCES respondent_sessions(id) ON DELETE CASCADE,
  rule_id TEXT NOT NULL REFERENCES form_access_rules(id), email TEXT, subject TEXT
);
CREATE TABLE response_access (
  response_id TEXT PRIMARY KEY REFERENCES responses(id) ON DELETE CASCADE,
  flow_id TEXT NOT NULL REFERENCES flows(id) ON DELETE CASCADE, email TEXT, subject TEXT,
  UNIQUE(flow_id,email)
);
-- Admission and the unique verified-email claim serialize with final collection.
-- Restored history is fenced from delivery; live collection alone carries
-- notification_eligible=1, set by the trusted response transaction.
CREATE TRIGGER response_requires_access BEFORE INSERT ON responses
WHEN json_extract((SELECT form_settings_json FROM flow_revisions WHERE id=NEW.revision_id),'$.access.id') IS NOT NULL
  AND NEW.source != 'imported' AND NEW.notification_eligible=1
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM session_access a JOIN respondent_sessions s ON s.id=a.session_id
    WHERE a.session_id=NEW.session_id AND s.revision_id=NEW.revision_id
      AND a.rule_id=json_extract((SELECT form_settings_json FROM flow_revisions WHERE id=NEW.revision_id),'$.access.id')
  ) THEN RAISE(ABORT,'ACCESS_REQUIRED') END;
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM session_access a JOIN response_access used ON used.flow_id=NEW.flow_id AND used.email=a.email WHERE a.session_id=NEW.session_id
  ) THEN RAISE(ABORT,'ACCESS_ALREADY_COMPLETED') END;
END;
CREATE TRIGGER response_retains_access AFTER INSERT ON responses
BEGIN
  INSERT INTO response_access(response_id,flow_id,email,subject)
    SELECT NEW.id,NEW.flow_id,email,subject FROM session_access WHERE session_id=NEW.session_id;
END;
