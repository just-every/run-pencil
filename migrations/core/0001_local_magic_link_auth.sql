CREATE TABLE auth_magic_links (
  id TEXT PRIMARY KEY NOT NULL,
  operator_id TEXT NOT NULL REFERENCES operators(id),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX auth_magic_links_operator_id ON auth_magic_links(operator_id);

-- This inbox is a local-development transport selected explicitly by both
-- MAIL_PROVIDER=local and PENCIL_LOCAL_DEVELOPMENT=true. It is never a
-- production fallback.
CREATE TABLE local_dev_inbox (
  id TEXT PRIMARY KEY NOT NULL,
  to_email TEXT NOT NULL,
  magic_link_token TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX local_dev_inbox_email_created ON local_dev_inbox(to_email, created_at);
