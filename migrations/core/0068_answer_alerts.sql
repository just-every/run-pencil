CREATE TABLE answer_alert_evaluations(response_id TEXT PRIMARY KEY REFERENCES responses(id) ON DELETE CASCADE,created_at TEXT NOT NULL);
CREATE TABLE answer_alert_deliveries(
 id TEXT PRIMARY KEY,response_id TEXT NOT NULL REFERENCES responses(id) ON DELETE CASCADE,rule_id TEXT NOT NULL,rule_name TEXT NOT NULL,
 operator_id TEXT NOT NULL REFERENCES operators(id) ON DELETE CASCADE,status TEXT NOT NULL CHECK(status IN('pending','sending','sent','failed','unknown','cancelled')),
 idempotency_key TEXT NOT NULL UNIQUE,attempts INTEGER NOT NULL DEFAULT 0,first_attempt_at TEXT,last_attempt_at TEXT,available_at TEXT NOT NULL,
 reason TEXT,read_at TEXT,armed INTEGER NOT NULL DEFAULT 1 CHECK(armed IN(0,1)),created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(response_id,rule_id,operator_id)
);
CREATE INDEX answer_alert_due ON answer_alert_deliveries(status,available_at);
CREATE TABLE answer_alert_attempts(id TEXT PRIMARY KEY,delivery_id TEXT NOT NULL REFERENCES answer_alert_deliveries(id) ON DELETE CASCADE,ordinal INTEGER NOT NULL,event TEXT NOT NULL,provider TEXT,provider_code TEXT,created_at TEXT NOT NULL,UNIQUE(delivery_id,ordinal,event));

CREATE TRIGGER answer_alert_local_mail_erasure BEFORE DELETE ON answer_alert_deliveries BEGIN DELETE FROM rer_mail_development_outbox WHERE json_extract(message,'$.deliveryId')=OLD.idempotency_key; END;
