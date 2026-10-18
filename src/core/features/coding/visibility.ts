/** Disclosure is recalculated over retained released members, never trusted from provider counts. */
export const visibleSuggestion = `ar.state='completed' AND ar.redacted_at IS NULL AND ar.workspace_id=r.workspace_id
  AND ar.flow_id=r.flow_id AND ar.revision_id=r.revision_id
  AND EXISTS (SELECT 1 FROM analysis_evidence e WHERE e.run_id=aq.run_id AND e.response_id=r.id)
  AND EXISTS (SELECT 1 FROM analysis_theme_members m WHERE m.theme_id=aq.theme_id AND m.run_id=aq.run_id AND m.response_id=r.id)
  AND (SELECT count(*) FROM analysis_theme_members m JOIN responses mr ON mr.id=m.response_id
    WHERE m.theme_id=aq.theme_id AND m.run_id=aq.run_id AND mr.workspace_id=ar.workspace_id AND mr.state='released' AND mr.completed_at IS NOT NULL)
    >= json_extract(ar.policy_json,'$.disclosure.threshold')`

/** Accepted provenance stops being reportable when its source finding is withheld. */
export const activeAssignment = `(ca.source='manual' OR EXISTS (SELECT 1 FROM analysis_quotes aq JOIN analysis_runs ar ON ar.id=aq.run_id
  WHERE aq.id=ca.quote_id AND aq.response_id=r.id AND ${visibleSuggestion}))`
