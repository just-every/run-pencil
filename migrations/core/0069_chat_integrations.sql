CREATE TABLE integration_connections_chat(kind TEXT PRIMARY KEY CHECK(kind IN('analysis','task','payment','sms','google','slack','teams')),sealed TEXT NOT NULL,updated_at TEXT NOT NULL);
INSERT INTO integration_connections_chat SELECT kind,sealed,updated_at FROM integration_connections;
DROP TABLE integration_connections;
ALTER TABLE integration_connections_chat RENAME TO integration_connections;
CREATE TABLE chat_form_links (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id), flow_id TEXT NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
 platform TEXT NOT NULL CHECK(platform IN('slack','teams')), settings_json TEXT NOT NULL,
 armed INTEGER NOT NULL DEFAULT 1 CHECK(armed IN(0,1)), updated_at TEXT NOT NULL, UNIQUE(flow_id,platform)
);
CREATE TABLE chat_action_targets (
 id TEXT PRIMARY KEY, action_id TEXT NOT NULL REFERENCES actions(id) ON DELETE CASCADE,
 link_id TEXT NOT NULL REFERENCES chat_form_links(id) ON DELETE CASCADE, operator_id TEXT NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
 platform TEXT NOT NULL CHECK(platform IN('slack','teams')), user_id TEXT NOT NULL, UNIQUE(action_id,platform)
);
CREATE TABLE chat_deliveries (
 id TEXT PRIMARY KEY, link_id TEXT NOT NULL REFERENCES chat_form_links(id) ON DELETE CASCADE,
 response_id TEXT REFERENCES responses(id) ON DELETE CASCADE, action_target_id TEXT REFERENCES chat_action_targets(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN('response','before','on_date','overdue')), due_date TEXT, review_date TEXT,
 idempotency_key TEXT NOT NULL UNIQUE, state TEXT NOT NULL CHECK(state IN('pending','sending','confirmed','unknown','failed','cancelled')),
 attempts INTEGER NOT NULL DEFAULT 0, available_at TEXT NOT NULL, started_at TEXT, reason TEXT, updated_at TEXT NOT NULL,
 CHECK((kind='response' AND response_id IS NOT NULL AND action_target_id IS NULL) OR (kind<>'response' AND response_id IS NULL AND action_target_id IS NOT NULL))
);
CREATE INDEX chat_deliveries_due ON chat_deliveries(state,available_at,id);
CREATE INDEX chat_deliveries_response ON chat_deliveries(response_id);
CREATE TABLE chat_attempts (
 id TEXT PRIMARY KEY, delivery_id TEXT NOT NULL REFERENCES chat_deliveries(id) ON DELETE CASCADE, ordinal INTEGER NOT NULL,
 outcome TEXT NOT NULL CHECK(outcome IN('started','confirmed','unknown','failed','cancelled')),http_status INTEGER, reason TEXT, created_at TEXT NOT NULL
);
CREATE INDEX chat_attempts_delivery ON chat_attempts(delivery_id,ordinal);
CREATE TABLE chat_interactions (
 delivery_id TEXT PRIMARY KEY REFERENCES chat_deliveries(id) ON DELETE CASCADE, action_id TEXT NOT NULL REFERENCES actions(id) ON DELETE CASCADE, created_at TEXT NOT NULL
);
