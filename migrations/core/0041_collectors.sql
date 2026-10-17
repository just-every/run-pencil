-- Derived attribution lives outside the import kit's immutable native values.
CREATE TABLE collectors (
 id TEXT PRIMARY KEY NOT NULL,
 flow_id TEXT NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
 name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 120),
 channel TEXT NOT NULL CHECK(channel IN ('web','embed','email','sms','qr','social','partner','imported','unknown')),
 public_key TEXT NOT NULL UNIQUE CHECK(length(public_key)=32 AND public_key NOT GLOB '*[^0-9a-f]*'),
 system_source TEXT CHECK(system_source IN ('direct','embed','invitation','imported','unknown')),
 deadline_at TEXT, deadline_time_zone TEXT,
 response_limit INTEGER CHECK(response_limit IS NULL OR (typeof(response_limit)='integer' AND response_limit>0)),
 closed_at TEXT,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 CHECK((deadline_at IS NULL)=(deadline_time_zone IS NULL)),
 CHECK(system_source IS NULL OR (deadline_at IS NULL AND response_limit IS NULL AND closed_at IS NULL)),
 UNIQUE(flow_id,system_source)
);
CREATE INDEX collectors_flow ON collectors(flow_id,created_at,id);
CREATE TABLE session_collector (
 session_id TEXT PRIMARY KEY NOT NULL REFERENCES respondent_sessions(id) ON DELETE CASCADE,
 collector_id TEXT NOT NULL REFERENCES collectors(id)
);
CREATE INDEX session_collector_collector ON session_collector(collector_id);
CREATE TABLE response_collector (
 response_id TEXT PRIMARY KEY NOT NULL REFERENCES responses(id) ON DELETE CASCADE,
 collector_id TEXT NOT NULL REFERENCES collectors(id)
);
CREATE INDEX response_collector_collector ON response_collector(collector_id,response_id);
CREATE TABLE invitation_launch_collector (
 launch_id TEXT PRIMARY KEY NOT NULL REFERENCES invitation_launches(id) ON DELETE CASCADE,
 collector_id TEXT NOT NULL REFERENCES collectors(id)
);
CREATE INDEX invitation_launch_collector_collector ON invitation_launch_collector(collector_id);

INSERT INTO collectors(id,flow_id,name,channel,public_key,system_source,created_at,updated_at)
 SELECT 'system:'||d.source||':'||f.id,f.id,d.name,d.channel,lower(hex(randomblob(16))),d.source,f.created_at,f.created_at
 FROM flows f CROSS JOIN (
 SELECT 'direct' AS source,'Direct link' AS name,'web' AS channel
 UNION ALL SELECT 'embed','Unlabelled embeds','embed'
 UNION ALL SELECT 'invitation','Email invitations','email'
 UNION ALL SELECT 'imported','Imported responses','imported'
 UNION ALL SELECT 'unknown','Historical source unavailable','unknown') d;
-- Fail on corrupt source data rather than manufacture a historical source.
SELECT json('COLLECTOR_SOURCE_INVALID') FROM responses WHERE source NOT IN ('direct','embed','invitation','imported','unknown') LIMIT 1;
INSERT INTO session_collector(session_id,collector_id)
 SELECT s.id,c.id FROM respondent_sessions s JOIN flow_revisions v ON v.id=s.revision_id
 JOIN collectors c ON c.flow_id=v.flow_id AND c.system_source=s.source;
INSERT INTO response_collector(response_id,collector_id)
 SELECT r.id,c.id FROM responses r JOIN collectors c ON c.flow_id=r.flow_id AND c.system_source=r.source;
INSERT INTO invitation_launch_collector(launch_id,collector_id)
 SELECT l.id,c.id FROM invitation_launches l JOIN flow_revisions v ON v.id=l.revision_id
 JOIN collectors c ON c.flow_id=v.flow_id AND c.system_source='invitation';

