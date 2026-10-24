import type { MailSender } from '../../../base/operator-auth/index.mjs'
import type { MailConfiguration } from '../../platform/mail'
import { evaluateCondition } from '../../shared/conditions'
import { formSettings, hiddenAnswers, type ResponseContext } from '../../shared/hiddenFields'
import { variableAnswers } from '../../shared/calculationContext'
import { type AnswerAlertRule } from '../../shared/answerAlerts'
import { NotFoundError, ValidationError } from '../../shared/errors'
import { unpaidResponseSql } from '../payments/admission'
import { retryInstant } from '../distribution'
import { readNotificationBrand } from './brand'
import { composeResponseNotification, notificationSenderError } from './compose'
import { safeNotificationReceipt } from './failure'

const responseEligible = `r.state='released' AND r.notification_eligible=1 AND r.source IN ('direct','embed','invitation') AND NOT ${unpaidResponseSql('r.id')}`
const recipientEligible = `o.workspace_id=r.workspace_id AND NOT EXISTS(SELECT 1 FROM operator_auth_links l JOIN oa_operators a ON a.id=l.auth_id WHERE l.operator_id=o.id AND a.status='inactive')`
type Candidate = {id:string;workspaceId:string;settingsJson:string;contextJson:string;updatedAt:string;paymentState:string|null}
type Due = {id:string;key:string;responseId:string;workspaceId:string;flowId:string;flowTitle:string;ruleName:string;email:string;timeZone:string;submittedAt:string;attempts:number;firstAttempt:string|null}

