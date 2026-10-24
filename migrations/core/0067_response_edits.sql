-- RESP-021: retain immutable answer versions; live capabilities never travel in archives.
CREATE TABLE response_versions(response_id TEXT NOT NULL REFERENCES responses(id) ON DELETE CASCADE,number INTEGER NOT NULL,answers_json TEXT NOT NULL,context_json TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(response_id,number));
CREATE TABLE response_edit_links(hash TEXT PRIMARY KEY,response_id TEXT NOT NULL REFERENCES responses(id) ON DELETE CASCADE,version INTEGER NOT NULL,expires_at TEXT NOT NULL,used_claim TEXT,created_at TEXT NOT NULL);
CREATE INDEX response_edit_links_response ON response_edit_links(response_id);
CREATE TABLE saved_response_event_deliveries AS SELECT * FROM response_event_deliveries;
CREATE TABLE saved_response_event_attempts AS SELECT * FROM response_event_attempts;
DROP TRIGGER response_event_created;
DROP TRIGGER response_event_released;
DROP TRIGGER response_event_erased_before;
DROP TRIGGER response_event_deleted;
DROP TRIGGER response_event_payment;
DROP TRIGGER response_event_partial_saved;
DROP TRIGGER response_event_partial_resaved;
DROP TABLE response_event_attempts;
DROP TABLE response_event_deliveries;
CREATE TABLE response_event_deliveries (
 id TEXT PRIMARY KEY,
 endpoint_id TEXT NOT NULL REFERENCES response_webhook_endpoints(id) ON DELETE CASCADE,
 event_id TEXT NOT NULL,
 event_type TEXT NOT NULL CHECK(event_type IN ('response.created','response.updated','response.deleted','response.partial_saved','payment.changed','webhook.test')),
 workspace_id TEXT NOT NULL,
 flow_id TEXT,
 revision_id TEXT,
 response_id TEXT,
 detail TEXT,
 occurred_at TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('pending','sending','confirmed','failed','cancelled')),
 attempts INTEGER NOT NULL DEFAULT 0,
 first_attempt_at TEXT,
 last_attempt_at TEXT,
 available_at TEXT NOT NULL,
 reason TEXT,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 UNIQUE(endpoint_id, event_id)
);
CREATE INDEX response_event_deliveries_due ON response_event_deliveries(status, available_at);
CREATE INDEX response_event_deliveries_endpoint ON response_event_deliveries(endpoint_id, created_at);
CREATE INDEX response_event_deliveries_response ON response_event_deliveries(response_id) WHERE response_id IS NOT NULL;
CREATE TABLE response_event_attempts (
 id TEXT PRIMARY KEY,
 delivery_id TEXT NOT NULL REFERENCES response_event_deliveries(id) ON DELETE CASCADE,
 ordinal INTEGER NOT NULL,
 event TEXT NOT NULL CHECK(event IN ('started','confirmed','failed','abandoned','replay')),
 http_status INTEGER,
 outcome_class TEXT,
 reason TEXT,
 created_at TEXT NOT NULL,
 UNIQUE(delivery_id, ordinal, event)
);

INSERT INTO response_event_deliveries SELECT * FROM saved_response_event_deliveries;
INSERT INTO response_event_attempts SELECT * FROM saved_response_event_attempts;
DROP TABLE saved_response_event_attempts;
DROP TABLE saved_response_event_deliveries;
-- Events are recorded by the same transaction that changes the response, so a failing receiver never blocks collection.
-- An active or disabled endpoint queues them (a disabled one holds them until the owner resumes it); a paused one does not.
CREATE TRIGGER response_event_created AFTER INSERT ON responses WHEN NEW.state = 'released' AND NEW.source <> 'imported' BEGIN
 INSERT INTO response_event_deliveries (id, endpoint_id, event_id, event_type, workspace_id, flow_id, revision_id, response_id, detail, occurred_at, status, attempts, available_at, created_at, updated_at)
 SELECT lower(hex(randomblob(16))), e.id, 'evt_' || lower(hex(randomblob(12))), 'response.created', NEW.workspace_id, NEW.flow_id, NEW.revision_id, NEW.id, NULL,
  strftime('%Y-%m-%dT%H:%M:%fZ','now'), 'pending', 0, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')
 FROM response_webhook_endpoints e WHERE e.state IN ('active','disabled') AND e.sealed_secret IS NOT NULL AND e.workspace_id = NEW.workspace_id AND (e.flow_id IS NULL OR e.flow_id = NEW.flow_id);
END;
-- A quarantined response is announced only when an operator releases it.
CREATE TRIGGER response_event_released AFTER UPDATE OF state ON responses WHEN OLD.state = 'quarantined' AND NEW.state = 'released' AND NEW.source <> 'imported' BEGIN
 INSERT INTO response_event_deliveries (id, endpoint_id, event_id, event_type, workspace_id, flow_id, revision_id, response_id, detail, occurred_at, status, attempts, available_at, created_at, updated_at)
 SELECT lower(hex(randomblob(16))), e.id, 'evt_' || lower(hex(randomblob(12))), 'response.created', NEW.workspace_id, NEW.flow_id, NEW.revision_id, NEW.id, NULL,
  strftime('%Y-%m-%dT%H:%M:%fZ','now'), 'pending', 0, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')
 FROM response_webhook_endpoints e WHERE e.state IN ('active','disabled') AND e.sealed_secret IS NOT NULL AND e.workspace_id = NEW.workspace_id AND (e.flow_id IS NULL OR e.flow_id = NEW.flow_id);