CREATE TRIGGER collector_flow_defaults AFTER INSERT ON flows BEGIN
 INSERT INTO collectors(id,flow_id,name,channel,public_key,system_source,created_at,updated_at)
 SELECT 'system:'||d.source||':'||NEW.id,NEW.id,d.name,d.channel,lower(hex(randomblob(16))),d.source,NEW.created_at,NEW.created_at
 FROM (SELECT 'direct' AS source,'Direct link' AS name,'web' AS channel
 UNION ALL SELECT 'embed','Unlabelled embeds','embed'
 UNION ALL SELECT 'invitation','Email invitations','email'
 UNION ALL SELECT 'imported','Imported responses','imported'
 UNION ALL SELECT 'unknown','Historical source unavailable','unknown') d;
END;
CREATE TRIGGER collector_system_insert BEFORE INSERT ON collectors
 WHEN NEW.system_source IS NOT NULL BEGIN
 SELECT RAISE(ABORT,'COLLECTOR_SYSTEM_INVALID') WHERE NEW.id IS NOT 'system:'||NEW.system_source||':'||NEW.flow_id;
END;
CREATE TRIGGER collector_named_limit BEFORE INSERT ON collectors
 WHEN NEW.system_source IS NULL BEGIN
 SELECT RAISE(ABORT,'COLLECTOR_LIMIT_REACHED') WHERE (SELECT count(*) FROM collectors WHERE flow_id=NEW.flow_id AND system_source IS NULL)>=200;
END;
CREATE TRIGGER collector_identity_update BEFORE UPDATE ON collectors BEGIN
 SELECT RAISE(ABORT,'COLLECTOR_IDENTITY_IMMUTABLE') WHERE NEW.id IS NOT OLD.id OR NEW.flow_id IS NOT OLD.flow_id OR NEW.public_key IS NOT OLD.public_key OR NEW.system_source IS NOT OLD.system_source;
 SELECT RAISE(ABORT,'COLLECTOR_SYSTEM_IMMUTABLE') WHERE OLD.system_source IS NOT NULL;
END;
CREATE TRIGGER collector_system_delete BEFORE DELETE ON collectors
 WHEN OLD.system_source IS NOT NULL AND EXISTS(SELECT 1 FROM flows WHERE id=OLD.flow_id) BEGIN
 SELECT RAISE(ABORT,'COLLECTOR_SYSTEM_IMMUTABLE');
END;
-- A later operator customization must not disappear in an imported-form undo.
CREATE TRIGGER collector_flow_delete BEFORE DELETE ON flows
 WHEN EXISTS(SELECT 1 FROM collectors WHERE flow_id=OLD.id AND system_source IS NULL) BEGIN
 SELECT RAISE(ABORT,'NATIVE_EDIT_CONFLICT: named collector configuration exists');
END;
CREATE TRIGGER collector_session_owner_insert BEFORE INSERT ON session_collector BEGIN
 SELECT RAISE(ABORT,'COLLECTOR_SESSION_OWNERSHIP') WHERE NOT EXISTS(
 SELECT 1 FROM respondent_sessions s JOIN flow_revisions v ON v.id=s.revision_id JOIN collectors c ON c.flow_id=v.flow_id
 WHERE s.id=NEW.session_id AND c.id=NEW.collector_id AND (c.system_source IS NULL OR c.system_source=s.source));
END;
CREATE TRIGGER collector_session_owner_update BEFORE UPDATE ON session_collector BEGIN
 SELECT RAISE(ABORT,'COLLECTOR_SESSION_OWNERSHIP') WHERE NEW.session_id IS NOT OLD.session_id OR NOT EXISTS(
 SELECT 1 FROM respondent_sessions s JOIN flow_revisions v ON v.id=s.revision_id JOIN collectors c ON c.flow_id=v.flow_id
 WHERE s.id=NEW.session_id AND c.id=NEW.collector_id AND (c.system_source IS NULL OR c.system_source=s.source));
 SELECT RAISE(ABORT,'COLLECTOR_RESPONSE_IMMUTABLE') WHERE EXISTS(SELECT 1 FROM responses WHERE session_id=OLD.session_id);
