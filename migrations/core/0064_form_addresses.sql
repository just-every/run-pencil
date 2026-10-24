-- Public addresses are installation-wide; retired addresses remain reserved.
CREATE UNIQUE INDEX flows_public_slug ON flows(slug);
CREATE TABLE form_address_aliases (
  slug TEXT PRIMARY KEY NOT NULL,
  flow_id TEXT NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  retired_at TEXT NOT NULL
);
CREATE INDEX form_address_aliases_flow ON form_address_aliases(flow_id);
CREATE TRIGGER refuse_retired_form_address_insert BEFORE INSERT ON flows
WHEN EXISTS (SELECT 1 FROM form_address_aliases WHERE slug=NEW.slug)
BEGIN SELECT RAISE(IGNORE); END;
CREATE TRIGGER refuse_retired_form_address_update BEFORE UPDATE OF slug ON flows
WHEN NEW.slug<>OLD.slug AND EXISTS (SELECT 1 FROM form_address_aliases WHERE slug=NEW.slug)
BEGIN SELECT RAISE(ABORT, 'That form address is retired.'); END;
CREATE TRIGGER retain_form_address AFTER UPDATE OF slug ON flows WHEN NEW.slug<>OLD.slug
BEGIN
  INSERT INTO form_address_aliases(slug,flow_id,retired_at) VALUES(OLD.slug,OLD.id,NEW.updated_at);
  UPDATE workspaces SET public_flow_slug=NEW.slug WHERE public_flow_slug=OLD.slug;
END;
