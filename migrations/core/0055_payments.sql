-- PAY-001: payment steps, the owner's Stripe connection and each response's payment state.
-- Existing rows, stable IDs and import custody are unchanged; nothing here holds card or bank numbers.
-- Suspend and restore the existing triggers while widening the two constrained tables, as 0040 did.
DROP TRIGGER "form_import_epoch_choice_options_delete";
DROP TRIGGER "form_import_epoch_choice_options_insert";
DROP TRIGGER "form_import_epoch_choice_options_update";
DROP TRIGGER "form_import_epoch_flow_steps_delete";
DROP TRIGGER "form_import_epoch_flow_steps_insert";
DROP TRIGGER "form_import_epoch_flow_steps_update";
DROP TRIGGER "reporting_choice_options_delete";
DROP TRIGGER "reporting_choice_options_insert";
DROP TRIGGER "reporting_choice_options_update";
DROP TRIGGER "reporting_flow_steps_delete";
DROP TRIGGER "reporting_flow_steps_insert";
DROP TRIGGER "reporting_flow_steps_update";
DROP TRIGGER "response_answer_search_insert";
DROP TRIGGER "response_answer_search_update";

-- D1 migrations run in a transaction with foreign keys enabled. Copy the parent and its only
-- foreign-key child, then drop the old child before its parent. Answers, sessions and branch
-- rules use stable step IDs and are not rebuilt.
CREATE TABLE flow_steps_expanded (
  id TEXT PRIMARY KEY NOT NULL,
  revision_id TEXT NOT NULL REFERENCES flow_revisions(id),
  position INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('welcome', 'question', 'payment', 'completion')),
  question_type TEXT CHECK(question_type IN ('short_text', 'long_text', 'email', 'single_choice', 'multiple_choice', 'rating', 'priority', 'dropdown', 'yes_no', 'nps', 'number', 'date', 'consent', 'csat', 'ces', 'emoji_rating', 'thumbs_rating', 'phone', 'postal_address', 'full_name', 'url', 'currency')),
  prompt TEXT NOT NULL,
  helper_text TEXT,
  required INTEGER NOT NULL CHECK(required IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  stable_id TEXT,
  next_step_stable_id TEXT,
  question_settings_json TEXT,
  UNIQUE(revision_id, position)
);
INSERT INTO flow_steps_expanded (
  id, revision_id, position, kind, question_type, prompt, helper_text, required,
  created_at, updated_at, stable_id, next_step_stable_id, question_settings_json
)
SELECT id, revision_id, position, kind, question_type, prompt, helper_text, required,
  created_at, updated_at, stable_id, next_step_stable_id, question_settings_json
FROM flow_steps;

CREATE TABLE choice_options_expanded (
  id TEXT PRIMARY KEY NOT NULL,
  step_id TEXT NOT NULL REFERENCES flow_steps_expanded(id),
  value TEXT NOT NULL,
  label TEXT NOT NULL,
  position INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  stable_id TEXT,
  UNIQUE(step_id, value),
  UNIQUE(step_id, position)
);
INSERT INTO choice_options_expanded (
  id, step_id, value, label, position, created_at, updated_at, stable_id
)
SELECT id, step_id, value, label, position, created_at, updated_at, stable_id
FROM choice_options;

DROP TABLE choice_options;
DROP TABLE flow_steps;
-- SQLite updates choice_options_expanded's FK when its new parent is renamed.
ALTER TABLE flow_steps_expanded RENAME TO flow_steps;
ALTER TABLE choice_options_expanded RENAME TO choice_options;
CREATE INDEX flow_steps_revision_id ON flow_steps(revision_id);
CREATE UNIQUE INDEX flow_steps_revision_stable_id_unique ON flow_steps(revision_id, stable_id);
CREATE UNIQUE INDEX choice_options_step_stable_id_unique ON choice_options(step_id, stable_id);

