ALTER TABLE workspaces ADD COLUMN brand_configured INTEGER NOT NULL DEFAULT 0 CHECK (brand_configured IN (0, 1));
ALTER TABLE workspaces ADD COLUMN brand_supporting_line TEXT NOT NULL DEFAULT '';
ALTER TABLE workspaces ADD COLUMN brand_accent TEXT NOT NULL DEFAULT '#d4d4d4';
ALTER TABLE workspaces ADD COLUMN brand_logo_base64 TEXT;
ALTER TABLE workspaces ADD COLUMN brand_logo_mime TEXT CHECK (brand_logo_mime IN ('image/png', 'image/jpeg', 'image/webp'));
ALTER TABLE workspaces ADD COLUMN brand_logo_version TEXT;
ALTER TABLE workspaces ADD COLUMN public_flow_slug TEXT;
