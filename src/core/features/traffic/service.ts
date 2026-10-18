import { issueLoadTime } from './loadTime'
import { trafficDay } from '../../shared/trafficDay'
import { NotFoundError, ValidationError } from '../../shared/errors'
import type { CollectorService } from '../collectors'
import type { ResponseService } from '../responses'
import type { FlowService } from '../flows'

export type TrafficRow={source:string;day:string;views:number;starts:number;submissions:number;label:string}
export class TrafficService {
  constructor(private readonly db:D1Database,private readonly flows:FlowService,private readonly responses:ResponseService,private readonly collectors:CollectorService,private readonly loadTimeSecret:string){}
  async view(input:{slug:string;revisionId:string;source:'direct'|'embed';collectorKey?:string;invitationToken?:string;accessToken?:string}) {
    const invitation=input.invitationToken?await this.responses.invitationFlow(input.invitationToken,input.accessToken):undefined
    const publicFlow=invitation?.publicFlow??await this.flows.getPublicFlow(input.slug,input.accessToken)
    if(publicFlow.flow.slug!==input.slug || publicFlow.revision.id!==input.revisionId || invitation?.invitation.responseStatus==='completed')throw new ValidationError('This published form is no longer available for a new view.')
    if(input.invitationToken&&input.collectorKey)throw new ValidationError('An invitation uses its original collector.')
    const collector=invitation?.collector??await this.collectors.requireOpen(publicFlow.flow.id,input.source,input.collectorKey)
    const source=collector.systemSource===null?'collector:'+collector.id:invitation?'invitation':input.source
    return this.count(publicFlow.flow.id,input.revisionId,source)
  }
  /** Called only after the resume route has resolved and admitted the saved response. */
  async resumedView(sessionId:string,flowId:string,revisionId:string) {
    const row=await this.db.prepare(`SELECT CASE WHEN c.system_source IS NULL THEN 'collector:' || c.id ELSE s.source END AS source FROM respondent_sessions s JOIN session_collector sc ON sc.session_id=s.id JOIN collectors c ON c.id=sc.collector_id WHERE s.id=?`).bind(sessionId).first<{source:string}>()
    if(!row)throw new ValidationError('This saved form has no retained traffic source.')
    return this.count(flowId,revisionId,row.source)
  }
  private async count(flowId:string,revisionId:string,source:string) {
    const workspace=await this.db.prepare('SELECT w.time_zone AS zone FROM workspaces w JOIN flows f ON f.workspace_id=w.id WHERE f.id=?').bind(flowId).first<{zone:string}>()
    if(!workspace)throw new NotFoundError('This form is no longer available.')
    const at=Date.now(), day=trafficDay(new Date(at).toISOString(),workspace.zone)
    await this.db.batch([this.db.prepare('INSERT OR IGNORE INTO traffic_tracking(id,started_at) VALUES(1,?)').bind(new Date(at).toISOString()),this.db.prepare(`INSERT INTO revision_view_counters(revision_id,source,day,count) VALUES (?,?,?,1)
      ON CONFLICT(revision_id,source,day) DO UPDATE SET count=count+1`).bind(revisionId,source,day)])
    return {loadTime:await issueLoadTime(this.loadTimeSecret,revisionId,at)}
  }

  async report(workspaceId:string,flowId:string,revisionId:string,from?:string,to?:string) {
    const flow=await this.db.prepare(`SELECT f.id,w.time_zone AS zone FROM flows f JOIN workspaces w ON w.id=f.workspace_id JOIN flow_revisions r ON r.flow_id=f.id WHERE f.id=? AND f.workspace_id=? AND r.id=? AND r.state='published'`).bind(flowId,workspaceId,revisionId).first<{id:string;zone:string}>()
    if(!flow)throw new NotFoundError('This published revision is not available in your workspace.')
    if(from&&to&&from>to)throw new ValidationError('The start date must be on or before the end date.')
    const rows=await this.db.prepare(`WITH counts AS (
      SELECT source,day,count AS views,0 AS starts,0 AS submissions FROM revision_view_counters WHERE revision_id=?
      UNION ALL SELECT source,day,0,count,0 FROM revision_start_counters WHERE revision_id=?
      UNION ALL SELECT t.source,t.day,0,0,COUNT(*) FROM response_traffic t JOIN responses r ON r.id=t.response_id WHERE r.revision_id=? AND r.state='released' GROUP BY t.source,t.day
    ) SELECT source,day,SUM(views) AS views,SUM(starts) AS starts,SUM(submissions) AS submissions FROM counts WHERE (? IS NULL OR day>=?) AND (? IS NULL OR day<=?) GROUP BY source,day ORDER BY day DESC,source LIMIT 1001`).bind(revisionId,revisionId,revisionId,from??null,from??null,to??null,to??null).all<Omit<TrafficRow,'label'>>()
    if(rows.results.length>1000)throw new ValidationError('Choose a shorter traffic date range (at most 1,000 source/day rows).')
    const collectors=(await this.db.prepare('SELECT id,name FROM collectors WHERE flow_id=?').bind(flowId).all<{id:string;name:string}>()).results
    const labels:Record<string,string>={direct:'Public link',embed:'Embed',invitation:'Invitation'}
    const labeled=rows.results.map(row=>({...row,label:row.source.startsWith('collector:')?collectors.find(c=>c.id===row.source.slice(10))?.name??'Retained collector':labels[row.source]??row.source}))
    const totals=labeled.reduce((sum,row)=>({views:sum.views+row.views,starts:sum.starts+row.starts,submissions:sum.submissions+row.submissions}),{views:0,starts:0,submissions:0})
    const tracking=await this.db.prepare('SELECT started_at AS startedAt FROM traffic_tracking WHERE id=1').first<{startedAt:string}>()
    return {rows:labeled,totals,startedAt:tracking?.startedAt??null,timeZone:flow.zone}
  }
}