CREATE TRIGGER form_import_epoch_choice_options_delete BEFORE DELETE ON choice_options BEGIN SELECT RAISE(ABORT,'IMPORT_NATIVE_PUBLICATION_CHANGED') WHERE EXISTS(SELECT 1 FROM form_import_native_publication_fences WHERE target_id IN (SELECT v.flow_id AS target_id FROM flow_steps s JOIN flow_revisions v ON v.id=s.revision_id WHERE s.id=OLD.step_id)); UPDATE form_import_native_clock SET revision=revision+1 WHERE id=1 AND EXISTS(SELECT target_id FROM (SELECT v.flow_id AS target_id FROM flow_steps s JOIN flow_revisions v ON v.id=s.revision_id WHERE s.id=OLD.step_id) WHERE target_id IN (SELECT target_id FROM form_import_targets)); INSERT INTO form_import_native_epochs(target_id,revision) SELECT target_id,(SELECT revision FROM form_import_native_clock WHERE id=1) FROM (SELECT target_id FROM (SELECT v.flow_id AS target_id FROM flow_steps s JOIN flow_revisions v ON v.id=s.revision_id WHERE s.id=OLD.step_id) WHERE target_id IN (SELECT target_id FROM form_import_targets)) WHERE 1 ON CONFLICT(target_id) DO UPDATE SET revision=excluded.revision; END;

CREATE TRIGGER form_import_epoch_choice_options_insert BEFORE INSERT ON choice_options BEGIN SELECT RAISE(ABORT,'IMPORT_NATIVE_PUBLICATION_CHANGED') WHERE EXISTS(SELECT 1 FROM form_import_native_publication_fences WHERE target_id IN (SELECT v.flow_id AS target_id FROM flow_steps s JOIN flow_revisions v ON v.id=s.revision_id WHERE s.id=NEW.step_id)); UPDATE form_import_native_clock SET revision=revision+1 WHERE id=1 AND EXISTS(SELECT target_id FROM (SELECT v.flow_id AS target_id FROM flow_steps s JOIN flow_revisions v ON v.id=s.revision_id WHERE s.id=NEW.step_id) WHERE target_id IN (SELECT target_id FROM form_import_targets)); INSERT INTO form_import_native_epochs(target_id,revision) SELECT target_id,(SELECT revision FROM form_import_native_clock WHERE id=1) FROM (SELECT target_id FROM (SELECT v.flow_id AS target_id FROM flow_steps s JOIN flow_revisions v ON v.id=s.revision_id WHERE s.id=NEW.step_id) WHERE target_id IN (SELECT target_id FROM form_import_targets)) WHERE 1 ON CONFLICT(target_id) DO UPDATE SET revision=excluded.revision; END;

CREATE TRIGGER form_import_epoch_choice_options_update BEFORE UPDATE ON choice_options BEGIN SELECT RAISE(ABORT,'IMPORT_NATIVE_PUBLICATION_CHANGED') WHERE EXISTS(SELECT 1 FROM form_import_native_publication_fences WHERE target_id IN (SELECT v.flow_id AS target_id FROM flow_steps s JOIN flow_revisions v ON v.id=s.revision_id WHERE s.id=OLD.step_id UNION SELECT v.flow_id AS target_id FROM flow_steps s JOIN flow_revisions v ON v.id=s.revision_id WHERE s.id=NEW.step_id)); UPDATE form_import_native_clock SET revision=revision+1 WHERE id=1 AND EXISTS(SELECT target_id FROM (SELECT v.flow_id AS target_id FROM flow_steps s JOIN flow_revisions v ON v.id=s.revision_id WHERE s.id=OLD.step_id UNION SELECT v.flow_id AS target_id FROM flow_steps s JOIN flow_revisions v ON v.id=s.revision_id WHERE s.id=NEW.step_id) WHERE target_id IN (SELECT target_id FROM form_import_targets)); INSERT INTO form_import_native_epochs(target_id,revision) SELECT target_id,(SELECT revision FROM form_import_native_clock WHERE id=1) FROM (SELECT target_id FROM (SELECT v.flow_id AS target_id FROM flow_steps s JOIN flow_revisions v ON v.id=s.revision_id WHERE s.id=OLD.step_id UNION SELECT v.flow_id AS target_id FROM flow_steps s JOIN flow_revisions v ON v.id=s.revision_id WHERE s.id=NEW.step_id) WHERE target_id IN (SELECT target_id FROM form_import_targets)) WHERE 1 ON CONFLICT(target_id) DO UPDATE SET revision=excluded.revision; END;

