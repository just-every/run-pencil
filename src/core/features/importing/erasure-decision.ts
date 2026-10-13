import { canonicalJson, sha256, type D1Sql } from '../../../base/import-kit/src/d1/index'
import { importContext } from './service'

type ErasureInput = { workspaceId: string; responseId: string; operatorId: string; sessionId?: string }
/** Ordinary response erasure cannot adopt a changed source or bypass any
 * published, private, native-marker or not-yet-indexed import custody. */
export function ordinaryErasureGuards(database: D1Database, input: ErasureInput, source: string | undefined): { before: D1Sql; after: D1Sql; final: D1Sql } {
  const identity = sha256(canonicalJson([input.workspaceId, 'response', input.responseId]))
  const custody = `NOT EXISTS(SELECT 1 FROM form_import_targets WHERE target_id=?)
    AND NOT EXISTS(SELECT 1 FROM form_import_native_epochs WHERE target_id=?)
    AND NOT EXISTS(SELECT 1 FROM ik_targets WHERE destination=? AND kind='response' AND id=?)
    AND NOT EXISTS(SELECT 1 FROM ik_d1_plan_index i JOIN ik_jobs j ON j.id=i.job_id WHERE j.destination=? AND i.target_identity=?)
    AND NOT EXISTS(SELECT 1 FROM ik_d1_staging_index i JOIN ik_d1_staging s ON s.id=i.stage_id WHERE s.destination=? AND i.target_identity=?)
    AND NOT EXISTS(SELECT 1 FROM ik_d1_native_staging_index i JOIN ik_d1_native_staging s ON s.id=i.stage_id WHERE s.destination=? AND i.target_identity=?)
    AND NOT EXISTS(SELECT 1 FROM ik_jobs j LEFT JOIN ik_d1_indexed_jobs x ON x.job_id=j.id WHERE j.destination=? AND (x.job_id IS NULL OR x.fingerprint<>j.fingerprint))`
  const custodyParams = [input.responseId, input.responseId, input.workspaceId, input.responseId, input.workspaceId, identity, input.workspaceId, identity, input.workspaceId, identity, input.workspaceId]
  const authority = input.sessionId ? importContext(database, { id: input.sessionId, workspaceId: input.workspaceId, operatorId: input.operatorId }, 'response-erasure').authorization.predicate('erase', input.workspaceId) : undefined
  // A concurrent successful erasure leaves no row. Its retry still checks
  // custody and current authority, then returns the native zero-change result.
  const make = (final = false): D1Sql => {
    const absent = final || source === undefined
    const decision = absent ? 'NOT EXISTS(SELECT 1 FROM responses WHERE id=? AND workspace_id=?)'
      : 'NOT EXISTS(SELECT 1 FROM responses WHERE id=? AND workspace_id=? AND source IS NOT ?)'
    return { sql: `${final ? 'SELECT' : 'INSERT INTO ik_d1_assertions(ok) SELECT'} CASE WHEN (${decision}) AND (${custody})${authority ? ` AND (${authority.sql})` : ''} THEN 1 ELSE ${final ? "json('IMPORT_FINAL_GUARD')" : '0'} END`,
      params: [input.responseId, input.workspaceId, ...(absent ? [] : [source]), ...custodyParams, ...authority?.params ?? []] }
  }
  return { before: make(), after: make(), final: make(true) }
}
