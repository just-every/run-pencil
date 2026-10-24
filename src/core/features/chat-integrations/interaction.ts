import type { IntegrationConnections } from '../../platform/config/connections'
import { ForbiddenError, NotFoundError, ValidationError } from '../../shared/errors'
import { chatFormSchema } from './model'
import { eligibleChatResponse } from './queue'
import { validSlackSignature } from './signature'

/** A saved owner mapping, a verified Slack actor and a released response are all required. No request can set a verdict. */
export async function createSlackAction(db:D1Database,connections:IntegrationConnections,input:{body:string;timestamp:string|null;signature:string|null},now=new Date().toISOString()) {
  const connection=await connections.slack()
  if(!connection || !await validSlackSignature(connection.signingSecret,input.body,input.timestamp,input.signature,Date.parse(now)))throw new ForbiddenError('A current signed Slack interaction is required.')
  let payload:{type?:string;user?:{id?:string};channel?:{id?:string};actions?:Array<{action_id?:string;value?:string}>}
  try {payload=JSON.parse(new URLSearchParams(input.body).get('payload')??'')}catch{throw new ValidationError('Choose the Create action control on a Pencil response post.')}
  const action=payload.actions?.length===1?payload.actions[0]:undefined
  if(payload.type!=='block_actions'||action?.action_id!=='pencil_create_action'||!action.value||!/^[a-f0-9]{32}$/.test(action.value))throw new ValidationError('Choose the Create action control on a Pencil response post.')
  const row=await db.prepare(`SELECT l.workspace_id AS workspaceId,l.flow_id AS flowId,l.settings_json AS settingsJson,r.revision_id AS revisionId,v.title,v.number,
    (SELECT COUNT(*) FROM responses counted WHERE counted.revision_id=r.revision_id AND counted.state='released') AS completedResponses,
    COALESCE((SELECT starts FROM revision_metric_counters WHERE revision_id=r.revision_id),0) AS starts
    FROM chat_deliveries d JOIN chat_form_links l ON l.id=d.link_id JOIN responses r ON r.id=d.response_id JOIN flow_revisions v ON v.id=r.revision_id
    WHERE d.id=? AND d.idempotency_key NOT LIKE 'chat:alert:%' AND l.platform='slack' AND l.armed=1 AND d.state='confirmed' AND l.updated_at<=d.started_at AND ${eligibleChatResponse}`).bind(action.value)
    .first<{workspaceId:string;flowId:string;settingsJson:string;revisionId:string;title:string;number:number;completedResponses:number;starts:number}>()
  if(!row)throw new NotFoundError('This response post is no longer available for actions.')
  const settings=chatFormSchema.parse(JSON.parse(row.settingsJson))
  if(!settings.action||payload.user?.id!==settings.slackUserId||payload.channel?.id!==settings.channel)throw new ForbiddenError('Only the mapped action owner can use this form’s action control.')
  const operator=await db.prepare(`SELECT id FROM operators o WHERE id=? AND workspace_id=? AND NOT EXISTS(SELECT 1 FROM operator_auth_links l JOIN oa_operators auth ON auth.id=l.auth_id WHERE l.operator_id=o.id AND auth.status='inactive')`).bind(settings.operatorId,row.workspaceId).first()
  if(!operator)throw new ForbiddenError('The mapped action owner is no longer an active workspace operator.')
  const fields=settings.action,metric=fields.metric,id=`chat-action-${action.value}`,eventId=`chat-created-${action.value}`
  const figures=JSON.stringify({flowTitle:row.title,revisionNumber:row.number,completedResponses:row.completedResponses,starts:row.starts})
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO actions(id,workspace_id,title,rationale,owner_operator_id,state,verdict,review_date,source,analysis_id,metric_name,metric_unit,metric_direction,baseline_value,baseline_source,baseline_observed_at,version,last_event_id,created_by_operator_id,created_at,updated_at)
      SELECT ?,l.workspace_id,?,?,?,'planned',NULL,?,'manual',NULL,?,?,?,?,?,?,1,?,?,?,? FROM chat_deliveries d JOIN chat_form_links l ON l.id=d.link_id JOIN responses r ON r.id=d.response_id
      WHERE d.id=? AND l.armed=1 AND l.settings_json=? AND d.state='confirmed' AND l.updated_at<=d.started_at AND ${eligibleChatResponse}
      AND EXISTS(SELECT 1 FROM operators o WHERE o.id=? AND o.workspace_id=l.workspace_id AND NOT EXISTS(SELECT 1 FROM operator_auth_links al JOIN oa_operators auth ON auth.id=al.auth_id WHERE al.operator_id=o.id AND auth.status='inactive'))`)
      .bind(id,fields.title,fields.rationale,settings.operatorId,fields.reviewDate,metric.name,metric.unit,metric.direction,metric.baselineValue,metric.baselineSource,metric.baselineObservedAt,eventId,settings.operatorId,now,now,action.value,row.settingsJson,settings.operatorId),
    db.prepare(`INSERT OR IGNORE INTO action_evidence(action_id,flow_id,revision_id,question_stable_id,figures_json,captured_at) SELECT id,?,?,NULL,?,? FROM actions WHERE id=? AND last_event_id=?`).bind(row.flowId,row.revisionId,figures,now,id,eventId),
    db.prepare(`INSERT OR IGNORE INTO action_events(id,action_id,kind,from_state,to_state,note,changes_json,operator_id,created_at) SELECT ?,id,'created',NULL,'planned',NULL,NULL,?,? FROM actions WHERE id=? AND last_event_id=?`).bind(eventId,settings.operatorId,now,id,eventId),
    db.prepare(`INSERT OR IGNORE INTO chat_interactions(delivery_id,action_id,created_at) SELECT ?,id,? FROM actions WHERE id=? AND last_event_id=?`).bind(action.value,now,id,eventId),
    db.prepare(`INSERT OR IGNORE INTO chat_action_targets(id,action_id,link_id,operator_id,platform,user_id)
      SELECT 'chat-target:'||a.id||':'||l.platform,a.id,l.id,a.owner_operator_id,l.platform,CASE l.platform WHEN 'slack' THEN json_extract(l.settings_json,'$.slackUserId') ELSE json_extract(l.settings_json,'$.teamsUserId') END
      FROM actions a JOIN chat_form_links l ON l.flow_id=? AND l.workspace_id=a.workspace_id WHERE a.id=? AND a.last_event_id=? AND l.armed=1 AND json_extract(l.settings_json,'$.operatorId')=a.owner_operator_id`).bind(row.flowId,id,eventId),
    db.prepare(`INSERT OR IGNORE INTO audit_entries(id,workspace_id,kind,actor_operator_id,subject_type,subject_id,details_json,created_at) SELECT ?,workspace_id,'action.created',?,'action',id,'{"actions":1}',? FROM actions WHERE id=? AND last_event_id=?`).bind(`chat-audit:${action.value}`,settings.operatorId,now,id,eventId),
  ])
  if(!await db.prepare('SELECT 1 FROM chat_interactions WHERE delivery_id=? AND action_id=?').bind(action.value,id).first())throw new ValidationError('The response or its connection changed. Reload the Pencil response post.')
  return {actionId:id}
}