CREATE TRIGGER form_import_epoch_flow_steps_delete BEFORE DELETE ON flow_steps BEGIN SELECT RAISE(ABORT,'IMPORT_NATIVE_PUBLICATION_CHANGED') WHERE EXISTS(SELECT 1 FROM form_import_native_publication_fences WHERE target_id IN (SELECT flow_id AS target_id FROM flow_revisions WHERE id=OLD.revision_id)); UPDATE form_import_native_clock SET revision=revision+1 WHERE id=1 AND EXISTS(SELECT target_id FROM (SELECT flow_id AS target_id FROM flow_revisions WHERE id=OLD.revision_id) WHERE target_id IN (SELECT target_id FROM form_import_targets)); INSERT INTO form_import_native_epochs(target_id,revision) SELECT target_id,(SELECT revision FROM form_import_native_clock WHERE id=1) FROM (SELECT target_id FROM (SELECT flow_id AS target_id FROM flow_revisions WHERE id=OLD.revision_id) WHERE target_id IN (SELECT target_id FROM form_import_targets)) WHERE 1 ON CONFLICT(target_id) DO UPDATE SET revision=excluded.revision; END;

CREATE TRIGGER form_import_epoch_flow_steps_insert BEFORE INSERT ON flow_steps BEGIN SELECT RAISE(ABORT,'IMPORT_NATIVE_PUBLICATION_CHANGED') WHERE EXISTS(SELECT 1 FROM form_import_native_publication_fences WHERE target_id IN (SELECT flow_id AS target_id FROM flow_revisions WHERE id=NEW.revision_id)); UPDATE form_import_native_clock SET revision=revision+1 WHERE id=1 AND EXISTS(SELECT target_id FROM (SELECT flow_id AS target_id FROM flow_revisions WHERE id=NEW.revision_id) WHERE target_id IN (SELECT target_id FROM form_import_targets)); INSERT INTO form_import_native_epochs(target_id,revision) SELECT target_id,(SELECT revision FROM form_import_native_clock WHERE id=1) FROM (SELECT target_id FROM (SELECT flow_id AS target_id FROM flow_revisions WHERE id=NEW.revision_id) WHERE target_id IN (SELECT target_id FROM form_import_targets)) WHERE 1 ON CONFLICT(target_id) DO UPDATE SET revision=excluded.revision; END;

CREATE TRIGGER form_import_epoch_flow_steps_update BEFORE UPDATE ON flow_steps BEGIN SELECT RAISE(ABORT,'IMPORT_NATIVE_PUBLICATION_CHANGED') WHERE EXISTS(SELECT 1 FROM form_import_native_publication_fences WHERE target_id IN (SELECT flow_id AS target_id FROM flow_revisions WHERE id=OLD.revision_id UNION SELECT flow_id AS target_id FROM flow_revisions WHERE id=NEW.revision_id)); UPDATE form_import_native_clock SET revision=revision+1 WHERE id=1 AND EXISTS(SELECT target_id FROM (SELECT flow_id AS target_id FROM flow_revisions WHERE id=OLD.revision_id UNION SELECT flow_id AS target_id FROM flow_revisions WHERE id=NEW.revision_id) WHERE target_id IN (SELECT target_id FROM form_import_targets)); INSERT INTO form_import_native_epochs(target_id,revision) SELECT target_id,(SELECT revision FROM form_import_native_clock WHERE id=1) FROM (SELECT target_id FROM (SELECT flow_id AS target_id FROM flow_revisions WHERE id=OLD.revision_id UNION SELECT flow_id AS target_id FROM flow_revisions WHERE id=NEW.revision_id) WHERE target_id IN (SELECT target_id FROM form_import_targets)) WHERE 1 ON CONFLICT(target_id) DO UPDATE SET revision=excluded.revision; END;

CREATE TRIGGER reporting_choice_options_delete BEFORE DELETE ON choice_options BEGIN
 UPDATE reporting_generations SET generation = generation + 1 WHERE workspace_id IN (SELECT workspace_id FROM (SELECT r.workspace_id,r.flow_id, CASE WHEN r.source = 'imported' THEN max(r.completed_at,r.released_at,t.committed_at) ELSE max(r.completed_at,r.released_at) END AS eligible_at FROM responses r LEFT JOIN form_import_targets t ON t.target_id = r.id AND t.kind = 'response' AND t.workspace_id = r.workspace_id WHERE r.state = 'released' AND r.released_at IS NOT NULL AND (r.source != 'imported' OR t.committed_at IS NOT NULL) AND r.revision_id IN (SELECT revision_id FROM flow_steps WHERE id = OLD.step_id)));
 INSERT INTO reporting_changes(workspace_id,flow_id,eligible_at,generation)
 SELECT changed.workspace_id,changed.flow_id,changed.eligible_at,g.generation FROM (SELECT r.workspace_id,r.flow_id, CASE WHEN r.source = 'imported' THEN max(r.completed_at,r.released_at,t.committed_at) ELSE max(r.completed_at,r.released_at) END AS eligible_at FROM responses r LEFT JOIN form_import_targets t ON t.target_id = r.id AND t.kind = 'response' AND t.workspace_id = r.workspace_id WHERE r.state = 'released' AND r.released_at IS NOT NULL AND (r.source != 'imported' OR t.committed_at IS NOT NULL) AND r.revision_id IN (SELECT revision_id FROM flow_steps WHERE id = OLD.step_id)) changed
 JOIN reporting_generations g ON g.workspace_id = changed.workspace_id WHERE changed.eligible_at IS NOT NULL
 ON CONFLICT(workspace_id,flow_id,eligible_at) DO UPDATE SET generation = excluded.generation;