/** One atomic evaluation captures the matching rule/recipient cohort. Replays and later edits cannot alert twice. */
export async function materializeAnswerAlerts(db:D1Database,now:string) {
  const candidates=await db.prepare(`SELECT r.id,r.workspace_id AS workspaceId,v.form_settings_json AS settingsJson,r.response_context_json AS contextJson,r.updated_at AS updatedAt,
    (SELECT state FROM response_payments p WHERE p.response_id=r.id) AS paymentState
    FROM responses r JOIN flow_revisions v ON v.id=r.revision_id WHERE ${responseEligible}
    AND json_array_length(v.form_settings_json,'$.answerAlerts')>0
    AND NOT EXISTS(SELECT 1 FROM answer_alert_evaluations e WHERE e.response_id=r.id) ORDER BY r.completed_at,r.id LIMIT 50`).all<Candidate>()
  for(const response of candidates.results) {
    const context=JSON.parse(response.contextJson) as ResponseContext
    const answers=await db.prepare('SELECT step_id AS stepId,value_json AS valueJson FROM response_answers WHERE response_id=?').bind(response.id).all<{stepId:string;valueJson:string}>()
    const values={...Object.fromEntries(answers.results.map(answer=>[answer.stepId,JSON.parse(answer.valueJson)])),...hiddenAnswers(context),...variableAnswers(context.calculations),'payment:state':response.paymentState}
    const rules:AnswerAlertRule[]=formSettings(response.settingsJson).answerAlerts??[]
    const matchedRules=rules.filter(rule=>evaluateCondition(rule.condition,values).matched)
    const matches=matchedRules.flatMap(rule=>rule.recipientIds.map(operatorId=>({ruleId:rule.id,ruleName:rule.name,operatorId,id:crypto.randomUUID(),key:`answer-alert:${crypto.randomUUID()}`})))
    const chats=matchedRules.flatMap(rule=>(rule.chatPlatforms??[]).map(platform=>({ruleId:rule.id,platform})))
    await db.batch([
      db.prepare(`INSERT OR IGNORE INTO answer_alert_deliveries(id,response_id,rule_id,rule_name,operator_id,status,idempotency_key,available_at,created_at,updated_at)
        SELECT json_extract(m.value,'$.id'),r.id,json_extract(m.value,'$.ruleId'),json_extract(m.value,'$.ruleName'),o.id,'pending',json_extract(m.value,'$.key'),?,?,?
        FROM responses r JOIN json_each(?) m JOIN operators o ON o.id=json_extract(m.value,'$.operatorId')
        WHERE r.id=? AND r.updated_at=? AND r.response_context_json=? AND ${responseEligible} AND ${recipientEligible}
        AND NOT EXISTS(SELECT 1 FROM answer_alert_evaluations e WHERE e.response_id=r.id)`).bind(now,now,now,JSON.stringify(matches),response.id,response.updatedAt,response.contextJson),
      // Chat and mail capture the same first eligible evaluation. Later edits
      // and concurrent dispatchers cannot create another rule delivery.
      db.prepare(`INSERT OR IGNORE INTO chat_deliveries(id,link_id,response_id,kind,idempotency_key,state,available_at,updated_at)
        SELECT lower(hex(randomblob(16))),l.id,r.id,'response','chat:alert:'||json_extract(m.value,'$.ruleId')||':'||l.id||':'||r.id,'pending',?,?
        FROM responses r JOIN json_each(?) m JOIN chat_form_links l ON l.flow_id=r.flow_id AND l.workspace_id=r.workspace_id AND l.platform=json_extract(m.value,'$.platform')
        WHERE r.id=? AND r.updated_at=? AND r.response_context_json=? AND ${responseEligible} AND l.armed=1 AND COALESCE(r.released_at,r.completed_at)>=l.updated_at
        AND NOT EXISTS(SELECT 1 FROM answer_alert_evaluations e WHERE e.response_id=r.id)`)
        .bind(now,now,JSON.stringify(chats),response.id,response.updatedAt,response.contextJson),
      db.prepare(`INSERT OR IGNORE INTO answer_alert_evaluations(response_id,created_at) SELECT r.id,? FROM responses r WHERE r.id=? AND r.updated_at=? AND r.response_context_json=? AND ${responseEligible}`)
        .bind(now,response.id,response.updatedAt,response.contextJson),
    ])
  }
}
export class AnswerAlerts {
  constructor(private db:D1Database,private sender:MailSender,private origin:string,private from:string,private configurationFailure:string|null=null,private mailProvider:MailConfiguration['kind']='sendgrid'){}
  async read(workspaceId:string,operatorId:string,flowId?:string) {
    return {items:(await this.db.prepare(`SELECT d.id,d.rule_name AS ruleName,d.read_at AS readAt,d.created_at AS createdAt,d.status,d.reason,d.attempts,r.flow_id AS flowId,v.title AS flowTitle
      FROM answer_alert_deliveries d JOIN responses r ON r.id=d.response_id JOIN flow_revisions v ON v.id=r.revision_id
      WHERE r.workspace_id=? AND d.operator_id=? AND (? IS NULL OR r.flow_id=?) ORDER BY d.created_at DESC,d.id DESC LIMIT 100`).bind(workspaceId,operatorId,flowId??null,flowId??null).all()).results}
  }
  async acknowledge(workspaceId:string,operatorId:string,id:string) {
    const row=await this.db.prepare(`UPDATE answer_alert_deliveries SET read_at=COALESCE(read_at,?) WHERE id=? AND operator_id=?
      AND response_id IN(SELECT id FROM responses WHERE workspace_id=?) RETURNING id`).bind(new Date().toISOString(),id,operatorId,workspaceId).all()
    if(!row.results.length)throw new NotFoundError('This alert is not yours.')
  }
  async retry(workspaceId:string,operatorId:string,id:string,acceptDuplicateRisk:boolean,now=new Date().toISOString()) {
    const row=await this.db.prepare(`SELECT d.status,d.armed FROM answer_alert_deliveries d JOIN responses r ON r.id=d.response_id WHERE d.id=? AND d.operator_id=? AND r.workspace_id=?`).bind(id,operatorId,workspaceId).first<{status:string;armed:number}>()
    if(!row)throw new NotFoundError('This alert is not yours.')
    if(!row.armed)throw new ValidationError('Restored alert history cannot be sent again.')
    if(!['failed','unknown'].includes(row.status))throw new ValidationError('Only failed or unknown alerts can be retried.')
    if(row.status==='unknown'&&!acceptDuplicateRisk)throw new ValidationError('Sending again may duplicate mail. Confirm the duplicate risk first.')
    await this.db.batch([
      this.db.prepare(`INSERT OR IGNORE INTO answer_alert_attempts(id,delivery_id,ordinal,event,created_at) SELECT ?,id,attempts,'operator-retry',? FROM answer_alert_deliveries WHERE id=? AND status IN('failed','unknown')`).bind(crypto.randomUUID(),now,id),
      this.db.prepare(`UPDATE answer_alert_deliveries SET status='pending',available_at=?,updated_at=? WHERE id=? AND status IN('failed','unknown')`).bind(now,now,id),
    ])
  }
  async run(now=new Date().toISOString()) {
    await materializeAnswerAlerts(this.db,now)
    const interruptedBefore=new Date(Date.parse(now)-300_000).toISOString()
    await this.db.batch([
      this.db.prepare(`INSERT OR IGNORE INTO answer_alert_attempts(id,delivery_id,ordinal,event,created_at) SELECT 'interrupted:'||id||':'||attempts,id,attempts,'unknown',? FROM answer_alert_deliveries WHERE status='sending' AND last_attempt_at<?`).bind(now,interruptedBefore),
      this.db.prepare(`UPDATE answer_alert_deliveries SET status='unknown',reason='Interrupted delivery has an unknown outcome. Automatic resend is disabled.',updated_at=? WHERE status='sending' AND last_attempt_at<?`).bind(now,interruptedBefore),
    ])
    let attempted=0,cursor=''
    while(true) {
      const due=await this.db.prepare(`SELECT d.id,d.idempotency_key AS key,r.id AS responseId,r.workspace_id AS workspaceId,r.flow_id AS flowId,v.title AS flowTitle,d.rule_name AS ruleName,o.email,w.time_zone AS timeZone,r.completed_at AS submittedAt,d.attempts,d.first_attempt_at AS firstAttempt
        FROM answer_alert_deliveries d JOIN responses r ON r.id=d.response_id JOIN flow_revisions v ON v.id=r.revision_id JOIN operators o ON o.id=d.operator_id JOIN workspaces w ON w.id=r.workspace_id
        WHERE d.id>? AND d.status='pending' AND d.armed=1 AND d.available_at<=? AND (d.last_attempt_at IS NULL OR d.last_attempt_at<>?) AND ${responseEligible} AND ${recipientEligible} ORDER BY d.id LIMIT 50`).bind(cursor,now,now).all<Due>()
      if(!due.results.length)break
      cursor=due.results.at(-1)!.id
      for(const row of due.results) {
        const explicit=await this.db.prepare(`SELECT 1 FROM answer_alert_attempts WHERE delivery_id=? AND ordinal=? AND event='operator-retry'`).bind(row.id,row.attempts).first()
        if(row.firstAttempt&&Date.parse(now)>Date.parse(row.firstAttempt)+3600_000&&!explicit) {
          await this.db.prepare(`UPDATE answer_alert_deliveries SET status='failed',reason='Mail provider retry window exhausted after one hour.',updated_at=? WHERE id=? AND status='pending' AND attempts=?`).bind(now,row.id,row.attempts).run();continue
        }
        const claim=crypto.randomUUID()
        const claimed=await this.db.batch([
          this.db.prepare(`INSERT OR IGNORE INTO answer_alert_attempts(id,delivery_id,ordinal,event,created_at)
            SELECT ?,d.id,d.attempts+1,'started',? FROM answer_alert_deliveries d JOIN responses r ON r.id=d.response_id JOIN operators o ON o.id=d.operator_id
            WHERE d.id=? AND d.status='pending' AND d.armed=1 AND d.attempts=? AND ${responseEligible} AND ${recipientEligible}`).bind(claim,now,row.id,row.attempts),
          this.db.prepare(`UPDATE answer_alert_deliveries SET status='sending',attempts=attempts+1,first_attempt_at=COALESCE(first_attempt_at,?),last_attempt_at=?,updated_at=?
            WHERE id=? AND status='pending' AND EXISTS(SELECT 1 FROM answer_alert_attempts a WHERE a.id=? AND a.ordinal=answer_alert_deliveries.attempts+1) RETURNING attempts,first_attempt_at AS firstAttempt`).bind(now,now,now,row.id,claim),
        ])
        if(!claimed[1].results.length)continue
        attempted++;Object.assign(row,claimed[1].results[0]);await this.deliver(row,claim,now)
      }
    }
    return {attempted}
  }
  private async deliver(row:Due,claim:string,now:string) {
    let outcome:'sent'|'transient'|'permanent'|'unknown'='permanent',reason:string|null=null
    let receipt:{provider:string|null;code:string|null}={provider:null,code:null}
    try {
      if(notificationSenderError(this.from,this.mailProvider)??this.configurationFailure)throw new Error('Mail configuration unavailable.')
      const brand=await readNotificationBrand(this.db,row.workspaceId)
      const message=composeResponseNotification({...brand,flowTitle:`${row.flowTitle} — ${row.ruleName}`,submittedAt:row.submittedAt,timeZone:row.timeZone,resultsUrl:new URL(`/app/flows/${encodeURIComponent(row.flowId)}/results`,this.origin).href})
      const live=await this.db.prepare(`SELECT o.email FROM answer_alert_deliveries d JOIN responses r ON r.id=d.response_id JOIN operators o ON o.id=d.operator_id WHERE d.id=? AND d.status='sending' AND d.armed=1 AND d.attempts=? AND ${responseEligible} AND ${recipientEligible}
        AND EXISTS(SELECT 1 FROM answer_alert_attempts a WHERE a.id=? AND a.delivery_id=d.id AND a.ordinal=d.attempts AND a.event='started')`).bind(row.id,row.attempts,claim).first<{email:string}>()
      if(!live) {await this.db.prepare(`UPDATE answer_alert_deliveries SET status='cancelled',reason='Response or recipient is no longer eligible.',updated_at=? WHERE id=? AND status='sending' AND attempts=?`).bind(now,row.id,row.attempts).run();return}
      outcome='unknown'
      try {
        const result=await this.sender.send({deliveryId:row.key,from:this.from,to:[live.email],...message,headers:{...message.headers,'X-Pencil-Notification-Claim':claim,'X-Pencil-Notification-Attempt':String(row.attempts)}})
        outcome=['accepted','development'].includes(result.status)?'sent':result.status==='rate_limited'?'transient':result.status==='rejected'?'permanent':'unknown'
        receipt=safeNotificationReceipt(result.provider,result.code)
      } catch { /* A transport exception may follow acceptance. Never automatically resend it. */ }
    } catch {reason='Answer alert sender or branding is unavailable. Check mail configuration.'}
    const unresolved=await this.db.prepare(`SELECT 1 FROM answer_alert_attempts a WHERE a.delivery_id=? AND a.event='unknown' AND NOT EXISTS(SELECT 1 FROM answer_alert_attempts sent WHERE sent.delivery_id=a.delivery_id AND sent.event='sent' AND sent.ordinal>a.ordinal)`).bind(row.id).first()
    const retry=outcome==='transient'&&!unresolved&&Date.parse(now)<Date.parse(row.firstAttempt!)+3600_000?retryInstant(row.firstAttempt!,row.attempts):null
    const status=outcome==='sent'?'sent':outcome==='unknown'||unresolved?'unknown':retry?'pending':'failed'
    reason??=status==='unknown'?'Delivery outcome is unknown. Automatic resend is disabled.':status==='pending'?'Mail provider rate limited this alert; retry scheduled.':status==='failed'?'Mail provider rejected this alert or exhausted its five retries.':null
    await this.db.batch([
      this.db.prepare(`INSERT OR IGNORE INTO answer_alert_attempts(id,delivery_id,ordinal,event,provider,provider_code,created_at) SELECT ?,id,attempts,?,?,?,? FROM answer_alert_deliveries WHERE id=? AND status='sending' AND attempts=?`).bind(crypto.randomUUID(),outcome,receipt.provider,receipt.code,now,row.id,row.attempts),
      this.db.prepare(`UPDATE answer_alert_deliveries SET status=?,reason=?,available_at=?,updated_at=? WHERE id=? AND status='sending' AND attempts=?`).bind(status,reason,retry??now,now,row.id,row.attempts),
    ])
  }
}
