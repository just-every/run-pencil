ALTER TABLE distribution_contacts ADD COLUMN fields_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE invitation_launches ADD COLUMN resume_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE workspaces ADD COLUMN reminder_delay_hours REAL;
CREATE TABLE distribution_segments (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id), name TEXT NOT NULL,
 rules_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
-- Durable selection and evaluation; a launch continues without consulting edited contacts or segments.
CREATE TABLE invitation_candidates (
 id TEXT PRIMARY KEY, launch_id TEXT NOT NULL REFERENCES invitation_launches(id),
 contact_id TEXT REFERENCES distribution_contacts(id), email_snapshot TEXT, name_snapshot TEXT,
 outcome TEXT NOT NULL CHECK(outcome IN ('pending','invited','alreadyInvited','optedOut','noAddress','policyExcluded')),
 UNIQUE(launch_id,contact_id)
);
CREATE INDEX invitation_candidates_launch ON invitation_candidates(launch_id,outcome);
ALTER TABLE flow_revisions ADD COLUMN invitation_reserved_count INTEGER NOT NULL DEFAULT 0 CHECK(invitation_reserved_count BETWEEN 0 AND 25000);
UPDATE flow_revisions SET invitation_reserved_count=(SELECT count(*) FROM invitation_participants WHERE revision_id=flow_revisions.id);
CREATE INDEX invitation_candidates_contact ON invitation_candidates(contact_id,outcome,launch_id);
CREATE INDEX invitation_launches_revision ON invitation_launches(revision_id);