END;
CREATE TRIGGER collector_session_relation_delete BEFORE DELETE ON session_collector
 WHEN EXISTS(SELECT 1 FROM respondent_sessions WHERE id=OLD.session_id) BEGIN
 SELECT RAISE(ABORT,'COLLECTOR_SESSION_REQUIRED');
END;
CREATE TRIGGER collector_session_default AFTER INSERT ON respondent_sessions BEGIN
 INSERT INTO session_collector(session_id,collector_id)
 SELECT NEW.id,c.id FROM flow_revisions v JOIN collectors c ON c.flow_id=v.flow_id
 WHERE v.id=NEW.revision_id AND c.system_source=NEW.source;
END;
CREATE TRIGGER collector_session_parent_update BEFORE UPDATE OF revision_id,source ON respondent_sessions BEGIN
 SELECT RAISE(ABORT,'COLLECTOR_SESSION_OWNERSHIP') WHERE EXISTS(
 SELECT 1 FROM session_collector sc JOIN collectors c ON c.id=sc.collector_id WHERE sc.session_id=OLD.id
 AND (NOT EXISTS(SELECT 1 FROM flow_revisions v WHERE v.id=NEW.revision_id AND v.flow_id=c.flow_id)
 OR (c.system_source IS NOT NULL AND c.system_source IS NOT NEW.source)));
END;
CREATE TRIGGER collector_response_owner_insert BEFORE INSERT ON response_collector BEGIN
 SELECT RAISE(ABORT,'COLLECTOR_RESPONSE_OWNERSHIP') WHERE NOT EXISTS(
 SELECT 1 FROM responses r JOIN collectors c ON c.flow_id=r.flow_id JOIN flows f ON f.id=r.flow_id
 WHERE r.id=NEW.response_id AND c.id=NEW.collector_id AND f.workspace_id=r.workspace_id
 AND (c.system_source IS NULL OR c.system_source=r.source));
 SELECT RAISE(ABORT,'COLLECTOR_CLOSED') WHERE EXISTS(
 SELECT 1 FROM collectors c JOIN responses r ON r.id=NEW.response_id WHERE c.id=NEW.collector_id
 AND (c.closed_at IS NOT NULL OR (c.deadline_at IS NOT NULL AND c.deadline_at<=r.completed_at)
 OR (c.response_limit IS NOT NULL AND (SELECT count(*) FROM response_collector WHERE collector_id=c.id)>=c.response_limit)));
END;
CREATE TRIGGER collector_response_immutable BEFORE UPDATE ON response_collector BEGIN
 SELECT RAISE(ABORT,'COLLECTOR_RESPONSE_IMMUTABLE');
END;
CREATE TRIGGER collector_response_relation_delete BEFORE DELETE ON response_collector
 WHEN EXISTS(SELECT 1 FROM responses WHERE id=OLD.response_id) BEGIN
 SELECT RAISE(ABORT,'COLLECTOR_RESPONSE_REQUIRED');
END;
CREATE TRIGGER collector_response_default AFTER INSERT ON responses BEGIN
 SELECT RAISE(ABORT,'COLLECTOR_SOURCE_INVALID') WHERE NEW.source NOT IN ('direct','embed','invitation','imported','unknown');
 INSERT INTO response_collector(response_id,collector_id)
 SELECT NEW.id,COALESCE((SELECT sc.collector_id FROM session_collector sc JOIN respondent_sessions s ON s.id=sc.session_id
 WHERE s.id=NEW.session_id AND s.revision_id=NEW.revision_id AND s.source=NEW.source AND NEW.source!='imported'),c.id)
 FROM collectors c WHERE c.flow_id=NEW.flow_id AND c.system_source=NEW.source;
