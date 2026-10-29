import { NotFoundError } from '../../shared/errors'
export class AnalysisAttention {
  constructor(private db:D1Database,private attribution:Record<string,unknown>={}) {}
  attributed(attribution:Record<string,unknown>){return new AnalysisAttention(this.db,attribution)}
  async read(workspaceId:string,operatorId:string) {
    const preference=await this.db.prepare('SELECT muted FROM analysis_attention_preferences WHERE operator_id=?').bind(operatorId).first<{muted:number}>()
    const rows=await this.db.prepare(`SELECT n.run_id AS runId,n.created_at AS createdAt,n.read_at AS readAt,a.state,a.revision_id AS revisionId,r.number AS revisionNumber,f.title AS flowTitle,a.error_message AS errorMessage
      FROM analysis_attention n JOIN analysis_runs a ON a.id=n.run_id JOIN flows f ON f.id=a.flow_id JOIN flow_revisions r ON r.id=a.revision_id
      WHERE n.operator_id=? AND a.workspace_id=? ORDER BY n.created_at DESC,n.run_id DESC LIMIT 100`).bind(operatorId,workspaceId).all()
    return {muted:preference?.muted===1,items:rows.results}
  }
  async mute(operatorId:string,muted:boolean) {
    const write=this.db.prepare('INSERT INTO analysis_attention_preferences(operator_id,muted) VALUES(?,?) ON CONFLICT(operator_id) DO UPDATE SET muted=excluded.muted').bind(operatorId,muted?1:0)
    if(!Object.keys(this.attribution).length){await write.run();return}
    await this.db.batch([write,this.db.prepare(`INSERT INTO audit_entries(id,workspace_id,kind,actor_operator_id,subject_type,subject_id,details_json,created_at) SELECT ?,workspace_id,'analysis.attention_changed',id,'operator',id,?,? FROM operators WHERE id=?`).bind(crypto.randomUUID(),JSON.stringify(this.attribution),new Date().toISOString(),operatorId)])
  }
  async acknowledge(workspaceId:string,operatorId:string,runId:string) {
    const result=await this.db.prepare(`UPDATE analysis_attention SET read_at=COALESCE(read_at,?) WHERE operator_id=? AND run_id=? AND EXISTS(SELECT 1 FROM analysis_runs WHERE id=run_id AND workspace_id=?) RETURNING run_id`).bind(new Date().toISOString(),operatorId,runId,workspaceId).all()
    if(!result.results.length) throw new NotFoundError('This notification is not yours.')
  }
}
