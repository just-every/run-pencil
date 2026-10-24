import type { IntegrationConnections } from '../../platform/config/connections'
import { NotFoundError, ValidationError } from '../../shared/errors'
import { insideSendingWindow, nextSendingInstant } from '../distribution'
import { createSlackAction } from './interaction'
import { chatFormSchema, safeSummaryTypes, type ChatFormLink, type ChatFormSettings, type ChatPlatform } from './model'
import { eligibleChatAction, eligibleChatResponse, materializeChatReminders, materializeChatResponses } from './queue'
import { postChat, type ChatMessage } from './transport'

type Due={id:string;linkId:string;responseId:string|null;targetId:string|null;kind:string;dueDate:string|null;reviewDate:string|null;key:string;attempts:number;settingsJson:string;workspaceId:string;flowId:string;platform:ChatPlatform}
const selection=`d.id,d.link_id AS linkId,d.response_id AS responseId,d.action_target_id AS targetId,d.kind,d.due_date AS dueDate,d.review_date AS reviewDate,d.idempotency_key AS key,d.attempts,l.settings_json AS settingsJson,l.workspace_id AS workspaceId,l.flow_id AS flowId,l.platform`
const timing:Record<string,string>={before:'Action review in three days',on_date:'Action review today',overdue:'Action review overdue'}

