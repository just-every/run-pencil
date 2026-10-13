-- Existing workspaces retain their established entry path. Workspaces created
-- after this migration finish their first-run configuration at /setup.
ALTER TABLE workspaces ADD COLUMN first_run_completed_at TEXT;
UPDATE workspaces SET first_run_completed_at = updated_at;
