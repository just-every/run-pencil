import type { D1ImportContext, D1Sql } from '../../../base/import-kit/src/d1/index'
import { eraseResponseAndImportCustody, importTargets, mappingVersion } from '../importing'
import { restoreCheckpoint } from '../../platform/restore/checkpoint'
import { responseErasureStatements } from '../responses'
import { retainedItemsSql } from './items'
import type { RetainedItem } from './model'

export async function eraseRetainedItem(db:D1Database,item:RetainedItem,now:string) {
  const policy={sql:'EXISTS(SELECT 1 FROM form_retention WHERE flow_id=? AND version=? AND legal_hold=0)',params:[item.flow_id,item.version]}
  const before:D1Sql={sql:`INSERT INTO ik_d1_assertions(ok) SELECT CASE WHEN (${policy.sql}) AND EXISTS(
    SELECT 1 FROM (${retainedItemsSql}) current JOIN retention_notices n ON n.flow_id=current.flow_id AND n.kind=current.kind AND n.item_id=current.item_id
    WHERE current.flow_id=? AND current.kind=? AND current.item_id=? AND current.version=n.policy_version AND current.expires_at<=? AND n.delete_after<=?) THEN 1 ELSE 0 END`,params:[...policy.params,item.flow_id,item.kind,item.item_id,now,now]}
  const after:D1Sql={sql:`SELECT CASE WHEN (${policy.sql}) THEN 1 ELSE json('RETENTION_POLICY_CHANGED') END`,params:policy.params}
  if(item.kind==='save') {
    await db.batch([
      before,
      {sql:`INSERT INTO audit_entries(id,workspace_id,kind,subject_type,subject_id,details_json,created_at) SELECT ?,workspace_id,'retention.save-erased','flow',id,'{}',? FROM flows WHERE id=?`,params:[crypto.randomUUID(),now,item.flow_id]},
      {sql:`INSERT INTO revision_step_metric_counters(id,revision_id,step_stable_id,reached,dropped,created_at,updated_at)
        SELECT 'step-metric-'||revision_id||'-'||furthest_step_id,revision_id,furthest_step_id,0,1,?,?
        FROM respondent_sessions WHERE id=? AND metric_folded_at IS NULL AND completed_at IS NULL AND furthest_step_id IS NOT NULL
        ON CONFLICT(revision_id,step_stable_id) DO UPDATE SET dropped=dropped+excluded.dropped,updated_at=excluded.updated_at`,params:[now,now,item.item_id]},
      {sql:'DELETE FROM respondent_session_step_events WHERE session_id=?',params:[item.item_id]},
      {sql:'DELETE FROM respondent_sessions WHERE id=?',params:[item.item_id]},
      {sql:'DELETE FROM respondent_saves WHERE session_id=?',params:[item.item_id]},
      restoreCheckpoint,
      {sql:'DELETE FROM ik_d1_assertions'},after,
    ].map(s=>db.prepare(s.sql).bind(...s.params ?? [])))
    return
  }
  const response=await db.prepare('SELECT workspace_id,state FROM responses WHERE id=? AND flow_id=?').bind(item.item_id,item.flow_id).first<{workspace_id:string;state:'released'|'quarantined'}>()
  if(!response)return
  // The custody library rechecks this live predicate in every read and write.
  // There is no fabricated operator/session and HTTP cannot supply this context.
  const authority:D1ImportContext={destination:response.workspace_id,namespace:'retention-erasure',mappingVersion,
    storage:{database:db,targets:importTargets},batchSize:10,maxBatches:1,
    authorization:{principalId:'scheduled-retention',predicate:(_action,destination)=>({sql:`?=? AND (${policy.sql})`,params:[destination,response.workspace_id,...policy.params]})}}
  const writes=responseErasureStatements({workspaceId:response.workspace_id,responseId:item.item_id,operatorId:null,now,state:response.state,feature:'retention'},crypto.randomUUID())
  await eraseResponseAndImportCustody(db,{workspaceId:response.workspace_id,responseId:item.item_id,operatorId:'scheduled-retention',retentionAuthority:authority},[before,...writes,after])
}
