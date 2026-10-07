ALTER TABLE workspaces ADD COLUMN sending_window_start TEXT NOT NULL DEFAULT '09:00'
  CHECK(length(sending_window_start) = 5 AND substr(sending_window_start, 3, 1) = ':' AND substr(sending_window_start, 1, 2) BETWEEN '00' AND '23' AND substr(sending_window_start, 4, 2) BETWEEN '00' AND '59');
ALTER TABLE workspaces ADD COLUMN sending_window_end TEXT NOT NULL DEFAULT '17:00'
  CHECK(length(sending_window_end) = 5 AND substr(sending_window_end, 3, 1) = ':' AND substr(sending_window_end, 1, 2) BETWEEN '00' AND '23' AND substr(sending_window_end, 4, 2) BETWEEN '00' AND '59');
ALTER TABLE workspaces ADD COLUMN setup_operator_initialized_at TEXT;

ALTER TABLE operators ADD COLUMN is_setup_operator INTEGER NOT NULL DEFAULT 0
  CHECK(is_setup_operator IN (0, 1));
CREATE INDEX operators_workspace_created ON operators(workspace_id, created_at);

ALTER TABLE auth_magic_links ADD COLUMN revoked_at TEXT;
CREATE INDEX auth_magic_links_operator_active ON auth_magic_links(operator_id, expires_at)
  WHERE consumed_at IS NULL AND revoked_at IS NULL;