END;

CREATE TRIGGER reporting_choice_options_insert AFTER INSERT ON choice_options BEGIN
 UPDATE reporting_generations SET generation = generation + 1 WHERE workspace_id IN (SELECT workspace_id FROM (SELECT r.workspace_id,r.flow_id, CASE WHEN r.source = 'imported' THEN max(r.completed_at,r.released_at,t.committed_at) ELSE max(r.completed_at,r.released_at) END AS eligible_at FROM responses r LEFT JOIN form_import_targets t ON t.target_id = r.id AND t.kind = 'response' AND t.workspace_id = r.workspace_id WHERE r.state = 'released' AND r.released_at IS NOT NULL AND (r.source != 'imported' OR t.committed_at IS NOT NULL) AND r.revision_id IN (SELECT revision_id FROM flow_steps WHERE id = NEW.step_id)));
 INSERT INTO reporting_changes(workspace_id,flow_id,eligible_at,generation)
 SELECT changed.workspace_id,changed.flow_id,changed.eligible_at,g.generation FROM (SELECT r.workspace_id,r.flow_id, CASE WHEN r.source = 'imported' THEN max(r.completed_at,r.released_at,t.committed_at) ELSE max(r.completed_at,r.released_at) END AS eligible_at FROM responses r LEFT JOIN form_import_targets t ON t.target_id = r.id AND t.kind = 'response' AND t.workspace_id = r.workspace_id WHERE r.state = 'released' AND r.released_at IS NOT NULL AND (r.source != 'imported' OR t.committed_at IS NOT NULL) AND r.revision_id IN (SELECT revision_id FROM flow_steps WHERE id = NEW.step_id)) changed
 JOIN reporting_generations g ON g.workspace_id = changed.workspace_id WHERE changed.eligible_at IS NOT NULL
 ON CONFLICT(workspace_id,flow_id,eligible_at) DO UPDATE SET generation = excluded.generation;
END;

CREATE TRIGGER reporting_choice_options_update BEFORE UPDATE ON choice_options BEGIN
 UPDATE reporting_generations SET generation = generation + 1 WHERE workspace_id IN (SELECT workspace_id FROM (SELECT r.workspace_id,r.flow_id, CASE WHEN r.source = 'imported' THEN max(r.completed_at,r.released_at,t.committed_at) ELSE max(r.completed_at,r.released_at) END AS eligible_at FROM responses r LEFT JOIN form_import_targets t ON t.target_id = r.id AND t.kind = 'response' AND t.workspace_id = r.workspace_id WHERE r.state = 'released' AND r.released_at IS NOT NULL AND (r.source != 'imported' OR t.committed_at IS NOT NULL) AND r.revision_id IN (SELECT revision_id FROM flow_steps WHERE id = OLD.step_id) UNION SELECT r.workspace_id,r.flow_id, CASE WHEN r.source = 'imported' THEN max(r.completed_at,r.released_at,t.committed_at) ELSE max(r.completed_at,r.released_at) END AS eligible_at FROM responses r LEFT JOIN form_import_targets t ON t.target_id = r.id AND t.kind = 'response' AND t.workspace_id = r.workspace_id WHERE r.state = 'released' AND r.released_at IS NOT NULL AND (r.source != 'imported' OR t.committed_at IS NOT NULL) AND r.revision_id IN (SELECT revision_id FROM flow_steps WHERE id = NEW.step_id)));
 INSERT INTO reporting_changes(workspace_id,flow_id,eligible_at,generation)
 SELECT changed.workspace_id,changed.flow_id,changed.eligible_at,g.generation FROM (SELECT r.workspace_id,r.flow_id, CASE WHEN r.source = 'imported' THEN max(r.completed_at,r.released_at,t.committed_at) ELSE max(r.completed_at,r.released_at) END AS eligible_at FROM responses r LEFT JOIN form_import_targets t ON t.target_id = r.id AND t.kind = 'response' AND t.workspace_id = r.workspace_id WHERE r.state = 'released' AND r.released_at IS NOT NULL AND (r.source != 'imported' OR t.committed_at IS NOT NULL) AND r.revision_id IN (SELECT revision_id FROM flow_steps WHERE id = OLD.step_id) UNION SELECT r.workspace_id,r.flow_id, CASE WHEN r.source = 'imported' THEN max(r.completed_at,r.released_at,t.committed_at) ELSE max(r.completed_at,r.released_at) END AS eligible_at FROM responses r LEFT JOIN form_import_targets t ON t.target_id = r.id AND t.kind = 'response' AND t.workspace_id = r.workspace_id WHERE r.state = 'released' AND r.released_at IS NOT NULL AND (r.source != 'imported' OR t.committed_at IS NOT NULL) AND r.revision_id IN (SELECT revision_id FROM flow_steps WHERE id = NEW.step_id)) changed
 JOIN reporting_generations g ON g.workspace_id = changed.workspace_id WHERE changed.eligible_at IS NOT NULL
 ON CONFLICT(workspace_id,flow_id,eligible_at) DO UPDATE SET generation = excluded.generation;
