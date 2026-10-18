-- Quarantined answers are exportable only on explicit request. Changes must
-- invalidate their sealed snapshots just as released-answer edits already do.

CREATE TRIGGER excluded_export_responses_insert AFTER INSERT ON responses
WHEN NEW.state = 'quarantined'
BEGIN
 UPDATE reporting_generations SET generation=generation+1 WHERE workspace_id IN(SELECT workspace_id FROM (SELECT NEW.workspace_id AS workspace_id,NEW.flow_id AS flow_id,NEW.completed_at AS eligible_at WHERE NEW.state = 'quarantined'));
 INSERT INTO reporting_changes(workspace_id,flow_id,eligible_at,generation)
 SELECT c.workspace_id,c.flow_id,c.eligible_at,g.generation FROM (SELECT NEW.workspace_id AS workspace_id,NEW.flow_id AS flow_id,NEW.completed_at AS eligible_at WHERE NEW.state = 'quarantined') c
 JOIN reporting_generations g ON g.workspace_id=c.workspace_id WHERE 1
 ON CONFLICT(workspace_id,flow_id,eligible_at) DO UPDATE SET generation=excluded.generation;
END;

CREATE TRIGGER excluded_export_responses_update AFTER UPDATE ON responses
WHEN OLD.state = 'quarantined' OR NEW.state = 'quarantined'
BEGIN
 UPDATE reporting_generations SET generation=generation+1 WHERE workspace_id IN(SELECT workspace_id FROM (SELECT OLD.workspace_id AS workspace_id,OLD.flow_id AS flow_id,OLD.completed_at AS eligible_at WHERE OLD.state = 'quarantined' UNION SELECT NEW.workspace_id AS workspace_id,NEW.flow_id AS flow_id,NEW.completed_at AS eligible_at WHERE NEW.state = 'quarantined'));
 INSERT INTO reporting_changes(workspace_id,flow_id,eligible_at,generation)
 SELECT c.workspace_id,c.flow_id,c.eligible_at,g.generation FROM (SELECT OLD.workspace_id AS workspace_id,OLD.flow_id AS flow_id,OLD.completed_at AS eligible_at WHERE OLD.state = 'quarantined' UNION SELECT NEW.workspace_id AS workspace_id,NEW.flow_id AS flow_id,NEW.completed_at AS eligible_at WHERE NEW.state = 'quarantined') c
 JOIN reporting_generations g ON g.workspace_id=c.workspace_id WHERE 1
 ON CONFLICT(workspace_id,flow_id,eligible_at) DO UPDATE SET generation=excluded.generation;
END;

CREATE TRIGGER excluded_export_responses_delete AFTER DELETE ON responses
WHEN OLD.state = 'quarantined'
BEGIN
 UPDATE reporting_generations SET generation=generation+1 WHERE workspace_id IN(SELECT workspace_id FROM (SELECT OLD.workspace_id AS workspace_id,OLD.flow_id AS flow_id,OLD.completed_at AS eligible_at WHERE OLD.state = 'quarantined'));
 INSERT INTO reporting_changes(workspace_id,flow_id,eligible_at,generation)
 SELECT c.workspace_id,c.flow_id,c.eligible_at,g.generation FROM (SELECT OLD.workspace_id AS workspace_id,OLD.flow_id AS flow_id,OLD.completed_at AS eligible_at WHERE OLD.state = 'quarantined') c
 JOIN reporting_generations g ON g.workspace_id=c.workspace_id WHERE 1
 ON CONFLICT(workspace_id,flow_id,eligible_at) DO UPDATE SET generation=excluded.generation;
END;

CREATE TRIGGER excluded_export_response_answers_insert AFTER INSERT ON response_answers
WHEN EXISTS(SELECT 1 FROM responses WHERE state='quarantined' AND id IN(SELECT NEW.response_id))
BEGIN
 UPDATE reporting_generations SET generation=generation+1 WHERE workspace_id IN(SELECT workspace_id FROM (SELECT workspace_id,flow_id,completed_at AS eligible_at FROM responses WHERE state='quarantined' AND id IN(SELECT NEW.response_id)));
 INSERT INTO reporting_changes(workspace_id,flow_id,eligible_at,generation)
 SELECT c.workspace_id,c.flow_id,c.eligible_at,g.generation FROM (SELECT workspace_id,flow_id,completed_at AS eligible_at FROM responses WHERE state='quarantined' AND id IN(SELECT NEW.response_id)) c
 JOIN reporting_generations g ON g.workspace_id=c.workspace_id WHERE 1
 ON CONFLICT(workspace_id,flow_id,eligible_at) DO UPDATE SET generation=excluded.generation;
END;

CREATE TRIGGER excluded_export_response_answers_update AFTER UPDATE ON response_answers
WHEN EXISTS(SELECT 1 FROM responses WHERE state='quarantined' AND id IN(SELECT OLD.response_id UNION SELECT NEW.response_id))
BEGIN
 UPDATE reporting_generations SET generation=generation+1 WHERE workspace_id IN(SELECT workspace_id FROM (SELECT workspace_id,flow_id,completed_at AS eligible_at FROM responses WHERE state='quarantined' AND id IN(SELECT OLD.response_id UNION SELECT NEW.response_id)));
 INSERT INTO reporting_changes(workspace_id,flow_id,eligible_at,generation)
 SELECT c.workspace_id,c.flow_id,c.eligible_at,g.generation FROM (SELECT workspace_id,flow_id,completed_at AS eligible_at FROM responses WHERE state='quarantined' AND id IN(SELECT OLD.response_id UNION SELECT NEW.response_id)) c
 JOIN reporting_generations g ON g.workspace_id=c.workspace_id WHERE 1
 ON CONFLICT(workspace_id,flow_id,eligible_at) DO UPDATE SET generation=excluded.generation;
END;

CREATE TRIGGER excluded_export_response_answers_delete AFTER DELETE ON response_answers
WHEN EXISTS(SELECT 1 FROM responses WHERE state='quarantined' AND id IN(SELECT OLD.response_id))
BEGIN
 UPDATE reporting_generations SET generation=generation+1 WHERE workspace_id IN(SELECT workspace_id FROM (SELECT workspace_id,flow_id,completed_at AS eligible_at FROM responses WHERE state='quarantined' AND id IN(SELECT OLD.response_id)));
 INSERT INTO reporting_changes(workspace_id,flow_id,eligible_at,generation)
 SELECT c.workspace_id,c.flow_id,c.eligible_at,g.generation FROM (SELECT workspace_id,flow_id,completed_at AS eligible_at FROM responses WHERE state='quarantined' AND id IN(SELECT OLD.response_id)) c
 JOIN reporting_generations g ON g.workspace_id=c.workspace_id WHERE 1
 ON CONFLICT(workspace_id,flow_id,eligible_at) DO UPDATE SET generation=excluded.generation;
END;
