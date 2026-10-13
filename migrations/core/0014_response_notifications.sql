-- Existing and restored response work is ineligible for new outbound effects.
ALTER TABLE responses ADD COLUMN notification_eligible INTEGER NOT NULL DEFAULT 0 CHECK(notification_eligible IN (0,1));
ALTER TABLE response_outbox ADD COLUMN notification_eligible INTEGER NOT NULL DEFAULT 0 CHECK(notification_eligible IN (0,1));
CREATE TABLE notification_preferences (
  flow_id TEXT NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  operator_id TEXT NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK(mode IN ('immediately','off')),
  failure_reason TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(flow_id,operator_id)
);
CREATE TABLE notification_deliveries (
  id TEXT PRIMARY KEY,
  response_id TEXT NOT NULL REFERENCES responses(id) ON DELETE CASCADE,
  operator_id TEXT NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK(status IN ('pending','sending','sent','failed','unknown','cancelled')),
  idempotency_key TEXT NOT NULL UNIQUE,
  attempts INTEGER NOT NULL DEFAULT 0,
  explicit_retry_authorized INTEGER NOT NULL DEFAULT 0 CHECK(explicit_retry_authorized IN (0,1)),
  first_attempt_at TEXT,
  last_attempt_at TEXT,
  available_at TEXT NOT NULL,
  reason TEXT,
  provider_id TEXT,
  provider TEXT,
  provider_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(response_id,operator_id)
);
CREATE INDEX notification_deliveries_due ON notification_deliveries(status,available_at);
CREATE TABLE notification_attempts (
  id TEXT PRIMARY KEY,
  delivery_id TEXT NOT NULL REFERENCES notification_deliveries(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL,
  event TEXT NOT NULL,
  provider TEXT,
  provider_code TEXT,
  created_at TEXT NOT NULL
);
-- Response erasure removes unsent work and receipts without retaining response identifiers.
CREATE TRIGGER erase_response_notifications BEFORE DELETE ON responses BEGIN
  DELETE FROM rer_mail_development_outbox WHERE json_extract(message,'$.deliveryId') IN
    (SELECT idempotency_key FROM notification_deliveries WHERE response_id=OLD.id);
  DELETE FROM notification_deliveries WHERE response_id=OLD.id;
END;