END;
-- Erasure (DATA-002, retention, contact erasure) removes the response's earlier deliveries and queues one deletion notice.
CREATE TRIGGER response_event_erased_before BEFORE DELETE ON responses BEGIN
 DELETE FROM response_event_deliveries WHERE response_id = OLD.id AND event_type <> 'response.deleted';
END;
CREATE TRIGGER response_event_deleted AFTER DELETE ON responses WHEN OLD.state = 'released' AND OLD.source <> 'imported' BEGIN
 INSERT INTO response_event_deliveries (id, endpoint_id, event_id, event_type, workspace_id, flow_id, revision_id, response_id, detail, occurred_at, status, attempts, available_at, created_at, updated_at)
 SELECT lower(hex(randomblob(16))), e.id, 'evt_' || lower(hex(randomblob(12))), 'response.deleted', OLD.workspace_id, OLD.flow_id, OLD.revision_id, OLD.id, NULL,
  strftime('%Y-%m-%dT%H:%M:%fZ','now'), 'pending', 0, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')
 FROM response_webhook_endpoints e WHERE e.state IN ('active','disabled') AND e.sealed_secret IS NOT NULL AND e.workspace_id = OLD.workspace_id AND (e.flow_id IS NULL OR e.flow_id = OLD.flow_id);
END;
CREATE TRIGGER response_event_payment AFTER UPDATE OF state ON response_payments WHEN OLD.state <> NEW.state BEGIN
 INSERT INTO response_event_deliveries (id, endpoint_id, event_id, event_type, workspace_id, flow_id, revision_id, response_id, detail, occurred_at, status, attempts, available_at, created_at, updated_at)
 SELECT lower(hex(randomblob(16))), e.id, 'evt_' || lower(hex(randomblob(12))), 'payment.changed', r.workspace_id, r.flow_id, r.revision_id, r.id, NEW.state,
  strftime('%Y-%m-%dT%H:%M:%fZ','now'), 'pending', 0, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')
 FROM responses r JOIN response_webhook_endpoints e ON e.workspace_id = r.workspace_id AND (e.flow_id IS NULL OR e.flow_id = r.flow_id)
 WHERE r.id = NEW.response_id AND e.state IN ('active','disabled') AND e.sealed_secret IS NOT NULL;
END;
-- PART-002: an explicit save records a partial; it carries no response, answers or address.
CREATE TRIGGER response_event_partial_saved AFTER INSERT ON respondent_saves BEGIN
 INSERT INTO response_event_deliveries (id, endpoint_id, event_id, event_type, workspace_id, flow_id, revision_id, response_id, detail, occurred_at, status, attempts, available_at, created_at, updated_at)
 SELECT lower(hex(randomblob(16))), e.id, 'evt_' || lower(hex(randomblob(12))), 'response.partial_saved', f.workspace_id, f.id, NEW.revision_id, NULL, NULL,
  strftime('%Y-%m-%dT%H:%M:%fZ','now'), 'pending', 0, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')
 FROM flow_revisions v JOIN flows f ON f.id = v.flow_id JOIN response_webhook_endpoints e ON e.workspace_id = f.workspace_id AND (e.flow_id IS NULL OR e.flow_id = f.id)
 WHERE v.id = NEW.revision_id AND e.state IN ('active','disabled') AND e.sealed_secret IS NOT NULL;
END;
CREATE TRIGGER response_event_partial_resaved AFTER UPDATE OF command_key ON respondent_saves WHEN NEW.command_key <> OLD.command_key AND NEW.delivery_state = 'sending' BEGIN
 INSERT INTO response_event_deliveries (id, endpoint_id, event_id, event_type, workspace_id, flow_id, revision_id, response_id, detail, occurred_at, status, attempts, available_at, created_at, updated_at)
 SELECT lower(hex(randomblob(16))), e.id, 'evt_' || lower(hex(randomblob(12))), 'response.partial_saved', f.workspace_id, f.id, NEW.revision_id, NULL, NULL,
  strftime('%Y-%m-%dT%H:%M:%fZ','now'), 'pending', 0, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')
 FROM flow_revisions v JOIN flows f ON f.id = v.flow_id JOIN response_webhook_endpoints e ON e.workspace_id = f.workspace_id AND (e.flow_id IS NULL OR e.flow_id = f.id)
 WHERE v.id = NEW.revision_id AND e.state IN ('active','disabled') AND e.sealed_secret IS NOT NULL;
END;

CREATE TRIGGER response_event_updated AFTER INSERT ON response_versions WHEN NEW.number>1 BEGIN
 INSERT INTO response_event_deliveries(id,endpoint_id,event_id,event_type,workspace_id,flow_id,revision_id,response_id,occurred_at,status,available_at,created_at,updated_at)
 SELECT lower(hex(randomblob(16))),e.id,'evt_'||lower(hex(randomblob(12))),'response.updated',r.workspace_id,r.flow_id,r.revision_id,r.id,NEW.created_at,'pending',NEW.created_at,NEW.created_at,NEW.created_at
 FROM responses r JOIN response_webhook_endpoints e ON e.workspace_id=r.workspace_id AND (e.flow_id IS NULL OR e.flow_id=r.flow_id) WHERE r.id=NEW.response_id AND e.state IN('active','disabled') AND e.sealed_secret IS NOT NULL;
END;
