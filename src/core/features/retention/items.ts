/** Policies also take custody of the existing save expiry so hold cannot be bypassed. */
export const retainedItemsSql = `
  SELECT p.flow_id,'response' AS kind,r.id AS item_id,p.version,
    strftime('%Y-%m-%dT%H:%M:%fZ',r.completed_at,'+'||p.days||' days') AS expires_at
  FROM form_retention p JOIN responses r ON r.flow_id=p.flow_id
  WHERE p.days IS NOT NULL AND p.legal_hold=0
  UNION ALL
  SELECT p.flow_id,'save',s.session_id,p.version,
    CASE WHEN p.days IS NULL THEN s.expires_at ELSE min(s.expires_at,strftime('%Y-%m-%dT%H:%M:%fZ',s.created_at,'+'||p.days||' days')) END
  FROM form_retention p JOIN flow_revisions r ON r.flow_id=p.flow_id JOIN respondent_saves s ON s.revision_id=r.id
  WHERE p.legal_hold=0`

/** Only expiry cleanup uses this guard. Manual erasure remains available on hold. */
export const ungovernedSaveSql = (sessionId:string) => `NOT EXISTS(
  SELECT 1 FROM respondent_saves saved JOIN flow_revisions r ON r.id=saved.revision_id
  JOIN form_retention p ON p.flow_id=r.flow_id WHERE saved.session_id=${sessionId})`
