import { ConflictError, NotFoundError } from '../../shared/errors'
import type { RetentionPolicy, RetentionState, PolicyRow } from './model'

export class RetentionPolicies {
  constructor(private readonly db:D1Database) {}
  async read(workspaceId:string,flowId:string):Promise<RetentionState> {
    if(!await this.db.prepare('SELECT 1 FROM flows WHERE id=? AND workspace_id=?').bind(flowId,workspaceId).first())throw new NotFoundError('This form does not exist.')
    const row=await this.db.prepare('SELECT * FROM form_retention WHERE flow_id=?').bind(flowId).first<PolicyRow>()
    const workspace=await this.db.prepare('SELECT time_zone FROM workspaces WHERE id=?').bind(workspaceId).first<{time_zone:string}>()
    const totals=await this.db.prepare(`SELECT sum(kind='response') AS responses,sum(kind='save') AS saves,min(delete_after) AS earliestDeletion FROM retention_notices WHERE flow_id=?`).bind(flowId).first<{responses:number|null;saves:number|null;earliestDeletion:string|null}>()
    return {flowId,timeZone:workspace!.time_zone,days:row?.days ?? null,legalHold:!!row?.legal_hold,version:row?.version ?? 0,notices:{responses:totals?.responses ?? 0,saves:totals?.saves ?? 0,earliestDeletion:totals?.earliestDeletion ?? null}}
  }
  async save(workspaceId:string,operatorId:string,input:RetentionPolicy,now:string) {
    await this.read(workspaceId,input.flowId)
    const changeId=crypto.randomUUID()
    const results=await this.db.batch([
      this.db.prepare(`INSERT INTO form_retention(flow_id,days,legal_hold,version,change_id,created_at,updated_at)
        SELECT id,?,?,1,?,?,? FROM flows WHERE id=? AND workspace_id=? AND (?=0 OR EXISTS(SELECT 1 FROM form_retention WHERE flow_id=flows.id AND version=?))
        ON CONFLICT(flow_id) DO UPDATE SET days=excluded.days,legal_hold=excluded.legal_hold,version=form_retention.version+1,change_id=excluded.change_id,updated_at=excluded.updated_at
        WHERE form_retention.version=? RETURNING version`).bind(input.days,input.legalHold?1:0,changeId,now,now,input.flowId,workspaceId,input.version,input.version,input.version),
      this.db.prepare(`DELETE FROM retention_notices WHERE flow_id=? AND EXISTS(SELECT 1 FROM form_retention WHERE flow_id=? AND change_id=?)`).bind(input.flowId,input.flowId,changeId),
      this.db.prepare(`INSERT INTO audit_entries(id,workspace_id,kind,actor_operator_id,subject_type,subject_id,details_json,created_at)
        SELECT ?,?,'retention.updated',?,'flow',flow_id,json_object('days',days,'legalHold',legal_hold),? FROM form_retention WHERE flow_id=? AND change_id=?`).bind(changeId,workspaceId,operatorId,now,input.flowId,changeId),
    ])
    if(!results[0].results.length)throw new ConflictError('Retention settings changed. Reload and try again.')
  }
}
