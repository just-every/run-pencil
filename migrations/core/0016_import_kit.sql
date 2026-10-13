CREATE TABLE IF NOT EXISTS ik_jobs (
 id TEXT PRIMARY KEY, destination TEXT NOT NULL, namespace TEXT NOT NULL,
 mapping_version TEXT NOT NULL, principal_id TEXT NOT NULL, fingerprint TEXT NOT NULL,
 operation_key TEXT NOT NULL, plan_json TEXT NOT NULL, state TEXT NOT NULL,
 checkpoint INTEGER NOT NULL DEFAULT 0, total INTEGER NOT NULL, fence INTEGER NOT NULL DEFAULT 0,
 lease_token TEXT, lease_expires INTEGER, error TEXT,
 UNIQUE(destination, principal_id, operation_key)
);
CREATE TABLE IF NOT EXISTS ik_original_sets (
 job_id TEXT PRIMARY KEY REFERENCES ik_jobs(id), version INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS ik_originals (
 job_id TEXT NOT NULL REFERENCES ik_jobs(id), kind TEXT NOT NULL, original_key TEXT NOT NULL,
 name TEXT NOT NULL, sha256 TEXT NOT NULL, size INTEGER NOT NULL, bytes BLOB,
 PRIMARY KEY(job_id,kind,original_key)
);
CREATE TABLE IF NOT EXISTS ik_sources (
 identity TEXT PRIMARY KEY, source_hash TEXT NOT NULL, mapping_version TEXT NOT NULL,
 effects_hash TEXT NOT NULL, job_id TEXT NOT NULL REFERENCES ik_jobs(id)
);
CREATE TABLE IF NOT EXISTS ik_provenance (
 id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES ik_jobs(id), ordinal INTEGER NOT NULL, effect_ordinal INTEGER NOT NULL,
 source_identity TEXT NOT NULL, destination TEXT NOT NULL, target_kind TEXT NOT NULL,
 target_id TEXT NOT NULL, reversed INTEGER NOT NULL DEFAULT 0, record_json TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS ik_active_target ON ik_provenance(destination,target_kind,target_id) WHERE reversed=0;
CREATE TABLE IF NOT EXISTS ik_stages (
 job_id TEXT NOT NULL REFERENCES ik_jobs(id), fence INTEGER NOT NULL, effect_id TEXT NOT NULL,
 sha256 TEXT NOT NULL, bytes BLOB NOT NULL, PRIMARY KEY(job_id,fence,effect_id)
);
CREATE TABLE IF NOT EXISTS ik_batches (
 job_id TEXT NOT NULL REFERENCES ik_jobs(id), action TEXT NOT NULL, position INTEGER NOT NULL,
 end_position INTEGER NOT NULL, fence INTEGER NOT NULL, PRIMARY KEY(job_id,action,position)
);
CREATE TABLE IF NOT EXISTS ik_targets (
 destination TEXT NOT NULL, kind TEXT NOT NULL, id TEXT NOT NULL,
 revision TEXT NOT NULL, value_json TEXT NOT NULL, attachment_json TEXT,
 PRIMARY KEY(destination,kind,id)
);
CREATE TABLE IF NOT EXISTS ik_d1_plan_chunks (job_id TEXT NOT NULL REFERENCES ik_jobs(id), ordinal INTEGER NOT NULL, body TEXT NOT NULL, PRIMARY KEY(job_id,ordinal));
CREATE TABLE IF NOT EXISTS ik_d1_original_chunks (job_id TEXT NOT NULL REFERENCES ik_jobs(id), kind TEXT NOT NULL, original_key TEXT NOT NULL, ordinal INTEGER NOT NULL, bytes BLOB NOT NULL, PRIMARY KEY(job_id,kind,original_key,ordinal));
CREATE TABLE IF NOT EXISTS ik_d1_history (id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES ik_jobs(id), ordinal INTEGER NOT NULL, effect_ordinal INTEGER NOT NULL, source_identity TEXT NOT NULL, destination TEXT NOT NULL, target_kind TEXT NOT NULL, target_id TEXT NOT NULL, reversed INTEGER NOT NULL CHECK(reversed=0), record_json TEXT NOT NULL, successor_id TEXT NOT NULL UNIQUE);
CREATE INDEX IF NOT EXISTS ik_d1_history_job ON ik_d1_history(job_id);
CREATE TABLE IF NOT EXISTS ik_d1_entries (job_id TEXT NOT NULL REFERENCES ik_jobs(id), ordinal INTEGER NOT NULL, source_identity TEXT NOT NULL, owner_job_id TEXT NOT NULL REFERENCES ik_jobs(id), effects_hash TEXT NOT NULL, PRIMARY KEY(job_id,ordinal));
CREATE TABLE IF NOT EXISTS ik_d1_assertions (ok INTEGER NOT NULL CONSTRAINT IMPORT_ATOMIC_GUARD CHECK(ok=1));
