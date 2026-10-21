import { admittedResponseSql } from '../payments/admission'
import { bindInvitationCollectorSql, collectorAdmissionSql, invitationCollectorAdmissionSql, collectorId as collectorIdSchema, throwCollectorAdmissionFailure, type CollectorService } from '../collectors'
import { ulid } from 'ulid'
import { audienceEligibility, defaultDistributionPolicies, reminderDelayHours, type DistributionPolicies } from '../../shared/distributionPolicies'
import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors'
import { DistributionSegments } from './segments'
import { contactLimits } from './contact-model'
type LaunchRow={id:string;revisionId:string;commandKey:string;resumeEnabled:number;collectorId:string|null}
export class InvitationLaunches {
  constructor(private readonly db: D1Database, private readonly policies: DistributionPolicies = defaultDistributionPolicies, private readonly collectors: CollectorService) {}
  async commandComplete(workspaceId:string,commandKey:string) {
    const row=await this.db.prepare('SELECT id,revision_id AS revisionId,command_key AS commandKey,resume_enabled AS resumeEnabled,(SELECT collector_id FROM invitation_launch_collector WHERE launch_id=invitation_launches.id) AS collectorId FROM invitation_launches WHERE workspace_id=? AND command_key=?').bind(workspaceId,commandKey).first<LaunchRow>()
    return row ? (await this.summary(row)).complete : false
  }
  async summary(row:LaunchRow) {
    if(!row.collectorId) throw new ValidationError('This invitation launch is missing its collector attribution.')
    const outcomes=(await this.db.prepare('SELECT outcome,count(*) n FROM invitation_candidates WHERE launch_id=? GROUP BY outcome').bind(row.id).all<{outcome:string;n:number}>()).results
    const counts={invited:0,alreadyInvited:0,optedOut:0,noAddress:0,policyExcluded:0,pending:0}
    for(const entry of outcomes) counts[entry.outcome as keyof typeof counts]=entry.n
    if(!outcomes.length) counts.invited=(await this.db.prepare('SELECT count(*) n FROM invitation_participants WHERE launch_id=?').bind(row.id).first<{n:number}>())!.n
    const complete=counts.pending===0
    const {resumeEnabled,...identity}=row
    return {...identity,complete,resumable:!complete&&!!resumeEnabled,state:complete?'complete' as const:resumeEnabled?'processing' as const:'recovery-required' as const,counts}
  }
  async history(workspaceId:string,flowId:string) {
    const rows=(await this.db.prepare('SELECT l.id,l.revision_id AS revisionId,l.command_key AS commandKey,resume_enabled AS resumeEnabled,(SELECT collector_id FROM invitation_launch_collector WHERE launch_id=l.id) AS collectorId FROM invitation_launches l JOIN flow_revisions r ON r.id=l.revision_id WHERE l.workspace_id=? AND r.flow_id=? ORDER BY l.created_at DESC').bind(workspaceId,flowId).all<LaunchRow>()).results
    return Promise.all(rows.map(row=>this.summary(row)))
  }
  async launch(input: { workspaceId: string; flowId: string; contactIds?: string[]; segmentId?:string; commandKey: string; operatorId: string; collectorId?: string }) {
    if(input.collectorId!==undefined&&!collectorIdSchema.safeParse(input.collectorId).success) throw new ValidationError('Choose a valid collector.')
    let row = await this.db.prepare('SELECT id, revision_id AS revisionId,command_key AS commandKey,resume_enabled AS resumeEnabled,(SELECT collector_id FROM invitation_launch_collector WHERE launch_id=invitation_launches.id) AS collectorId FROM invitation_launches WHERE workspace_id = ? AND command_key = ?').bind(input.workspaceId, input.commandKey).first<LaunchRow>()
    if (!row) {
      if(!!input.contactIds===!!input.segmentId) throw new ValidationError('Choose contacts or a segment for a new launch.')
      const ids=input.segmentId?await new DistributionSegments(this.db).ids(input.workspaceId,input.segmentId):input.contactIds??[]
      if(ids.length>contactLimits.participantsPerRevision||new Set(ids).size!==ids.length) throw new ValidationError('Choose 1–25000 distinct contacts.')
      const now=new Date().toISOString(),id=ulid(),audience=audienceEligibility(this.policies)
      const revision=await this.db.prepare(`SELECT r.id FROM flow_revisions r JOIN flows f ON f.id=r.flow_id WHERE f.workspace_id=? AND f.id=? AND f.status='open' AND r.is_current=1 AND r.state='published' AND r.admission_closed_at IS NULL AND (r.deadline_at IS NULL OR r.deadline_at>?) AND (r.target_completed_responses IS NULL OR (SELECT count(*) FROM responses admitted WHERE admitted.revision_id=r.id AND ${admittedResponseSql('admitted')})<r.target_completed_responses)`).bind(input.workspaceId,input.flowId,now).first<{id:string}>()
      if(!revision) throw new NotFoundError('This flow has no open published revision.')
      const collector=input.collectorId===undefined
        ? await this.collectors.requireOpen(input.flowId,'invitation')
        : await this.collectors.requireByIdOpen(input.workspaceId,input.flowId,input.collectorId,'invitation')
      const collectorOpen=collectorAdmissionSql('?','?',now,"'invitation'")
      const owned=await this.db.prepare('SELECT count(*) n FROM distribution_contacts WHERE workspace_id=? AND id IN (SELECT value FROM json_each(?))').bind(input.workspaceId,JSON.stringify(ids)).first<{n:number}>()
      if(owned?.n!==ids.length) throw new NotFoundError('A selected contact is not in your workspace.')
      const settings=await this.db.prepare('SELECT reminder_delay_hours AS delay FROM workspaces WHERE id=?').bind(input.workspaceId).first<{delay:number|null}>()
      const delay=settings?.delay??reminderDelayHours(this.policies)
      const policy={ 'flow.audience-eligibility.v1':audience,'flow.reminder-schedule.v1':{delayHours:delay},reminderDelayHours:delay,admission:'one-completion',identity:'identified',participantIds:[] }
      try { await this.db.batch([
        this.db.prepare(`INSERT OR IGNORE INTO invitation_launches(id,workspace_id,revision_id,command_key,policy_json,actor_operator_id,created_at,resume_enabled)
          SELECT ?,?,?,?,?,(SELECT id FROM operators WHERE id=? AND workspace_id=?),?,1 WHERE ${collectorOpen.sql}`)
          .bind(id,input.workspaceId,revision.id,input.commandKey,JSON.stringify(policy),input.operatorId,input.workspaceId,now,collector.id,input.flowId,...collectorOpen.params),
        ...bindInvitationCollectorSql({launchId:id,collectorId:collector.id,flowId:input.flowId,now}).map(statement=>this.db.prepare(statement.sql).bind(...statement.params)),
        this.db.prepare(`INSERT INTO invitation_candidates(id,launch_id,contact_id,email_snapshot,name_snapshot,outcome)
          SELECT substr(hex(randomblob(16)),1,26),?,c.id,c.email,c.name,
          CASE WHEN c.opted_out_at IS NOT NULL THEN 'optedOut' WHEN length(trim(c.email))=0 THEN 'noAddress'
          WHEN EXISTS(SELECT 1 FROM invitation_participants WHERE revision_id=? AND contact_id=c.id)
           OR EXISTS(SELECT 1 FROM invitation_candidates x JOIN invitation_launches l ON l.id=x.launch_id WHERE l.revision_id=? AND x.contact_id=c.id AND x.outcome IN ('pending','invited')) THEN 'alreadyInvited'
          WHEN ?=1 AND EXISTS(SELECT 1 FROM invitation_participants p JOIN flow_revisions r ON r.id=p.revision_id WHERE r.flow_id=? AND p.contact_id=c.id) THEN 'policyExcluded' ELSE 'pending' END
          FROM distribution_contacts c WHERE c.workspace_id=? AND c.id IN(SELECT value FROM json_each(?)) AND EXISTS(SELECT 1 FROM invitation_launches WHERE id=?)`).bind(id,revision.id,revision.id,audience.excludePreviouslyInvitedToFlow?1:0,input.flowId,input.workspaceId,JSON.stringify(ids),id),
        this.db.prepare(`UPDATE flow_revisions SET invitation_reserved_count=invitation_reserved_count+(SELECT count(*) FROM invitation_candidates WHERE launch_id=? AND outcome='pending') WHERE id=?`).bind(id,revision.id),
        this.db.prepare(`UPDATE invitation_launches SET policy_json=json_set(policy_json,'$.participantIds',json((SELECT json_group_array(id) FROM invitation_candidates WHERE launch_id=? AND outcome='pending'))) WHERE id=?`).bind(id,id),
        this.db.prepare(`INSERT INTO audit_entries(id,workspace_id,kind,actor_operator_id,subject_type,subject_id,details_json,created_at) SELECT ?,workspace_id,'audience.launched',actor_operator_id,'launch',NULL,json_object('selected',?,'eligible',(SELECT count(*) FROM invitation_candidates WHERE launch_id=? AND outcome='pending')),? FROM invitation_launches WHERE id=?`).bind(ulid(),ids.length,id,now,id),
      ]) } catch(error) { if(String(error).includes('invitation_reserved_count')) throw new ValidationError('Participant limit reached for this revision.');throwCollectorAdmissionFailure(error) }
      row=(await this.db.prepare('SELECT id,revision_id AS revisionId,command_key AS commandKey,resume_enabled AS resumeEnabled,(SELECT collector_id FROM invitation_launch_collector WHERE launch_id=invitation_launches.id) AS collectorId FROM invitation_launches WHERE workspace_id=? AND command_key=?').bind(input.workspaceId,input.commandKey).first<LaunchRow>())!
      if(!row) {
        await this.collectors.requireByIdOpen(input.workspaceId,input.flowId,collector.id,'invitation')
        throw new ConflictError('This invitation launch could not be created. Reload and try again.')
      }
    }
    // Validate the authoritative row after insert-or-ignore as well as on replay.
    const revision=await this.db.prepare('SELECT flow_id FROM flow_revisions WHERE id=?').bind(row.revisionId).first<{flow_id:string}>()
    if(revision?.flow_id!==input.flowId) throw new ValidationError('This launch key belongs to another flow.')
    if(!row.collectorId) throw new ValidationError('This invitation launch is missing its collector attribution.')
    if(input.collectorId!==undefined&&input.collectorId!==row.collectorId) throw new ValidationError('This launch key already belongs to a different collector.')
    const frozenCollectorId=row.collectorId
    if(!row.resumeEnabled) {
      const saved=await this.summary(row)
      if(!saved.complete) throw new ValidationError('Restored unfinished launches cannot resume. Publish a new revision and start a new launch.')
      return saved
    }
    const saved=await this.summary(row)
    if(saved.complete) return saved
    await this.collectors.requireByIdOpen(input.workspaceId,input.flowId,frozenCollectorId,'invitation')
    // Ten bounded transactions per request. The same command resumes the durable selection.
    for(let chunk=0;chunk<10;chunk++) {
      const now=new Date().toISOString()
      const collectorOpen=invitationCollectorAdmissionSql('l.id','v.flow_id',now)
      const result=await this.db.batch([
        this.db.prepare(`INSERT OR IGNORE INTO invitation_participants(id,launch_id,workspace_id,revision_id,contact_id,email_snapshot,name_snapshot,token,opt_out_token,delivery_status,response_status,created_at)
          SELECT c.id,l.id,l.workspace_id,l.revision_id,c.contact_id,c.email_snapshot,c.name_snapshot,lower(hex(randomblob(32))),lower(hex(randomblob(32))),'queued','not-started',?
          FROM invitation_candidates c JOIN invitation_launches l ON l.id=c.launch_id JOIN flow_revisions v ON v.id=l.revision_id
          WHERE c.launch_id=? AND c.outcome='pending' AND ${collectorOpen.sql} ORDER BY c.id LIMIT 100`).bind(now,row.id,...collectorOpen.params),
        this.db.prepare(`INSERT OR IGNORE INTO mail_deliveries(id,participant_id,kind,status,idempotency_key,available_at,created_at,updated_at)
          SELECT substr(hex(randomblob(16)),1,26),p.id,'invitation','pending','invitation:'||p.id,?,?,? FROM invitation_participants p JOIN invitation_candidates c ON c.id=p.id WHERE c.launch_id=? AND c.outcome='pending'`).bind(now,now,now,row.id),
        this.db.prepare("UPDATE invitation_candidates SET outcome='invited' WHERE launch_id=? AND outcome='pending' AND EXISTS(SELECT 1 FROM invitation_participants WHERE id=invitation_candidates.id)").bind(row.id),
      ])
      if(!result[2].meta.changes) break
    }
    const completed=await this.summary(row)
    if(!completed.complete) await this.collectors.requireByIdOpen(input.workspaceId,input.flowId,frozenCollectorId,'invitation')
    return completed
  }
  async list(workspaceId: string, flowId: string) {
    if (!await this.db.prepare('SELECT id FROM flows WHERE id = ? AND workspace_id = ?').bind(flowId, workspaceId).first()) throw new NotFoundError('This flow is not in your workspace.')
    return (await this.db.prepare(`SELECT p.id, p.name_snapshot AS name, p.email_snapshot AS email, p.revision_id AS revisionId,
      p.delivery_status AS deliveryStatus, p.response_status AS responseStatus, c.opted_out_at AS optedOutAt,
      d.id AS deliveryId, d.kind, d.status, d.reason, d.attempts, d.available_at AS availableAt FROM invitation_participants p
      JOIN flow_revisions r ON r.id = p.revision_id LEFT JOIN distribution_contacts c ON c.id = p.contact_id
      JOIN mail_deliveries d ON d.participant_id = p.id WHERE p.workspace_id = ? AND r.flow_id = ? ORDER BY p.created_at DESC, d.kind`)
      .bind(workspaceId, flowId).all()).results
  }
}
