-- Payment ledger, subscription metadata and delayed settlement; preserves every existing payment.
DROP TRIGGER erase_response_payment;
DROP TRIGGER collector_response_owner_insert;
CREATE TABLE response_payments_next (
 response_id TEXT PRIMARY KEY NOT NULL REFERENCES responses(id), step_id TEXT NOT NULL, completion_step_id TEXT NOT NULL,
 provider TEXT NOT NULL CHECK(provider = 'stripe'), livemode INTEGER NOT NULL CHECK(livemode IN (0,1)),
 state TEXT NOT NULL CHECK(state IN ('pending','processing','paid','failed','expired','cancelled','partially_refunded','refunded')),
 attempt INTEGER NOT NULL CHECK(attempt >= 1), amount INTEGER NOT NULL CHECK(amount > 0), currency TEXT NOT NULL CHECK(currency = 'usd'),
 lines_json TEXT NOT NULL, checkout_session_id TEXT UNIQUE, checkout_url TEXT, checkout_expires_at TEXT, payment_intent_id TEXT,
 provider_amount INTEGER, return_token_hash TEXT UNIQUE, state_changed_at TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 checkout_settings_json TEXT NOT NULL DEFAULT '{}', discount INTEGER CHECK(discount >= 0), tax INTEGER CHECK(tax >= 0), total INTEGER CHECK(total >= 0),
 refunded_amount INTEGER NOT NULL DEFAULT 0 CHECK(refunded_amount >= 0), refund_requested INTEGER NOT NULL DEFAULT 0 CHECK(refund_requested >= 0),
 method_type TEXT, method_last4 TEXT CHECK(method_last4 IS NULL OR (length(method_last4) = 4 AND method_last4 NOT GLOB '*[^0-9]*')),
 subscription_id TEXT, subscription_status TEXT, subscription_event_at INTEGER NOT NULL DEFAULT 0
);
INSERT INTO response_payments_next (response_id,step_id,completion_step_id,provider,livemode,state,attempt,amount,currency,lines_json,checkout_session_id,checkout_url,checkout_expires_at,payment_intent_id,provider_amount,return_token_hash,state_changed_at,created_at,updated_at,checkout_settings_json,discount,tax,total)
 SELECT response_id,step_id,completion_step_id,provider,livemode,state,attempt,amount,currency,lines_json,checkout_session_id,checkout_url,checkout_expires_at,payment_intent_id,provider_amount,return_token_hash,state_changed_at,created_at,updated_at,checkout_settings_json,discount,tax,total FROM response_payments;
DROP TABLE response_payments;
ALTER TABLE response_payments_next RENAME TO response_payments;
CREATE INDEX response_payments_intent ON response_payments(payment_intent_id) WHERE payment_intent_id IS NOT NULL;
CREATE INDEX response_payments_subscription ON response_payments(subscription_id) WHERE subscription_id IS NOT NULL;

CREATE TABLE payment_movements (
 id TEXT PRIMARY KEY NOT NULL,
 response_id TEXT NOT NULL REFERENCES responses(id),
 amount INTEGER NOT NULL,
 occurred_at TEXT NOT NULL
);
CREATE INDEX payment_movements_period ON payment_movements(occurred_at);
-- Historical payments retain their recorded last-change date; Stripe reporting verifies earlier periods.
INSERT INTO payment_movements(id,response_id,amount,occurred_at)
 SELECT 'capture:'||response_id,response_id,COALESCE(total,provider_amount,amount),state_changed_at FROM response_payments WHERE state IN ('paid','refunded');
INSERT INTO payment_movements(id,response_id,amount,occurred_at)
 SELECT 'refund:'||response_id,response_id,-COALESCE(total,provider_amount,amount),state_changed_at FROM response_payments WHERE state='refunded';
UPDATE response_payments SET refunded_amount=COALESCE(total,provider_amount,amount) WHERE state='refunded';

CREATE TRIGGER erase_response_payment BEFORE DELETE ON responses BEGIN
 DELETE FROM payment_movements WHERE response_id=OLD.id;
 DELETE FROM response_payments WHERE response_id=OLD.id;
 UPDATE payment_events SET response_id=NULL WHERE response_id=OLD.id;
END;

CREATE TRIGGER collector_response_owner_insert BEFORE INSERT ON response_collector BEGIN
 SELECT RAISE(ABORT,'COLLECTOR_RESPONSE_OWNERSHIP') WHERE NOT EXISTS(
 SELECT 1 FROM responses r JOIN collectors c ON c.flow_id=r.flow_id JOIN flows f ON f.id=r.flow_id
 WHERE r.id=NEW.response_id AND c.id=NEW.collector_id AND f.workspace_id=r.workspace_id
 AND (c.system_source IS NULL OR c.system_source=r.source));
 SELECT RAISE(ABORT,'COLLECTOR_CLOSED') WHERE EXISTS(
 SELECT 1 FROM collectors c JOIN responses r ON r.id=NEW.response_id WHERE c.id=NEW.collector_id
 AND (c.closed_at IS NOT NULL OR (c.deadline_at IS NOT NULL AND c.deadline_at<=r.completed_at)
 OR (c.response_limit IS NOT NULL AND (SELECT count(*) FROM response_collector held WHERE held.collector_id=c.id
 AND NOT EXISTS (SELECT 1 FROM response_payments unpaid WHERE unpaid.response_id=held.response_id AND unpaid.state!='paid'))>=c.response_limit)));
END;