END;

CREATE TRIGGER reporting_flow_steps_delete BEFORE DELETE ON flow_steps BEGIN
 UPDATE reporting_generations SET generation = generation + 1 WHERE workspace_id IN (SELECT workspace_id FROM (SELECT r.workspace_id,r.flow_id, CASE WHEN r.source = 'imported' THEN max(r.completed_at,r.released_at,t.committed_at) ELSE max(r.completed_at,r.released_at) END AS eligible_at FROM responses r LEFT JOIN form_import_targets t ON t.target_id = r.id AND t.kind = 'response' AND t.workspace_id = r.workspace_id WHERE r.state = 'released' AND r.released_at IS NOT NULL AND (r.source != 'imported' OR t.committed_at IS NOT NULL) AND r.revision_id = OLD.revision_id));
 INSERT INTO reporting_changes(workspace_id,flow_id,eligible_at,generation)
 SELECT changed.workspace_id,changed.flow_id,changed.eligible_at,g.generation FROM (SELECT r.workspace_id,r.flow_id, CASE WHEN r.source = 'imported' THEN max(r.completed_at,r.released_at,t.committed_at) ELSE max(r.completed_at,r.released_at) END AS eligible_at FROM responses r LEFT JOIN form_import_targets t ON t.target_id = r.id AND t.kind = 'response' AND t.workspace_id = r.workspace_id WHERE r.state = 'released' AND r.released_at IS NOT NULL AND (r.source != 'imported' OR t.committed_at IS NOT NULL) AND r.revision_id = OLD.revision_id) changed
 JOIN reporting_generations g ON g.workspace_id = changed.workspace_id WHERE changed.eligible_at IS NOT NULL
 ON CONFLICT(workspace_id,flow_id,eligible_at) DO UPDATE SET generation = excluded.generation;
END;

CREATE TRIGGER reporting_flow_steps_insert AFTER INSERT ON flow_steps BEGIN
 UPDATE reporting_generations SET generation = generation + 1 WHERE workspace_id IN (SELECT workspace_id FROM (SELECT r.workspace_id,r.flow_id, CASE WHEN r.source = 'imported' THEN max(r.completed_at,r.released_at,t.committed_at) ELSE max(r.completed_at,r.released_at) END AS eligible_at FROM responses r LEFT JOIN form_import_targets t ON t.target_id = r.id AND t.kind = 'response' AND t.workspace_id = r.workspace_id WHERE r.state = 'released' AND r.released_at IS NOT NULL AND (r.source != 'imported' OR t.committed_at IS NOT NULL) AND r.revision_id = NEW.revision_id));
 INSERT INTO reporting_changes(workspace_id,flow_id,eligible_at,generation)
 SELECT changed.workspace_id,changed.flow_id,changed.eligible_at,g.generation FROM (SELECT r.workspace_id,r.flow_id, CASE WHEN r.source = 'imported' THEN max(r.completed_at,r.released_at,t.committed_at) ELSE max(r.completed_at,r.released_at) END AS eligible_at FROM responses r LEFT JOIN form_import_targets t ON t.target_id = r.id AND t.kind = 'response' AND t.workspace_id = r.workspace_id WHERE r.state = 'released' AND r.released_at IS NOT NULL AND (r.source != 'imported' OR t.committed_at IS NOT NULL) AND r.revision_id = NEW.revision_id) changed
 JOIN reporting_generations g ON g.workspace_id = changed.workspace_id WHERE changed.eligible_at IS NOT NULL
 ON CONFLICT(workspace_id,flow_id,eligible_at) DO UPDATE SET generation = excluded.generation;
