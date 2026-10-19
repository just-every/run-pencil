-- Retention is an explicit per-form owner decision. Existing forms remain off.
CREATE TABLE form_retention (
  flow_id TEXT PRIMARY KEY NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  days INTEGER CHECK(days IS NULL OR (days BETWEEN 1 AND 36500)),
  legal_hold INTEGER NOT NULL DEFAULT 0 CHECK(legal_hold IN (0,1)),
  version INTEGER NOT NULL,
  change_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
-- A notice names private data only by its internal key. It never holds answers.
CREATE TABLE retention_notices (
  flow_id TEXT NOT NULL REFERENCES form_retention(flow_id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('response','save')),
  item_id TEXT NOT NULL,
  policy_version INTEGER NOT NULL,
  notified_at TEXT NOT NULL,
  delete_after TEXT NOT NULL,
  PRIMARY KEY(flow_id,kind,item_id)
);
CREATE INDEX retention_notices_due ON retention_notices(delete_after);
CREATE TRIGGER retention_response_deleted AFTER DELETE ON responses BEGIN
  DELETE FROM retention_notices WHERE kind='response' AND item_id=OLD.id;
END;
CREATE TRIGGER retention_save_deleted AFTER DELETE ON respondent_saves BEGIN
  DELETE FROM retention_notices WHERE kind='save' AND item_id=OLD.session_id;
END;
