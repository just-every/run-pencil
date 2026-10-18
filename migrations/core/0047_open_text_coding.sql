-- RSLT-012: operator-authored workspace vocabulary and per-retained-answer provenance.
CREATE TABLE workspace_codes (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  normalized_label TEXT NOT NULL,
  created_by_operator_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(workspace_id, normalized_label)
);
CREATE TABLE answer_code_assignments (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  answer_id TEXT NOT NULL REFERENCES response_answers(id) ON DELETE CASCADE,
  code_id TEXT NOT NULL REFERENCES workspace_codes(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK(source IN ('manual','ai_suggestion')),
  actor_operator_id TEXT NOT NULL,
  quote_id TEXT REFERENCES analysis_quotes(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  CHECK((source='manual' AND quote_id IS NULL) OR (source='ai_suggestion' AND quote_id IS NOT NULL)),
  UNIQUE(answer_id, code_id)
);
CREATE INDEX answer_code_assignments_workspace_code ON answer_code_assignments(workspace_id,code_id,answer_id);
CREATE TABLE code_suggestion_decisions (
  quote_id TEXT PRIMARY KEY REFERENCES analysis_quotes(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  decision TEXT NOT NULL CHECK(decision IN ('accepted','rejected')),
  code_id TEXT REFERENCES workspace_codes(id) ON DELETE CASCADE,
  actor_operator_id TEXT NOT NULL,
  decided_at TEXT NOT NULL,
  CHECK((decision='rejected' AND code_id IS NULL) OR (decision='accepted' AND code_id IS NOT NULL))
);
-- A decision is an idempotency receipt. Explicit assignment removal does not erase it.
CREATE INDEX code_suggestion_decisions_workspace ON code_suggestion_decisions(workspace_id,quote_id);

-- Coding changes alter code-filtered export membership. Invalidate fixed exports conservatively.
CREATE TRIGGER coding_assignments_insert AFTER INSERT ON answer_code_assignments BEGIN
 SELECT RAISE(ABORT,'IMPORT_NATIVE_PUBLICATION_CHANGED') WHERE EXISTS (SELECT 1 FROM form_import_native_publication_fences WHERE target_id IN (SELECT response_id FROM (SELECT r.workspace_id,r.flow_id,r.id AS response_id FROM response_answers a JOIN responses r ON r.id=a.response_id WHERE a.id=NEW.answer_id)));
 UPDATE form_import_native_clock SET revision=revision+1 WHERE id=1 AND EXISTS (SELECT 1 FROM form_import_targets WHERE target_id IN (SELECT response_id FROM (SELECT r.workspace_id,r.flow_id,r.id AS response_id FROM response_answers a JOIN responses r ON r.id=a.response_id WHERE a.id=NEW.answer_id)));
 INSERT INTO form_import_native_epochs(target_id,revision) SELECT target_id,(SELECT revision FROM form_import_native_clock WHERE id=1) FROM form_import_targets WHERE target_id IN (SELECT response_id FROM (SELECT r.workspace_id,r.flow_id,r.id AS response_id FROM response_answers a JOIN responses r ON r.id=a.response_id WHERE a.id=NEW.answer_id)) GROUP BY target_id
 ON CONFLICT(target_id) DO UPDATE SET revision=excluded.revision;
 UPDATE reporting_generations SET generation=generation+1 WHERE workspace_id IN (SELECT workspace_id FROM (SELECT r.workspace_id,r.flow_id,r.id AS response_id FROM response_answers a JOIN responses r ON r.id=a.response_id WHERE a.id=NEW.answer_id));
 INSERT INTO reporting_changes(workspace_id,flow_id,eligible_at,generation)
 SELECT changed.workspace_id,changed.flow_id,'0000',g.generation FROM (SELECT r.workspace_id,r.flow_id,r.id AS response_id FROM response_answers a JOIN responses r ON r.id=a.response_id WHERE a.id=NEW.answer_id) changed JOIN reporting_generations g ON g.workspace_id=changed.workspace_id WHERE 1
 ON CONFLICT(workspace_id,flow_id,eligible_at) DO UPDATE SET generation=excluded.generation;
END;
CREATE TRIGGER coding_assignments_update BEFORE UPDATE ON answer_code_assignments BEGIN
 SELECT RAISE(ABORT,'IMPORT_NATIVE_PUBLICATION_CHANGED') WHERE EXISTS (SELECT 1 FROM form_import_native_publication_fences WHERE target_id IN (SELECT response_id FROM (SELECT r.workspace_id,r.flow_id,r.id AS response_id FROM response_answers a JOIN responses r ON r.id=a.response_id WHERE a.id=OLD.answer_id UNION SELECT r.workspace_id,r.flow_id,r.id AS response_id FROM response_answers a JOIN responses r ON r.id=a.response_id WHERE a.id=NEW.answer_id)));
 UPDATE form_import_native_clock SET revision=revision+1 WHERE id=1 AND EXISTS (SELECT 1 FROM form_import_targets WHERE target_id IN (SELECT response_id FROM (SELECT r.workspace_id,r.flow_id,r.id AS response_id FROM response_answers a JOIN responses r ON r.id=a.response_id WHERE a.id=OLD.answer_id UNION SELECT r.workspace_id,r.flow_id,r.id AS response_id FROM response_answers a JOIN responses r ON r.id=a.response_id WHERE a.id=NEW.answer_id)));
 INSERT INTO form_import_native_epochs(target_id,revision) SELECT target_id,(SELECT revision FROM form_import_native_clock WHERE id=1) FROM form_import_targets WHERE target_id IN (SELECT response_id FROM (SELECT r.workspace_id,r.flow_id,r.id AS response_id FROM response_answers a JOIN responses r ON r.id=a.response_id WHERE a.id=OLD.answer_id UNION SELECT r.workspace_id,r.flow_id,r.id AS response_id FROM response_answers a JOIN responses r ON r.id=a.response_id WHERE a.id=NEW.answer_id)) GROUP BY target_id
 ON CONFLICT(target_id) DO UPDATE SET revision=excluded.revision;
 UPDATE reporting_generations SET generation=generation+1 WHERE workspace_id IN (SELECT workspace_id FROM (SELECT r.workspace_id,r.flow_id,r.id AS response_id FROM response_answers a JOIN responses r ON r.id=a.response_id WHERE a.id=OLD.answer_id UNION SELECT r.workspace_id,r.flow_id,r.id AS response_id FROM response_answers a JOIN responses r ON r.id=a.response_id WHERE a.id=NEW.answer_id));
 INSERT INTO reporting_changes(workspace_id,flow_id,eligible_at,generation)
 SELECT changed.workspace_id,changed.flow_id,'0000',g.generation FROM (SELECT r.workspace_id,r.flow_id,r.id AS response_id FROM response_answers a JOIN responses r ON r.id=a.response_id WHERE a.id=OLD.answer_id UNION SELECT r.workspace_id,r.flow_id,r.id AS response_id FROM response_answers a JOIN responses r ON r.id=a.response_id WHERE a.id=NEW.answer_id) changed JOIN reporting_generations g ON g.workspace_id=changed.workspace_id WHERE 1
 ON CONFLICT(workspace_id,flow_id,eligible_at) DO UPDATE SET generation=excluded.generation;
END;
CREATE TRIGGER coding_assignments_delete BEFORE DELETE ON answer_code_assignments BEGIN
 SELECT RAISE(ABORT,'IMPORT_NATIVE_PUBLICATION_CHANGED') WHERE EXISTS (SELECT 1 FROM form_import_native_publication_fences WHERE target_id IN (SELECT response_id FROM (SELECT r.workspace_id,r.flow_id,r.id AS response_id FROM response_answers a JOIN responses r ON r.id=a.response_id WHERE a.id=OLD.answer_id)));
 UPDATE form_import_native_clock SET revision=revision+1 WHERE id=1 AND EXISTS (SELECT 1 FROM form_import_targets WHERE target_id IN (SELECT response_id FROM (SELECT r.workspace_id,r.flow_id,r.id AS response_id FROM response_answers a JOIN responses r ON r.id=a.response_id WHERE a.id=OLD.answer_id)));
 INSERT INTO form_import_native_epochs(target_id,revision) SELECT target_id,(SELECT revision FROM form_import_native_clock WHERE id=1) FROM form_import_targets WHERE target_id IN (SELECT response_id FROM (SELECT r.workspace_id,r.flow_id,r.id AS response_id FROM response_answers a JOIN responses r ON r.id=a.response_id WHERE a.id=OLD.answer_id)) GROUP BY target_id
 ON CONFLICT(target_id) DO UPDATE SET revision=excluded.revision;
 UPDATE reporting_generations SET generation=generation+1 WHERE workspace_id IN (SELECT workspace_id FROM (SELECT r.workspace_id,r.flow_id,r.id AS response_id FROM response_answers a JOIN responses r ON r.id=a.response_id WHERE a.id=OLD.answer_id));
 INSERT INTO reporting_changes(workspace_id,flow_id,eligible_at,generation)
 SELECT changed.workspace_id,changed.flow_id,'0000',g.generation FROM (SELECT r.workspace_id,r.flow_id,r.id AS response_id FROM response_answers a JOIN responses r ON r.id=a.response_id WHERE a.id=OLD.answer_id) changed JOIN reporting_generations g ON g.workspace_id=changed.workspace_id WHERE 1
 ON CONFLICT(workspace_id,flow_id,eligible_at) DO UPDATE SET generation=excluded.generation;
END;
CREATE TRIGGER coding_analysis_runs_update BEFORE UPDATE OF state,redacted_at ON analysis_runs BEGIN
 UPDATE reporting_generations SET generation=generation+1 WHERE workspace_id IN (SELECT workspace_id FROM (SELECT OLD.workspace_id AS workspace_id,OLD.flow_id AS flow_id UNION SELECT NEW.workspace_id AS workspace_id,NEW.flow_id AS flow_id));
 INSERT INTO reporting_changes(workspace_id,flow_id,eligible_at,generation)
 SELECT changed.workspace_id,changed.flow_id,'0000',g.generation FROM (SELECT OLD.workspace_id AS workspace_id,OLD.flow_id AS flow_id UNION SELECT NEW.workspace_id AS workspace_id,NEW.flow_id AS flow_id) changed JOIN reporting_generations g ON g.workspace_id=changed.workspace_id WHERE 1
 ON CONFLICT(workspace_id,flow_id,eligible_at) DO UPDATE SET generation=excluded.generation;
END;
CREATE TRIGGER coding_analysis_theme_members_insert BEFORE INSERT ON analysis_theme_members BEGIN
 UPDATE reporting_generations SET generation=generation+1 WHERE workspace_id IN (SELECT workspace_id FROM (SELECT ar.workspace_id,ar.flow_id FROM analysis_runs ar WHERE ar.id=NEW.run_id));
 INSERT INTO reporting_changes(workspace_id,flow_id,eligible_at,generation)
 SELECT changed.workspace_id,changed.flow_id,'0000',g.generation FROM (SELECT ar.workspace_id,ar.flow_id FROM analysis_runs ar WHERE ar.id=NEW.run_id) changed JOIN reporting_generations g ON g.workspace_id=changed.workspace_id WHERE 1
 ON CONFLICT(workspace_id,flow_id,eligible_at) DO UPDATE SET generation=excluded.generation;
END;
CREATE TRIGGER coding_analysis_theme_members_update BEFORE UPDATE ON analysis_theme_members BEGIN
 UPDATE reporting_generations SET generation=generation+1 WHERE workspace_id IN (SELECT workspace_id FROM (SELECT ar.workspace_id,ar.flow_id FROM analysis_runs ar WHERE ar.id=OLD.run_id UNION SELECT ar.workspace_id,ar.flow_id FROM analysis_runs ar WHERE ar.id=NEW.run_id));
 INSERT INTO reporting_changes(workspace_id,flow_id,eligible_at,generation)
 SELECT changed.workspace_id,changed.flow_id,'0000',g.generation FROM (SELECT ar.workspace_id,ar.flow_id FROM analysis_runs ar WHERE ar.id=OLD.run_id UNION SELECT ar.workspace_id,ar.flow_id FROM analysis_runs ar WHERE ar.id=NEW.run_id) changed JOIN reporting_generations g ON g.workspace_id=changed.workspace_id WHERE 1
 ON CONFLICT(workspace_id,flow_id,eligible_at) DO UPDATE SET generation=excluded.generation;
END;
CREATE TRIGGER coding_analysis_theme_members_delete BEFORE DELETE ON analysis_theme_members BEGIN
 UPDATE reporting_generations SET generation=generation+1 WHERE workspace_id IN (SELECT workspace_id FROM (SELECT ar.workspace_id,ar.flow_id FROM analysis_runs ar WHERE ar.id=OLD.run_id));
 INSERT INTO reporting_changes(workspace_id,flow_id,eligible_at,generation)
 SELECT changed.workspace_id,changed.flow_id,'0000',g.generation FROM (SELECT ar.workspace_id,ar.flow_id FROM analysis_runs ar WHERE ar.id=OLD.run_id) changed JOIN reporting_generations g ON g.workspace_id=changed.workspace_id WHERE 1
 ON CONFLICT(workspace_id,flow_id,eligible_at) DO UPDATE SET generation=excluded.generation;
END;