END;

CREATE TRIGGER reporting_flow_steps_update BEFORE UPDATE ON flow_steps BEGIN
 UPDATE reporting_generations SET generation = generation + 1 WHERE workspace_id IN (SELECT workspace_id FROM (SELECT r.workspace_id,r.flow_id, CASE WHEN r.source = 'imported' THEN max(r.completed_at,r.released_at,t.committed_at) ELSE max(r.completed_at,r.released_at) END AS eligible_at FROM responses r LEFT JOIN form_import_targets t ON t.target_id = r.id AND t.kind = 'response' AND t.workspace_id = r.workspace_id WHERE r.state = 'released' AND r.released_at IS NOT NULL AND (r.source != 'imported' OR t.committed_at IS NOT NULL) AND r.revision_id = OLD.revision_id UNION SELECT r.workspace_id,r.flow_id, CASE WHEN r.source = 'imported' THEN max(r.completed_at,r.released_at,t.committed_at) ELSE max(r.completed_at,r.released_at) END AS eligible_at FROM responses r LEFT JOIN form_import_targets t ON t.target_id = r.id AND t.kind = 'response' AND t.workspace_id = r.workspace_id WHERE r.state = 'released' AND r.released_at IS NOT NULL AND (r.source != 'imported' OR t.committed_at IS NOT NULL) AND r.revision_id = NEW.revision_id));
 INSERT INTO reporting_changes(workspace_id,flow_id,eligible_at,generation)
 SELECT changed.workspace_id,changed.flow_id,changed.eligible_at,g.generation FROM (SELECT r.workspace_id,r.flow_id, CASE WHEN r.source = 'imported' THEN max(r.completed_at,r.released_at,t.committed_at) ELSE max(r.completed_at,r.released_at) END AS eligible_at FROM responses r LEFT JOIN form_import_targets t ON t.target_id = r.id AND t.kind = 'response' AND t.workspace_id = r.workspace_id WHERE r.state = 'released' AND r.released_at IS NOT NULL AND (r.source != 'imported' OR t.committed_at IS NOT NULL) AND r.revision_id = OLD.revision_id UNION SELECT r.workspace_id,r.flow_id, CASE WHEN r.source = 'imported' THEN max(r.completed_at,r.released_at,t.committed_at) ELSE max(r.completed_at,r.released_at) END AS eligible_at FROM responses r LEFT JOIN form_import_targets t ON t.target_id = r.id AND t.kind = 'response' AND t.workspace_id = r.workspace_id WHERE r.state = 'released' AND r.released_at IS NOT NULL AND (r.source != 'imported' OR t.committed_at IS NOT NULL) AND r.revision_id = NEW.revision_id) changed
 JOIN reporting_generations g ON g.workspace_id = changed.workspace_id WHERE changed.eligible_at IS NOT NULL
 ON CONFLICT(workspace_id,flow_id,eligible_at) DO UPDATE SET generation = excluded.generation;
END;

CREATE TRIGGER response_answer_search_insert AFTER INSERT ON response_answers BEGIN
 DELETE FROM response_search_values WHERE answer_id=NEW.id;
 INSERT INTO response_search_input(response_id,answer_id,value) SELECT a.response_id,a.id,leaf.value FROM response_answers a
 JOIN responses r ON r.id=a.response_id
 JOIN flow_steps s ON s.revision_id=r.revision_id AND s.stable_id=a.step_id
 JOIN json_tree(a.value_json) leaf
 WHERE a.id=NEW.id AND leaf.type='text' AND (s.question_type NOT IN ('single_choice','multiple_choice','dropdown','priority') OR leaf.key='otherText')
 UNION ALL
 SELECT a.response_id,a.id,choice.label FROM response_answers a
 JOIN responses r ON r.id=a.response_id
 JOIN flow_steps s ON s.revision_id=r.revision_id AND s.stable_id=a.step_id
 JOIN json_each( CASE WHEN json_type(a.value_json)='object' THEN json_extract(a.value_json,'$.choiceIds') ELSE a.value_json END ) selected
 JOIN choice_options choice ON choice.step_id=s.id AND choice.stable_id=selected.value
 WHERE a.id=NEW.id AND s.question_type IN ('single_choice','multiple_choice','dropdown','priority');
