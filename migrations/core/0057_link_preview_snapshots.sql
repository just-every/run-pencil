-- Freeze the defaults that pre-preview published revisions would serve on
-- upgrade. Later business-logo edits must not rewrite a published preview.
-- Only operator-authored revision content is read; no respondent data enters
-- this snapshot. The preview renderer removes recall tokens without resolving
-- them, just as it does for newly published preview defaults.
UPDATE flow_revisions
SET policy_snapshot_json = json_set(
  COALESCE(policy_snapshot_json, '{}'),
  '$.linkPreview', json_object(
    'title', title,
    'description', COALESCE((
      SELECT trim(prompt || CASE WHEN helper_text IS NOT NULL AND helper_text <> '' THEN ' ' || helper_text ELSE '' END)
      FROM flow_steps
      WHERE revision_id = flow_revisions.id AND kind = 'welcome'
      ORDER BY position, id LIMIT 1
    ), ''),
    'image', json((
      SELECT CASE
        WHEN w.brand_logo_base64 IS NOT NULL AND w.brand_logo_base64 <> '' AND w.brand_logo_mime IS NOT NULL
        THEN json_object(
          'mime', w.brand_logo_mime,
          'base64', w.brand_logo_base64,
          'alt', CASE WHEN w.brand_configured = 1 THEN w.name ELSE 'Your business' END
        )
        ELSE 'null'
      END
      FROM workspaces w JOIN flows f ON f.workspace_id = w.id
      WHERE f.id = flow_revisions.flow_id
    )),
    'allowIndexing', json('false'),
    'background', '#fbfaf6'
  )
)
WHERE state = 'published'
  -- Imported historical revisions remain private until the operator publishes
  -- the form; leave their reviewed import/undo custody byte-identical.
  AND EXISTS (SELECT 1 FROM flows f WHERE f.id = flow_revisions.flow_id AND f.status <> 'draft')
  AND (json_type(policy_snapshot_json, '$.linkPreview') IS NULL
    OR json_type(policy_snapshot_json, '$.linkPreview') = 'null');
