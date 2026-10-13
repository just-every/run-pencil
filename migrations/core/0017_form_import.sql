CREATE TABLE form_import_targets (
 target_id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id),
 kind TEXT NOT NULL CHECK(kind IN ('form','response')), revision TEXT NOT NULL,
 flow_id TEXT NOT NULL,
 committed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX form_import_targets_workspace ON form_import_targets(workspace_id);
CREATE TABLE form_import_revisions (
 revision_id TEXT PRIMARY KEY REFERENCES flow_revisions(id),
 flow_id TEXT NOT NULL REFERENCES flows(id), source_digest TEXT NOT NULL,
 mapping_version TEXT NOT NULL
);
CREATE TRIGGER form_import_commit_immutable BEFORE UPDATE OF committed_at ON form_import_targets
WHEN NEW.committed_at IS NOT OLD.committed_at
BEGIN SELECT RAISE(ABORT, 'Import publication time is immutable'); END;
