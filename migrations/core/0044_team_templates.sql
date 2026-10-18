CREATE TABLE team_templates (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  structure_json TEXT NOT NULL,
  created_by TEXT REFERENCES operators(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  retired_at TEXT
);
CREATE INDEX team_templates_workspace ON team_templates(workspace_id, retired_at, created_at);
