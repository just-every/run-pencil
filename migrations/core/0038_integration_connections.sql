-- Private installation settings. Ciphertext and metadata never travel in an archive.
CREATE TABLE integration_connections (
  kind TEXT PRIMARY KEY CHECK (kind IN ('analysis', 'task')),
  sealed TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
