ALTER TABLE flow_revisions ADD COLUMN form_settings_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE responses ADD COLUMN response_context_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE respondent_saves ADD COLUMN response_context_json TEXT;
CREATE TRIGGER respondent_save_context_completed AFTER INSERT ON responses BEGIN
  UPDATE respondent_saves SET response_context_json=NULL WHERE session_id=NEW.session_id;
END;
