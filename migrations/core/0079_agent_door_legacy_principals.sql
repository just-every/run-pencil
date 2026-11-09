-- Before 0.2.104, Business credentials saved consent but no principal source.
-- Local credentials never carry consent. Restore only that missing provenance
-- on held Business calls so the existing execution-time stop guard applies.
-- Do not infer a Business from today's pairing or rewrite historical audits.
UPDATE agent_door_approvals
SET saved=json_set(saved,'$.principal.source','business')
WHERE state='pending'
  AND json_type(saved,'$.principal')='object'
  AND json_extract(saved,'$.principal.source') IS NULL
  AND json_type(saved,'$.principal.consent')='text'
  AND length(trim(json_extract(saved,'$.principal.consent')))>0;