END;
CREATE TRIGGER collector_response_parent_update BEFORE UPDATE OF flow_id,workspace_id,source ON responses BEGIN
 SELECT RAISE(ABORT,'COLLECTOR_RESPONSE_OWNERSHIP') WHERE EXISTS(
 SELECT 1 FROM response_collector rc JOIN collectors c ON c.id=rc.collector_id WHERE rc.response_id=OLD.id
 AND (c.flow_id IS NOT NEW.flow_id OR NOT EXISTS(SELECT 1 FROM flows f WHERE f.id=c.flow_id AND f.workspace_id=NEW.workspace_id)
 OR (c.system_source IS NOT NULL AND c.system_source IS NOT NEW.source)));
END;
CREATE TRIGGER collector_launch_owner_insert BEFORE INSERT ON invitation_launch_collector BEGIN
 SELECT RAISE(ABORT,'COLLECTOR_LAUNCH_OWNERSHIP') WHERE NOT EXISTS(
 SELECT 1 FROM invitation_launches l JOIN flow_revisions v ON v.id=l.revision_id JOIN flows f ON f.id=v.flow_id JOIN collectors c ON c.flow_id=f.id
 WHERE l.id=NEW.launch_id AND c.id=NEW.collector_id AND l.workspace_id=f.workspace_id
 AND (c.system_source IS NULL OR c.system_source='invitation'));
END;
CREATE TRIGGER collector_launch_owner_update BEFORE UPDATE ON invitation_launch_collector BEGIN
 SELECT RAISE(ABORT,'COLLECTOR_LAUNCH_OWNERSHIP') WHERE NEW.launch_id IS NOT OLD.launch_id OR NOT EXISTS(
 SELECT 1 FROM invitation_launches l JOIN flow_revisions v ON v.id=l.revision_id JOIN flows f ON f.id=v.flow_id JOIN collectors c ON c.flow_id=f.id
 WHERE l.id=NEW.launch_id AND c.id=NEW.collector_id AND l.workspace_id=f.workspace_id
 AND (c.system_source IS NULL OR c.system_source='invitation'));
 SELECT RAISE(ABORT,'COLLECTOR_LAUNCH_IMMUTABLE') WHERE EXISTS(SELECT 1 FROM invitation_participants WHERE launch_id=OLD.launch_id)
 OR EXISTS(SELECT 1 FROM invitation_candidates WHERE launch_id=OLD.launch_id);
END;
CREATE TRIGGER collector_launch_relation_delete BEFORE DELETE ON invitation_launch_collector
 WHEN EXISTS(SELECT 1 FROM invitation_launches WHERE id=OLD.launch_id) BEGIN
 SELECT RAISE(ABORT,'COLLECTOR_LAUNCH_REQUIRED');
END;
CREATE TRIGGER collector_launch_default AFTER INSERT ON invitation_launches BEGIN
 INSERT INTO invitation_launch_collector(launch_id,collector_id)
 SELECT NEW.id,c.id FROM flow_revisions v JOIN collectors c ON c.flow_id=v.flow_id
 WHERE v.id=NEW.revision_id AND c.system_source='invitation';
END;
-- Collector labels travel with exported answers. A rename invalidates an in-flight
-- snapshot instead of mixing old and new campaign names across download pages.
CREATE TRIGGER collector_reporting_labels AFTER UPDATE OF name,channel ON collectors
 WHEN NEW.name IS NOT OLD.name OR NEW.channel IS NOT OLD.channel BEGIN
 UPDATE reporting_generations SET generation=generation+1
 WHERE workspace_id=(SELECT workspace_id FROM flows WHERE id=NEW.flow_id);
 INSERT INTO reporting_changes(workspace_id,flow_id,eligible_at,generation)
 SELECT f.workspace_id,f.id,'0001-01-01T00:00:00.000Z',g.generation FROM flows f
 JOIN reporting_generations g ON g.workspace_id=f.workspace_id WHERE f.id=NEW.flow_id
 ON CONFLICT(workspace_id,flow_id,eligible_at) DO UPDATE SET generation=excluded.generation;
END;
