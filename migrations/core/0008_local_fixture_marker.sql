-- Local synthetic data is initialized once, never silently recreated after an operator edits it.
CREATE TABLE local_fixture_initializations (id TEXT PRIMARY KEY NOT NULL, initialized_at TEXT NOT NULL);
