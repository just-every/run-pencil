CREATE TABLE integration_connections_google(kind TEXT PRIMARY KEY CHECK(kind IN('analysis','task','payment','sms','google')),sealed TEXT NOT NULL,updated_at TEXT NOT NULL);
INSERT INTO integration_connections_google SELECT kind,sealed,updated_at FROM integration_connections;
DROP TABLE integration_connections;
ALTER TABLE integration_connections_google RENAME TO integration_connections;
CREATE TABLE google_oauth_states(hash TEXT PRIMARY KEY,operator_id TEXT NOT NULL,workspace_id TEXT NOT NULL,sealed TEXT NOT NULL,expires_at TEXT NOT NULL);
CREATE TABLE google_sheet_links(
 id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL REFERENCES workspaces(id),flow_id TEXT NOT NULL UNIQUE REFERENCES flows(id),
 spreadsheet_id TEXT NOT NULL,tab TEXT NOT NULL,columns_json TEXT NOT NULL DEFAULT '[]',armed INTEGER NOT NULL DEFAULT 1 CHECK(armed IN(0,1)),updated_at TEXT NOT NULL,UNIQUE(spreadsheet_id,tab)
);
CREATE TABLE google_sheet_rows(
 id TEXT PRIMARY KEY,link_id TEXT NOT NULL REFERENCES google_sheet_links(id) ON DELETE CASCADE,
 response_id TEXT REFERENCES responses(id) ON DELETE SET NULL,generation INTEGER NOT NULL DEFAULT 1,
 state TEXT NOT NULL CHECK(state IN('pending','sending','confirmed','unknown','failed')),attempts INTEGER NOT NULL DEFAULT 0,
 available_at TEXT NOT NULL,started_at TEXT,reason TEXT,updated_at TEXT NOT NULL,UNIQUE(link_id,response_id)
);
CREATE INDEX google_sheet_rows_due ON google_sheet_rows(state,available_at);
CREATE TABLE google_sheet_attempts(id TEXT PRIMARY KEY,row_id TEXT NOT NULL REFERENCES google_sheet_rows(id) ON DELETE CASCADE,ordinal INTEGER NOT NULL,generation INTEGER NOT NULL,outcome TEXT NOT NULL,http_status INTEGER,reason TEXT,created_at TEXT NOT NULL);
CREATE TRIGGER google_sheet_response_insert AFTER INSERT ON responses WHEN NEW.state='released'
BEGIN
 INSERT OR IGNORE INTO google_sheet_rows(id,link_id,response_id,state,available_at,updated_at)
 SELECT lower(hex(randomblob(16))),id,NEW.id,'pending',NEW.updated_at,NEW.updated_at FROM google_sheet_links WHERE flow_id=NEW.flow_id AND armed=1;
END;
CREATE TRIGGER google_sheet_response_release AFTER UPDATE OF state ON responses WHEN NEW.state='released' AND OLD.state<>'released'
BEGIN
 INSERT OR IGNORE INTO google_sheet_rows(id,link_id,response_id,state,available_at,updated_at)
 SELECT lower(hex(randomblob(16))),id,NEW.id,'pending',NEW.updated_at,NEW.updated_at FROM google_sheet_links WHERE flow_id=NEW.flow_id AND armed=1;
END;
CREATE TRIGGER google_sheet_answer_insert AFTER INSERT ON response_answers
BEGIN UPDATE google_sheet_rows SET generation=generation+1,state='pending',available_at=NEW.updated_at,updated_at=NEW.updated_at,reason=NULL WHERE response_id=NEW.response_id; END;
CREATE TRIGGER google_sheet_answer_update AFTER UPDATE OF value_json ON response_answers
BEGIN UPDATE google_sheet_rows SET generation=generation+1,state='pending',available_at=NEW.updated_at,updated_at=NEW.updated_at,reason=NULL WHERE response_id=NEW.response_id; END;
CREATE TRIGGER google_sheet_response_delete BEFORE DELETE ON responses
BEGIN UPDATE google_sheet_rows SET response_id=NULL,generation=generation+1,state='pending',available_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),reason=NULL WHERE response_id=OLD.id; END;

CREATE TRIGGER google_sheet_answer_delete AFTER DELETE ON response_answers BEGIN UPDATE google_sheet_rows SET generation=generation+1,state='pending',available_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),reason=NULL WHERE response_id=OLD.response_id; END;
CREATE TRIGGER google_sheet_response_withhold AFTER UPDATE OF state ON responses WHEN OLD.state='released' AND NEW.state<>'released' BEGIN UPDATE google_sheet_rows SET generation=generation+1,state='pending',available_at=NEW.updated_at,updated_at=NEW.updated_at,reason=NULL WHERE response_id=NEW.id; END;

CREATE TRIGGER google_sheet_publication AFTER UPDATE OF state,is_current ON flow_revisions WHEN NEW.state='published' AND NEW.is_current=1 AND (OLD.state<>'published' OR OLD.is_current<>1) BEGIN UPDATE google_sheet_rows SET generation=generation+1,state='pending',available_at=NEW.updated_at,updated_at=NEW.updated_at,reason=NULL WHERE response_id IS NOT NULL AND link_id IN(SELECT id FROM google_sheet_links WHERE flow_id=NEW.flow_id AND armed=1); END;
CREATE INDEX google_sheet_rows_response ON google_sheet_rows(response_id);
CREATE INDEX google_sheet_attempts_row ON google_sheet_attempts(row_id,generation,ordinal);
CREATE INDEX google_oauth_states_expiry ON google_oauth_states(expires_at);
