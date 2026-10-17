import { ulid } from 'ulid'
import { reportViewLimit, type ReportViewRow, type ReportViewScope } from './model'

const rows = `SELECT v.id,v.name,v.definition_json AS definitionJson,v.cutoff,v.snapshot_json AS snapshotJson,
 v.created_at AS createdAt,o.id AS creatorId,o.display_name AS creatorName
 FROM report_views v JOIN flows f ON f.id=v.flow_id
 LEFT JOIN operators o ON o.id=v.creator_operator_id AND o.workspace_id=f.workspace_id`
const authority = (table = 'report_dashboards') => `EXISTS(SELECT 1 FROM flows f JOIN operators o ON o.workspace_id=f.workspace_id WHERE f.id=${table}.flow_id AND f.workspace_id=? AND o.id=?)`
export class ReportViewRepository {
  constructor(private readonly db: D1Database, private readonly scope: ReportViewScope) {}
  async state() {
    const s = this.scope
    return this.db.prepare(`SELECT d.version,d.erasure_generation AS generation,(SELECT count(*) FROM report_views v WHERE v.flow_id=d.flow_id) AS count
      FROM report_dashboards d WHERE d.flow_id=? AND ${authority('d')}`).bind(s.flowId,s.workspaceId,s.operatorId).first<{version:number;generation:number;count:number}>()
  }
  async dashboard() {
    const s = this.scope
    const result = await this.db.batch([
      this.db.prepare(`SELECT d.version FROM report_dashboards d WHERE d.flow_id=? AND ${authority('d')}`).bind(s.flowId,s.workspaceId,s.operatorId),
      this.db.prepare(`${rows} WHERE v.flow_id=? AND f.workspace_id=? AND EXISTS(SELECT 1 FROM operators WHERE id=? AND workspace_id=f.workspace_id) ORDER BY v.position,v.id`).bind(s.flowId,s.workspaceId,s.operatorId),
    ])
    return { state: result[0].results[0] as {version:number}|undefined, views: result[1].results as ReportViewRow[] }
  }
  async get(id: string) {
    const s = this.scope
    return this.db.prepare(`${rows} WHERE v.id=? AND v.flow_id=? AND f.workspace_id=? AND EXISTS(SELECT 1 FROM operators WHERE id=? AND workspace_id=f.workspace_id)`)
      .bind(id,s.flowId,s.workspaceId,s.operatorId).first<ReportViewRow>()
  }
  private audit(token: string, kind: string, now: string) {
    const s = this.scope
    return this.db.prepare(`INSERT INTO audit_entries(id,workspace_id,kind,actor_operator_id,subject_type,subject_id,details_json,created_at)
      SELECT ?,?,?,?,'flow',flow_id,'{}',? FROM report_dashboards WHERE flow_id=? AND mutation_id=?`)
      .bind(ulid(),s.workspaceId,kind,s.operatorId,now,s.flowId,token)
  }
  async create(input: {id:string;name:string;definition:string;cutoff:string;snapshot:string;now:string;generation:number}) {
    const s = this.scope, token = ulid()
    const result = await this.db.batch([
      this.db.prepare(`UPDATE report_dashboards SET version=version+1,mutation_id=? WHERE flow_id=? AND erasure_generation=? AND ${authority()}
        AND (SELECT count(*) FROM report_views WHERE flow_id=report_dashboards.flow_id)<? RETURNING flow_id`)
        .bind(token,s.flowId,input.generation,s.workspaceId,s.operatorId,reportViewLimit),
      this.db.prepare(`INSERT INTO report_views(id,flow_id,name,definition_json,cutoff,snapshot_json,creator_operator_id,created_at,position)
        SELECT ?,flow_id,?,?,?,?,?,?,COALESCE((SELECT max(position)+1 FROM report_views WHERE flow_id=report_dashboards.flow_id),0)
        FROM report_dashboards WHERE flow_id=? AND mutation_id=?`)
        .bind(input.id,input.name,input.definition,input.cutoff,input.snapshot,s.operatorId,input.now,s.flowId,token),
      this.audit(token,'report_view.created',input.now),
    ])
    return result[0].results.length === 1
  }
  async erase(id: string, now: string) {
    const s = this.scope, token = ulid()
    const result = await this.db.batch([
      this.db.prepare(`UPDATE report_dashboards SET version=version+1,mutation_id=? WHERE flow_id=? AND ${authority()}
        AND EXISTS(SELECT 1 FROM report_views WHERE id=? AND flow_id=report_dashboards.flow_id) RETURNING flow_id`)
        .bind(token,s.flowId,s.workspaceId,s.operatorId,id),
      this.audit(token,'report_view.deleted',now),
      this.db.prepare(`DELETE FROM report_views WHERE id=? AND flow_id=? AND EXISTS(SELECT 1 FROM report_dashboards WHERE flow_id=? AND mutation_id=?)`).bind(id,s.flowId,s.flowId,token),
    ])
    return result[0].results.length === 1
  }
  async arrange(version: number, ids: string[], now: string) {
    const s = this.scope, token = ulid(), encoded = JSON.stringify(ids)
    const result = await this.db.batch([
      this.db.prepare(`UPDATE report_dashboards SET version=version+1,mutation_id=? WHERE flow_id=? AND version=? AND ${authority()}
        AND (SELECT count(*) FROM report_views WHERE flow_id=report_dashboards.flow_id)=?
        AND NOT EXISTS(SELECT 1 FROM json_each(?) j WHERE NOT EXISTS(SELECT 1 FROM report_views v WHERE v.id=j.value AND v.flow_id=report_dashboards.flow_id)) RETURNING flow_id`)
        .bind(token,s.flowId,version,s.workspaceId,s.operatorId,ids.length,encoded),
      this.db.prepare(`UPDATE report_views SET position=(SELECT CAST(key AS INTEGER) FROM json_each(?) WHERE value=report_views.id)
        WHERE flow_id=? AND EXISTS(SELECT 1 FROM report_dashboards WHERE flow_id=? AND mutation_id=?)`).bind(encoded,s.flowId,s.flowId,token),
      this.audit(token,'report_dashboard.arranged',now),
    ])
    return result[0].results.length === 1
  }
}
