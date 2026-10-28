CREATE TABLE saved_report_views (
 id TEXT PRIMARY KEY,
 workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 flow_id TEXT NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
 revision_id TEXT NOT NULL REFERENCES flow_revisions(id) ON DELETE CASCADE,
 name TEXT NOT NULL,
 definition_json TEXT NOT NULL CHECK(json_valid(definition_json)),
 cutoff TEXT NOT NULL,
 threshold INTEGER NOT NULL CHECK(threshold >= 1),
 saved_by TEXT NOT NULL REFERENCES operators(id),
 saved_by_name TEXT NOT NULL,
 created_at TEXT NOT NULL
);
CREATE INDEX saved_report_views_flow ON saved_report_views(workspace_id,flow_id,created_at,id);

CREATE TABLE saved_report_shares (
 id TEXT PRIMARY KEY,
 workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 view_id TEXT NOT NULL REFERENCES saved_report_views(id) ON DELETE CASCADE,
 token_hash TEXT NOT NULL UNIQUE,
 password_verifier TEXT,
 expires_at TEXT,
 revoked_at TEXT,
 threshold INTEGER NOT NULL CHECK(threshold >= 1),
 created_at TEXT NOT NULL
);
CREATE INDEX saved_report_shares_view ON saved_report_shares(view_id,created_at,id);

CREATE TABLE saved_report_dashboards (
 id TEXT PRIMARY KEY,
 workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 name TEXT NOT NULL,
 scope TEXT NOT NULL CHECK(scope IN ('form','program')),
 flow_id TEXT REFERENCES flows(id) ON DELETE CASCADE,
 view_ids_json TEXT NOT NULL CHECK(json_valid(view_ids_json)),
 saved_by TEXT NOT NULL REFERENCES operators(id),
 saved_by_name TEXT NOT NULL,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 CHECK((scope = 'form' AND flow_id IS NOT NULL) OR (scope = 'program' AND flow_id IS NULL))
);
CREATE INDEX saved_report_dashboards_workspace ON saved_report_dashboards(workspace_id,created_at,id);
