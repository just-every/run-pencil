-- Additive feedback state. Existing migration bytes and notification preferences stay intact.
CREATE TABLE draft_rewrites (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 flow_id TEXT NOT NULL REFERENCES flows(id) ON DELETE CASCADE, draft_id TEXT NOT NULL REFERENCES flow_revisions(id) ON DELETE CASCADE,
 step_id TEXT NOT NULL, operator_id TEXT NOT NULL REFERENCES operators(id), draft_version INTEGER NOT NULL,
 source TEXT NOT NULL, style TEXT NOT NULL, context TEXT NOT NULL, proposal TEXT,
 decision_token TEXT, state TEXT NOT NULL CHECK(state IN ('requested','ready','failed','accepted','rejected')), error TEXT,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE draft_ai_calls (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 draft_id TEXT NOT NULL REFERENCES flow_revisions(id) ON DELETE CASCADE, rewrite_id TEXT NOT NULL REFERENCES draft_rewrites(id) ON DELETE CASCADE,
 feature TEXT NOT NULL, provider TEXT NOT NULL, provider_origin TEXT NOT NULL, model TEXT NOT NULL,
 outcome TEXT NOT NULL, error_code TEXT, input_tokens INTEGER, output_tokens INTEGER, cost_microusd INTEGER,
 cost_source TEXT NOT NULL, receipt_id TEXT, created_at TEXT NOT NULL
);
CREATE TABLE analysis_attention_preferences (
 operator_id TEXT PRIMARY KEY REFERENCES operators(id) ON DELETE CASCADE, muted INTEGER NOT NULL DEFAULT 0 CHECK(muted IN (0,1))
);
CREATE TABLE analysis_attention (
 run_id TEXT NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
 operator_id TEXT NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
 created_at TEXT NOT NULL, read_at TEXT, PRIMARY KEY(run_id,operator_id)
);
-- Fanout commits with every terminal outcome, including interruption/provider-off and insufficient evidence.
-- Same-run retries retain one record. The view always joins the current run outcome.
CREATE TRIGGER analysis_terminal_attention AFTER UPDATE OF state ON analysis_runs
WHEN NEW.state IN ('completed','insufficient_evidence','failed') BEGIN
 INSERT OR IGNORE INTO analysis_attention(run_id,operator_id,created_at)
 SELECT NEW.id,o.id,NEW.updated_at FROM operators o
 WHERE o.workspace_id=NEW.workspace_id
 AND NOT EXISTS(SELECT 1 FROM operator_auth_links l JOIN oa_operators a ON a.id=l.auth_id WHERE l.operator_id=o.id AND a.status='inactive')
 AND ((NEW.trigger='operator' AND o.id=NEW.requested_by_operator_id) OR (NEW.trigger='autorun' AND NOT EXISTS(SELECT 1 FROM analysis_attention_preferences p WHERE p.operator_id=o.id AND p.muted=1)));
END;
-- A separate daily setting avoids rewriting the released Immediately/Off CHECK constraint.
CREATE TABLE digest_preferences (
 flow_id TEXT NOT NULL REFERENCES flows(id) ON DELETE CASCADE, operator_id TEXT NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
 epoch TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)), cutoff TEXT NOT NULL, next_opening TEXT NOT NULL,
 next_day TEXT NOT NULL, zone TEXT NOT NULL, window_start TEXT NOT NULL, failure_reason TEXT,
 PRIMARY KEY(flow_id,operator_id)
);
CREATE TABLE digest_deliveries (
 id TEXT PRIMARY KEY, flow_id TEXT NOT NULL REFERENCES flows(id) ON DELETE CASCADE, operator_id TEXT NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
 day TEXT NOT NULL, zone TEXT NOT NULL, epoch TEXT NOT NULL, cutoff_start TEXT NOT NULL, cutoff_end TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('pending','sending','sent','failed','unknown','cancelled','empty')),
 idempotency_key TEXT NOT NULL UNIQUE, attempts INTEGER NOT NULL DEFAULT 0, retry_count INTEGER NOT NULL DEFAULT 0, retry_authorized INTEGER NOT NULL DEFAULT 0,
 replay_enabled INTEGER NOT NULL DEFAULT 1, first_attempt_at TEXT, last_attempt_at TEXT, available_at TEXT NOT NULL,
 reason TEXT, provider_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 UNIQUE(flow_id,operator_id,day)
);
CREATE INDEX digest_due ON digest_deliveries(status,available_at);
CREATE TABLE digest_members (
 delivery_id TEXT NOT NULL REFERENCES digest_deliveries(id) ON DELETE CASCADE,
 response_id TEXT NOT NULL REFERENCES responses(id) ON DELETE CASCADE, PRIMARY KEY(delivery_id,response_id)
);
CREATE TABLE digest_attempts (
 id TEXT PRIMARY KEY, delivery_id TEXT NOT NULL REFERENCES digest_deliveries(id) ON DELETE CASCADE,
 ordinal INTEGER NOT NULL, event TEXT NOT NULL, provider TEXT, provider_code TEXT, created_at TEXT NOT NULL,
 UNIQUE(delivery_id,ordinal,event)
);
-- An erased member may have appeared in captured aggregate mail; remove that capture too.
CREATE TRIGGER erase_digest_capture BEFORE DELETE ON responses BEGIN
 DELETE FROM rer_mail_development_outbox WHERE json_extract(message,'$.deliveryId') IN
 (SELECT d.idempotency_key FROM digest_deliveries d JOIN digest_members m ON m.delivery_id=d.id WHERE m.response_id=OLD.id);
END;

CREATE INDEX analysis_calls_workspace_time ON analysis_calls(workspace_id,created_at);
CREATE INDEX draft_ai_calls_workspace_time ON draft_ai_calls(workspace_id,created_at);

CREATE INDEX digest_members_response ON digest_members(response_id,delivery_id);
