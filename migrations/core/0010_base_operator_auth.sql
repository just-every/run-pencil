-- Additive schema draft. Integrator assigns the next migration number; never
-- replace an applied migration. All epoch timestamps are milliseconds.
CREATE TABLE oa_operators (
 id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('owner','admin','member')),
 status TEXT NOT NULL CHECK(status IN ('invited','active','inactive')),
 version INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL
);
CREATE TABLE oa_bootstrap (singleton INTEGER PRIMARY KEY CHECK(singleton=1), claim_id TEXT NOT NULL UNIQUE, claimed_at INTEGER NOT NULL);
CREATE TABLE oa_tokens (
 id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE,
 kind TEXT NOT NULL CHECK(kind IN ('magic','invite')),
 operator_id TEXT NOT NULL REFERENCES oa_operators(id), operator_version INTEGER NOT NULL,
 issuer_id TEXT REFERENCES oa_operators(id), issuer_version INTEGER,
 return_to TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
 consumed_at INTEGER, revoked_at INTEGER,
 CHECK((kind='invite' AND issuer_id IS NOT NULL AND issuer_version IS NOT NULL)
    OR (kind='magic' AND issuer_id IS NULL AND issuer_version IS NULL))
);
CREATE TABLE oa_sessions (
 id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE,
 operator_id TEXT NOT NULL REFERENCES oa_operators(id), operator_version INTEGER NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('native','review','oidc','password')),
 source_token_id TEXT UNIQUE REFERENCES oa_tokens(id),
 created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, revoked_at INTEGER
);
CREATE INDEX oa_sessions_operator ON oa_sessions(operator_id);
CREATE TABLE oa_external_identities (
 issuer TEXT NOT NULL, subject TEXT NOT NULL, operator_id TEXT NOT NULL REFERENCES oa_operators(id),
 PRIMARY KEY(issuer, subject)
);
CREATE TABLE oa_limits (key TEXT PRIMARY KEY, window INTEGER NOT NULL, count INTEGER NOT NULL);
CREATE TRIGGER oa_preserve_last_owner_update BEFORE UPDATE OF status,role ON oa_operators
 WHEN OLD.role='owner' AND OLD.status='active' AND (NEW.role!='owner' OR NEW.status!='active')
 AND (SELECT COUNT(*) FROM oa_operators WHERE role='owner' AND status='active') <= 1
 BEGIN SELECT RAISE(ABORT, 'last_owner'); END;
CREATE TRIGGER oa_preserve_last_owner_delete BEFORE DELETE ON oa_operators
 WHEN OLD.role='owner' AND OLD.status='active'
 AND (SELECT COUNT(*) FROM oa_operators WHERE role='owner' AND status='active') <= 1
 BEGIN SELECT RAISE(ABORT, 'last_owner'); END;
-- A status/role change invalidates every preexisting session and link, including
-- after a later reactivation. Keep this invariant for direct administrative SQL.
CREATE TRIGGER oa_operator_version AFTER UPDATE OF status,role ON oa_operators
 WHEN OLD.status != NEW.status OR OLD.role != NEW.role
 BEGIN UPDATE oa_operators SET version=OLD.version+1 WHERE id=NEW.id; END;

-- Import existing native operators without resetting their stable product IDs.
-- Duplicate addresses in historical workspaces retain their product rows; the
-- first existing operator is the sole sign-in principal, as before adoption.
INSERT INTO oa_operators(id,email,display_name,role,status,version,created_at)
 SELECT id,lower(email),display_name,'owner','active',1,CAST(strftime('%s',created_at) AS INTEGER)*1000
 FROM operators WHERE id IN (SELECT min(id) FROM operators GROUP BY lower(email));
INSERT INTO oa_bootstrap(singleton,claim_id,claimed_at)
 SELECT 1,'pencil-existing-operators',CAST(strftime('%s','now') AS INTEGER)*1000 WHERE EXISTS(SELECT 1 FROM operators);
-- Old bearer credentials are deliberately invalidated. Only oa sessions are
-- admitted by the application after this migration; operators request fresh mail.
UPDATE operator_sessions SET revoked_at = COALESCE(revoked_at,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
UPDATE auth_magic_links SET revoked_at = COALESCE(revoked_at,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
DELETE FROM local_dev_inbox;
-- Product entity IDs remain ULIDs. Base credentials retain their own identity IDs.
CREATE TABLE operator_auth_links (
 operator_id TEXT PRIMARY KEY REFERENCES operators(id) ON DELETE CASCADE,
 auth_id TEXT NOT NULL UNIQUE REFERENCES oa_operators(id)
);
INSERT INTO operator_auth_links SELECT id,id FROM oa_operators;
CREATE TRIGGER pencil_import_operator AFTER INSERT ON operators BEGIN
 INSERT OR IGNORE INTO oa_operators(id,email,display_name,role,status,version,created_at)
 VALUES(NEW.id,lower(NEW.email),NEW.display_name,'owner','active',1,CAST(strftime('%s',NEW.created_at) AS INTEGER)*1000);
 INSERT OR IGNORE INTO operator_auth_links(operator_id,auth_id)
 SELECT NEW.id,id FROM oa_operators WHERE lower(email)=lower(NEW.email);
 INSERT OR IGNORE INTO oa_bootstrap VALUES(1,'pencil-existing-operators',CAST(strftime('%s','now') AS INTEGER)*1000);
END;
CREATE TABLE local_mail_outbox(delivery_id TEXT PRIMARY KEY, message_json TEXT NOT NULL, created_at TEXT NOT NULL);
