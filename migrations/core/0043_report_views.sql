-- Saved crosstabs retain bounded categorical aggregates, never response IDs or raw answers.
CREATE TABLE report_dashboards (
 flow_id TEXT PRIMARY KEY REFERENCES flows(id) ON DELETE CASCADE,
 version INTEGER NOT NULL DEFAULT 0 CHECK(version>=0),
 erasure_generation INTEGER NOT NULL DEFAULT 0 CHECK(erasure_generation>=0),
 mutation_id TEXT
);
CREATE TABLE report_views (
 id TEXT PRIMARY KEY,
 flow_id TEXT NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
 name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 100),
 definition_json TEXT NOT NULL CHECK(json_valid(definition_json) AND length(CAST(definition_json AS BLOB))<=16384),
 cutoff TEXT NOT NULL,
 snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json) AND length(CAST(snapshot_json AS BLOB))<=262144),
 creator_operator_id TEXT REFERENCES operators(id) ON DELETE SET NULL,
 created_at TEXT NOT NULL,
 position INTEGER NOT NULL CHECK(position>=0)
);
CREATE INDEX report_views_order ON report_views(flow_id,position,id);
INSERT INTO report_dashboards(flow_id) SELECT id FROM flows;
CREATE TRIGGER report_dashboard_flow_insert AFTER INSERT ON flows BEGIN
 INSERT INTO report_dashboards(flow_id) VALUES(NEW.id);
END;
-- Increment even when no saved views remain: an in-flight aggregate may otherwise
-- republish data after erasure. Ordinary response/answer INSERTs do not invalidate.
CREATE TRIGGER report_views_response_delete BEFORE DELETE ON responses BEGIN
 DELETE FROM report_views WHERE flow_id=OLD.flow_id;
 UPDATE report_dashboards SET version=version+1,erasure_generation=erasure_generation+1,mutation_id=NULL WHERE flow_id=OLD.flow_id;
END;
CREATE TRIGGER report_views_answer_delete BEFORE DELETE ON response_answers BEGIN
 DELETE FROM report_views WHERE flow_id IN(SELECT flow_id FROM responses WHERE id=OLD.response_id);
 UPDATE report_dashboards SET version=version+1,erasure_generation=erasure_generation+1,mutation_id=NULL WHERE flow_id IN(SELECT flow_id FROM responses WHERE id=OLD.response_id);
END;
CREATE TRIGGER report_views_answer_update BEFORE UPDATE OF value_json,step_id,response_id ON response_answers WHEN OLD.value_json IS NOT NEW.value_json OR OLD.step_id IS NOT NEW.step_id OR OLD.response_id IS NOT NEW.response_id BEGIN
 DELETE FROM report_views WHERE flow_id IN(SELECT flow_id FROM responses WHERE id IN(OLD.response_id,NEW.response_id));
 UPDATE report_dashboards SET version=version+1,erasure_generation=erasure_generation+1,mutation_id=NULL WHERE flow_id IN(SELECT flow_id FROM responses WHERE id IN(OLD.response_id,NEW.response_id));
END;
CREATE TRIGGER report_views_response_scope_update BEFORE UPDATE OF state,revision_id,flow_id,workspace_id,source,participant_id,completed_at,released_at ON responses WHEN OLD.state='released' AND (OLD.state IS NOT NEW.state OR OLD.revision_id IS NOT NEW.revision_id OR OLD.flow_id IS NOT NEW.flow_id OR OLD.workspace_id IS NOT NEW.workspace_id OR OLD.source IS NOT NEW.source OR OLD.participant_id IS NOT NEW.participant_id OR OLD.completed_at IS NOT NEW.completed_at OR OLD.released_at IS NOT NEW.released_at) BEGIN
 DELETE FROM report_views WHERE flow_id IN(OLD.flow_id,NEW.flow_id);
 UPDATE report_dashboards SET version=version+1,erasure_generation=erasure_generation+1,mutation_id=NULL WHERE flow_id IN(OLD.flow_id,NEW.flow_id);
END;
-- An assignee filter is personal metadata; creator attribution itself uses SET NULL.
CREATE TRIGGER report_views_operator_delete BEFORE DELETE ON operators BEGIN
 UPDATE report_dashboards SET version=version+1,erasure_generation=erasure_generation+1,mutation_id=NULL WHERE flow_id IN(SELECT id FROM flows WHERE workspace_id=OLD.workspace_id);
 DELETE FROM report_views WHERE json_extract(definition_json,'$.filter.workflowAssignee')=OLD.id;
END;

CREATE TRIGGER report_views_collector_delete BEFORE DELETE ON collectors BEGIN
 DELETE FROM report_views WHERE flow_id=OLD.flow_id;
 UPDATE report_dashboards SET version=version+1,erasure_generation=erasure_generation+1,mutation_id=NULL WHERE flow_id=OLD.flow_id;
END;
CREATE TRIGGER report_views_import_source_delete BEFORE DELETE ON form_import_targets WHEN OLD.kind='response' BEGIN
 DELETE FROM report_views WHERE flow_id=OLD.flow_id;
 UPDATE report_dashboards SET version=version+1,erasure_generation=erasure_generation+1,mutation_id=NULL WHERE flow_id=OLD.flow_id;
END;
-- A stricter disclosure policy must also govern already-saved aggregates.
CREATE TRIGGER report_views_disclosure_increase BEFORE UPDATE OF disclosure_threshold,workspace_id ON analysis_policies WHEN NEW.disclosure_threshold>OLD.disclosure_threshold OR OLD.workspace_id IS NOT NEW.workspace_id BEGIN
 DELETE FROM report_views WHERE flow_id IN(SELECT id FROM flows WHERE workspace_id IN(OLD.workspace_id,NEW.workspace_id));
 UPDATE report_dashboards SET version=version+1,erasure_generation=erasure_generation+1,mutation_id=NULL WHERE flow_id IN(SELECT id FROM flows WHERE workspace_id IN(OLD.workspace_id,NEW.workspace_id));
END;
CREATE TRIGGER report_views_disclosure_insert AFTER INSERT ON analysis_policies BEGIN
 DELETE FROM report_views WHERE flow_id IN(SELECT id FROM flows WHERE workspace_id=NEW.workspace_id);
 UPDATE report_dashboards SET version=version+1,erasure_generation=erasure_generation+1,mutation_id=NULL WHERE flow_id IN(SELECT id FROM flows WHERE workspace_id=NEW.workspace_id);
END;
CREATE TRIGGER report_views_disclosure_delete BEFORE DELETE ON analysis_policies BEGIN
 DELETE FROM report_views WHERE flow_id IN(SELECT id FROM flows WHERE workspace_id=OLD.workspace_id);
 UPDATE report_dashboards SET version=version+1,erasure_generation=erasure_generation+1,mutation_id=NULL WHERE flow_id IN(SELECT id FROM flows WHERE workspace_id=OLD.workspace_id);
END;