END;

CREATE TRIGGER response_answer_search_update AFTER UPDATE OF value_json,step_id,response_id ON response_answers BEGIN
 DELETE FROM response_search_values WHERE answer_id=NEW.id;
 INSERT INTO response_search_input(response_id,answer_id,value) SELECT a.response_id,a.id,leaf.value FROM response_answers a
 JOIN responses r ON r.id=a.response_id
 JOIN flow_steps s ON s.revision_id=r.revision_id AND s.stable_id=a.step_id
 JOIN json_tree(a.value_json) leaf
 WHERE a.id=NEW.id AND leaf.type='text' AND (s.question_type NOT IN ('single_choice','multiple_choice','dropdown','priority') OR leaf.key='otherText')
 UNION ALL
 SELECT a.response_id,a.id,choice.label FROM response_answers a
 JOIN responses r ON r.id=a.response_id
 JOIN flow_steps s ON s.revision_id=r.revision_id AND s.stable_id=a.step_id
 JOIN json_each( CASE WHEN json_type(a.value_json)='object' THEN json_extract(a.value_json,'$.choiceIds') ELSE a.value_json END ) selected
 JOIN choice_options choice ON choice.step_id=s.id AND choice.stable_id=selected.value
 WHERE a.id=NEW.id AND s.question_type IN ('single_choice','multiple_choice','dropdown','priority');
END;

-- Private installation settings gain the payment connection. Ciphertext never travels in an archive.
CREATE TABLE integration_connections_expanded (
  kind TEXT PRIMARY KEY CHECK (kind IN ('analysis', 'task', 'payment')),
  sealed TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
INSERT INTO integration_connections_expanded (kind, sealed, updated_at) SELECT kind, sealed, updated_at FROM integration_connections;
DROP TABLE integration_connections;
ALTER TABLE integration_connections_expanded RENAME TO integration_connections;

-- One payment per response. Amounts are whole US cents that Pencil computed from the published
-- revision. The state changes only on a signature-verified Stripe event or the respondent's cancel.
CREATE TABLE response_payments (
  response_id TEXT PRIMARY KEY NOT NULL REFERENCES responses(id),
  step_id TEXT NOT NULL,
  completion_step_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK(provider IN ('stripe')),
  livemode INTEGER NOT NULL CHECK(livemode IN (0, 1)),
  state TEXT NOT NULL CHECK(state IN ('pending', 'paid', 'failed', 'expired', 'cancelled', 'refunded')),
  attempt INTEGER NOT NULL CHECK(attempt >= 1),
  amount INTEGER NOT NULL CHECK(amount > 0),
  currency TEXT NOT NULL CHECK(currency = 'usd'),
  lines_json TEXT NOT NULL,
  checkout_session_id TEXT UNIQUE,
  checkout_url TEXT,
  checkout_expires_at TEXT,
  payment_intent_id TEXT,
  provider_amount INTEGER,
  return_token_hash TEXT UNIQUE,
  state_changed_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX response_payments_intent ON response_payments(payment_intent_id) WHERE payment_intent_id IS NOT NULL;
-- Event IDs make every Stripe delivery idempotent. Only events for a Pencil payment are kept.
CREATE TABLE payment_events (
  id TEXT PRIMARY KEY NOT NULL,
  type TEXT NOT NULL,
  response_id TEXT,
  outcome TEXT NOT NULL CHECK(outcome IN ('applied', 'unchanged')),
  created_at TEXT NOT NULL,
  received_at TEXT NOT NULL
);
-- DATA-002 and GOV-003 erasure remove the payment reference with its response; the event keeps no link.
CREATE TRIGGER erase_response_payment BEFORE DELETE ON responses BEGIN
  DELETE FROM response_payments WHERE response_id = OLD.id;
  UPDATE payment_events SET response_id = NULL WHERE response_id = OLD.id;
END;