export class ChatIntegrations {
  constructor(private db:D1Database,private connections:IntegrationConnections,private configuration:{origin:string;local:boolean}){}
  private async owned(workspaceId:string,flowId:string){if(!await this.db.prepare('SELECT 1 FROM flows WHERE id=? AND workspace_id=?').bind(flowId,workspaceId).first())throw new NotFoundError('This form is not in your workspace.')}
  async list(workspaceId:string,flowId:string):Promise<ChatFormLink[]>{
    await this.owned(workspaceId,flowId)
    const rows=await this.db.prepare('SELECT id,settings_json AS settingsJson,armed FROM chat_form_links WHERE workspace_id=? AND flow_id=? ORDER BY platform').bind(workspaceId,flowId).all<{id:string;settingsJson:string;armed:number}>()
    return rows.results.map(row=>({...chatFormSchema.parse(JSON.parse(row.settingsJson)),id:row.id,armed:!!row.armed}))
  }
  async save(workspaceId:string,flowId:string,input:ChatFormSettings){
    await this.owned(workspaceId,flowId)
    const settings=chatFormSchema.parse(input)
    if(settings.platform==='slack'?!await this.connections.slack():!await this.connections.teams())throw new ValidationError('Ask the owner to connect this chat service in Settings first.')
    const owner=await this.db.prepare(`SELECT 1 FROM operators o WHERE o.id=? AND o.workspace_id=? AND NOT EXISTS(SELECT 1 FROM operator_auth_links l JOIN oa_operators auth ON auth.id=l.auth_id WHERE l.operator_id=o.id AND auth.status='inactive')`).bind(settings.operatorId,workspaceId).first()
    if(!owner)throw new ValidationError('Choose an active workspace operator as the action owner.')
    const fields=await this.db.prepare(`SELECT s.stable_id AS id,s.question_type AS type FROM flow_steps s JOIN flow_revisions v ON v.id=s.revision_id WHERE v.flow_id=? AND v.state='draft' AND s.kind='question'`).bind(flowId).all<{id:string;type:string}>()
    for(const id of settings.answerStepIds){const field=fields.results.find(field=>field.id===id);if(!field||!safeSummaryTypes.has(field.type))throw new ValidationError('Sensitive or free-text fields cannot be posted to chat. Select only closed choices, ratings, yes/no or numeric questions.')}
    const now=new Date().toISOString(),existing=await this.db.prepare('SELECT id FROM chat_form_links WHERE flow_id=? AND platform=?').bind(flowId,settings.platform).first<{id:string}>(),id=existing?.id??crypto.randomUUID()
    await this.db.batch([
      this.db.prepare(`INSERT INTO chat_form_links(id,workspace_id,flow_id,platform,settings_json,armed,updated_at) VALUES(?,?,?,?,?,1,?) ON CONFLICT(flow_id,platform) DO UPDATE SET settings_json=excluded.settings_json,armed=1,updated_at=excluded.updated_at`).bind(id,workspaceId,flowId,settings.platform,JSON.stringify(settings),now),
      this.db.prepare(`UPDATE chat_deliveries SET state='cancelled',reason='The form’s chat settings changed. Retained work is not replayed.',updated_at=? WHERE link_id=? AND state='pending'`).bind(now,id),
    ])
    return this.list(workspaceId,flowId)
  }
  async remove(workspaceId:string,flowId:string,platform:ChatPlatform){await this.owned(workspaceId,flowId);await this.db.prepare('DELETE FROM chat_form_links WHERE workspace_id=? AND flow_id=? AND platform=?').bind(workspaceId,flowId,platform).run()}
  async disarm(platform:ChatPlatform){await this.db.batch([this.db.prepare(`UPDATE chat_form_links SET armed=0 WHERE platform=?`).bind(platform),this.db.prepare(`UPDATE chat_deliveries SET state='cancelled',reason='The chat connection was removed.',updated_at=? WHERE state='pending' AND link_id IN(SELECT id FROM chat_form_links WHERE platform=?)`).bind(new Date().toISOString(),platform)])}
  interaction(input:{body:string;timestamp:string|null;signature:string|null},now?:string){return createSlackAction(this.db,this.connections,input,now)}
  async run(now=new Date().toISOString()){
    await materializeChatResponses(this.db,now)
    await materializeChatReminders(this.db,now)
    const interrupted=new Date(Date.parse(now)-300000).toISOString()
    await this.db.batch([
      this.db.prepare(`INSERT OR IGNORE INTO chat_attempts(id,delivery_id,ordinal,outcome,reason,created_at) SELECT 'interrupted:'||id||':'||attempts,id,attempts,'unknown','An interrupted post may have arrived; automatic resend is disabled.',? FROM chat_deliveries WHERE state='sending' AND started_at<?`).bind(now,interrupted),
      this.db.prepare(`UPDATE chat_deliveries SET state='unknown',reason='The chat post was interrupted and may have arrived; automatic resend is disabled.',updated_at=? WHERE state='sending' AND started_at<?`).bind(now,interrupted),
    ])
    const due=await this.db.prepare(`SELECT ${selection} FROM chat_deliveries d JOIN chat_form_links l ON l.id=d.link_id WHERE l.armed=1 AND d.state='pending' AND d.available_at<=?
      AND NOT EXISTS(SELECT 1 FROM chat_deliveries earlier WHERE earlier.action_target_id=d.action_target_id AND earlier.state IN('pending','sending') AND earlier.due_date<d.due_date)
      ORDER BY COALESCE(d.due_date,''),d.available_at,d.id LIMIT 50`).bind(now).all<Due>()
    let attempted=0
    for(const row of due.results){
      let message:ChatMessage|null
      try {message=await this.message(row,now)}catch(error){await this.db.prepare("UPDATE chat_deliveries SET state='failed',reason=?,updated_at=? WHERE id=? AND state='pending'").bind(error instanceof ValidationError?error.message:'The retained chat configuration could not be read.',now,row.id).run();continue}
      if(!message)continue
      const claim=crypto.randomUUID()
      const claimed=await this.db.batch([
        this.db.prepare(`INSERT INTO chat_attempts(id,delivery_id,ordinal,outcome,created_at) SELECT ?,d.id,d.attempts+1,'started',? FROM chat_deliveries d JOIN chat_form_links l ON l.id=d.link_id WHERE d.id=? AND d.state='pending' AND l.armed=1 AND l.settings_json=?`).bind(claim,now,row.id,row.settingsJson),
        this.db.prepare(`UPDATE chat_deliveries SET state='sending',attempts=attempts+1,started_at=?,updated_at=? WHERE id=? AND state='pending' AND EXISTS(SELECT 1 FROM chat_attempts WHERE id=? AND delivery_id=chat_deliveries.id AND ordinal=chat_deliveries.attempts+1) RETURNING id`).bind(now,now,row.id,claim),
      ])
      if(!claimed[1].results.length)continue
      // Re-read after the claim, including verdict, owner and WS-002 hours. A stopped action never prepares another post.
      try {message=await this.message(row,now)}catch(error){await this.db.prepare("UPDATE chat_deliveries SET state='failed',reason=?,updated_at=? WHERE id=? AND state='sending'").bind(error instanceof ValidationError?error.message:'The retained chat configuration could not be read.',now,row.id).run();continue}
      if(!message){await this.db.prepare("UPDATE chat_deliveries SET state='cancelled',reason='The chat post is no longer eligible.',updated_at=? WHERE id=? AND state='sending'").bind(now,row.id).run();continue}
      attempted++
      let result:Awaited<ReturnType<typeof postChat>>
      try {result=await postChat(this.connections,row.platform,message,row.key)}catch {result={state:'failed',httpStatus:null,reason:'The saved chat connection cannot be unlocked. Ask the owner to reconnect it.'}}
      await this.db.batch([
        this.db.prepare(`INSERT INTO chat_attempts(id,delivery_id,ordinal,outcome,http_status,reason,created_at) SELECT ?,id,attempts,?,?,?,? FROM chat_deliveries WHERE id=? AND state IN('sending','cancelled')`).bind(crypto.randomUUID(),result.state,result.httpStatus,result.reason,now,row.id),
        this.db.prepare(`UPDATE chat_deliveries SET state=CASE WHEN state='cancelled' THEN state ELSE ? END,reason=?,updated_at=? WHERE id=? AND state IN('sending','cancelled')`).bind(result.state,result.reason,now,row.id),
      ])
    }
    return {attempted}
  }
  private async message(row:Due,now:string):Promise<ChatMessage|null>{
    const settings=chatFormSchema.parse(JSON.parse(row.settingsJson))
    if(row.responseId){
      const response=await this.db.prepare(`SELECT r.revision_id AS revisionId,v.title,r.completed_at AS completedAt FROM responses r JOIN flow_revisions v ON v.id=r.revision_id JOIN chat_form_links l ON l.flow_id=r.flow_id WHERE r.id=? AND l.id=? AND l.armed=1 AND l.settings_json=? AND ${eligibleChatResponse}`).bind(row.responseId,row.linkId,row.settingsJson).first<{revisionId:string;title:string;completedAt:string}>()
      if(!response){await this.db.prepare("UPDATE chat_deliveries SET state='cancelled',reason='The response is no longer eligible.',updated_at=? WHERE id=? AND state='pending'").bind(now,row.id).run();return null}
      const answers=await this.db.prepare(`SELECT s.stable_id AS id,s.question_type AS type,s.prompt,a.value_json AS valueJson FROM response_answers a JOIN flow_steps s ON s.revision_id=? AND s.stable_id=a.step_id WHERE a.response_id=?`).bind(response.revisionId,row.responseId).all<{id:string;type:string;prompt:string;valueJson:string}>()
      const summary:string[]=[]
      for(const id of settings.answerStepIds){const answer=answers.results.find(answer=>answer.id===id);if(!answer)continue;if(!safeSummaryTypes.has(answer.type))throw new ValidationError('A selected field is sensitive or free text. No answers were posted. Repair this form’s chat summary.')
        const value:unknown=JSON.parse(answer.valueJson)
        if(['single_choice','multiple_choice'].includes(answer.type)){
          const selected=typeof value==='string'?[value]:Array.isArray(value)&&value.every(item=>typeof item==='string')?value:[]
          const choices=await this.db.prepare('SELECT stable_id AS id,label FROM choice_options WHERE step_id=(SELECT id FROM flow_steps WHERE revision_id=? AND stable_id=?) ORDER BY position').bind(response.revisionId,id).all<{id:string;label:string}>()
          if(selected.some(id=>!choices.results.some(choice=>choice.id===id)))throw new ValidationError('Only closed choice labels may be posted; Other text is refused.')
          if(selected.length)summary.push(`${answer.prompt}: ${selected.map(id=>choices.results.find(choice=>choice.id===id)!.label).join(', ')}`)
        }else if(typeof value==='number'&&Number.isFinite(value)||typeof value==='boolean')summary.push(`${answer.prompt}: ${String(value)}`)
        else if(value!==null)throw new ValidationError('A selected field has a non-scalar value. No answers were posted.')
      }
      return {text:`${response.title}\nSubmitted ${response.completedAt}${summary.length?'\n'+summary.join('\n'):''}`,link:new URL(`/app/flows/${encodeURIComponent(row.flowId)}/inbox`,this.configuration.origin).href,channel:settings.channel,...(row.platform==='slack'&&settings.action?{buttonDeliveryId:row.id}:{})}
    }
    const action=await this.db.prepare(`SELECT a.id,a.title,a.review_date AS reviewDate,o.display_name AS ownerName,t.user_id AS userId,w.time_zone AS timeZone,w.sending_window_start AS sendingWindowStart,w.sending_window_end AS sendingWindowEnd
      FROM chat_action_targets t JOIN actions a ON a.id=t.action_id JOIN operators o ON o.id=t.operator_id JOIN workspaces w ON w.id=a.workspace_id JOIN chat_form_links l ON l.id=t.link_id
      WHERE t.id=? AND l.armed=1 AND l.settings_json=? AND a.review_date=? AND ${eligibleChatAction}`).bind(row.targetId,row.settingsJson,row.reviewDate).first<{id:string;title:string;reviewDate:string;ownerName:string;userId:string;timeZone:string;sendingWindowStart:string;sendingWindowEnd:string}>()
    if(!action)return null
    if(!insideSendingWindow(new Date(now),action)){await this.db.prepare("UPDATE chat_deliveries SET available_at=?,reason='Held until the workspace sending window opens.',updated_at=? WHERE id=? AND state='pending'").bind(nextSendingInstant(now,action),now,row.id).run();return null}
    return {text:`${timing[row.kind]}: ${action.title}\nReview date: ${action.reviewDate} (${action.timeZone}).\nOwner: ${action.ownerName}\nSign in to record your verdict.`,link:new URL(`/app/actions/${encodeURIComponent(action.id)}`,this.configuration.origin).href,channel:row.platform==='slack'?action.userId:settings.channel,owner:{id:action.userId,name:action.ownerName}}
  }
}
