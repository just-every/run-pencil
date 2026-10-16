import type { MailSender } from '../../../base/operator-auth/index.mjs'
import type { MailConfiguration } from '../../platform/mail'
import { readNotificationBrand, type NotificationBrand } from './brand.server'
import { composeResponseNotification, notificationSenderError } from './compose'
import { insideSendingWindow, retryInstant } from '../distribution'
import { freezeDigests } from './digest-cohorts'
import { digestEligibility, digestLiveCount } from './digest-eligibility'
import { safeNotificationReceipt } from './failure'
type Due={id:string;flowId:string;operatorId:string;workspaceId:string;flowTitle:string;email:string;day:string;zone:string;cutoffEnd:string;key:string;attempts:number;retryCount:number;firstAttempt:string|null;retryAuthorized:number;timeZone:string;sendingWindowStart:string;sendingWindowEnd:string}
export class DigestDispatcher {
 constructor(private db:D1Database,private sender:MailSender,private origin:string,private from:string,private brand:(workspaceId:string)=>Promise<NotificationBrand>=id=>readNotificationBrand(db,id),private configurationFailure:string|null=null,private mailProvider:MailConfiguration['kind']='sendgrid') {}
 async run(now=new Date().toISOString()) {
  await freezeDigests(this.db,now)
  await this.db.batch([
   this.db.prepare(`INSERT OR IGNORE INTO audit_entries(id,workspace_id,kind,actor_operator_id,subject_type,subject_id,details_json,created_at)
    SELECT lower(hex(randomblob(16))),f.workspace_id,'digest.delivery',NULL,'digest',NULL,'{"status":"unknown"}',?
    FROM digest_deliveries d JOIN flows f ON f.id=d.flow_id JOIN digest_attempts a ON a.delivery_id=d.id AND a.ordinal=d.attempts AND a.event='started'
    WHERE d.status='sending' AND d.replay_enabled=1 AND d.last_attempt_at<?`).bind(now,new Date(Date.parse(now)-300_000).toISOString()),
   this.db.prepare(`INSERT OR IGNORE INTO digest_attempts(id,delivery_id,ordinal,event,created_at) SELECT 'interrupted:'||id||':'||attempts,id,attempts,'unknown',? FROM digest_deliveries WHERE status='sending' AND replay_enabled=1 AND last_attempt_at<?`).bind(now,new Date(Date.parse(now)-300_000).toISOString()),
   this.db.prepare(`UPDATE digest_deliveries SET status='unknown',reason='Sender interrupted. Sending again requires duplicate-risk acceptance.',updated_at=? WHERE status='sending' AND replay_enabled=1 AND last_attempt_at<?`).bind(now,new Date(Date.parse(now)-300_000).toISOString()),
  ])
  const rows=await this.db.prepare(`SELECT d.id,d.flow_id AS flowId,d.operator_id AS operatorId,f.workspace_id AS workspaceId,f.title AS flowTitle,o.email,d.day,d.zone,d.cutoff_end AS cutoffEnd,d.idempotency_key AS key,d.attempts,d.retry_count AS retryCount,d.first_attempt_at AS firstAttempt,d.retry_authorized AS retryAuthorized,w.time_zone AS timeZone,w.sending_window_start AS sendingWindowStart,w.sending_window_end AS sendingWindowEnd
   FROM digest_deliveries d JOIN flows f ON f.id=d.flow_id JOIN workspaces w ON w.id=f.workspace_id JOIN operators o ON o.id=d.operator_id JOIN digest_preferences p ON p.flow_id=d.flow_id AND p.operator_id=d.operator_id
   WHERE d.status='pending' AND d.available_at<=? AND ${digestEligibility} ORDER BY d.available_at,d.id LIMIT 100`).bind(now).all<Due>()
  for(const row of rows.results) {
   if(!insideSendingWindow(new Date(now),row))continue
   if(row.firstAttempt && !row.retryAuthorized && Date.parse(now)>Date.parse(row.firstAttempt)+3600_000) {await this.db.prepare("UPDATE digest_deliveries SET status='failed',reason='Retry window exhausted after one hour.',updated_at=? WHERE id=? AND status='pending' AND retry_authorized=0").bind(now,row.id).run();continue}
   const claim=crypto.randomUUID()
   const claimed=await this.db.batch([
    this.db.prepare(`INSERT OR IGNORE INTO digest_attempts(id,delivery_id,ordinal,event,created_at) SELECT ?,d.id,d.attempts+1,'started',? FROM digest_deliveries d JOIN digest_preferences p ON p.flow_id=d.flow_id AND p.operator_id=d.operator_id WHERE d.id=? AND d.status='pending' AND d.attempts=? AND ${digestEligibility}`).bind(claim,now,row.id,row.attempts),
    this.db.prepare(`UPDATE digest_deliveries SET status='sending',attempts=attempts+1,retry_count=CASE WHEN retry_authorized=1 THEN 1 ELSE retry_count+1 END,first_attempt_at=CASE WHEN retry_authorized=1 THEN ? ELSE COALESCE(first_attempt_at,?) END,retry_authorized=0,last_attempt_at=?,updated_at=? WHERE id=? AND status='pending' AND EXISTS(SELECT 1 FROM digest_attempts WHERE id=? AND ordinal=digest_deliveries.attempts+1) RETURNING attempts,retry_count AS retryCount,first_attempt_at AS firstAttempt`).bind(now,now,now,now,row.id,claim),
   ])
   if(!claimed[1].results.length)continue
   Object.assign(row,claimed[1].results[0])
   await this.deliver(row,claim,now)
  }
 }
 private async deliver(row:Due,claim:string,now:string) {
  let outcome:'sent'|'transient'|'permanent'|'unknown'|'empty'='permanent', reason:string|null=null,providerId:string|null=null,receipt:{provider:string|null;code:string|null}={provider:null,code:null}
  try {
   const senderError=notificationSenderError(this.from,this.mailProvider)??this.configurationFailure
   if(senderError)throw new Error(senderError)
   const brand=await this.brand(row.workspaceId)
   const live=await this.db.prepare(`SELECT ${digestLiveCount} AS n FROM digest_deliveries d JOIN digest_preferences p ON p.flow_id=d.flow_id AND p.operator_id=d.operator_id WHERE d.id=? AND d.status='sending' AND d.attempts=? AND ${digestEligibility}`).bind(row.id,row.attempts).first<{n:number}>()
   if(!live) {await this.db.prepare("UPDATE digest_deliveries SET status='cancelled',reason='Daily email is no longer eligible.',updated_at=? WHERE id=? AND status='sending'").bind(now,row.id).run();return}
   if(!live.n)outcome='empty'
   else {
    const message=composeResponseNotification({...brand,flowTitle:row.flowTitle,submittedAt:row.cutoffEnd,timeZone:row.zone,resultsUrl:new URL(`/app/flows/${encodeURIComponent(row.flowId)}/results`,this.origin).href,digest:{day:row.day,count:live.n}})
    outcome='unknown'
    try {
     const result=await this.sender.send({deliveryId:row.key,from:this.from,to:[row.email],...message,headers:{...message.headers,'X-Pencil-Digest-Attempt':String(row.attempts),'X-Pencil-Digest-Claim':claim,'X-Pencil-Digest-Count':String(live.n)}})
     outcome=['accepted','development'].includes(result.status)?'sent':result.status==='rate_limited'?'transient':result.status==='rejected'?'permanent':'unknown'
     providerId=result.providerMessageId;receipt=safeNotificationReceipt(result.provider,result.code)
    }catch{/* Unknown transport cannot be resent automatically. */}
   }
  }catch{reason='Digest sender or saved branding is unavailable. Check configuration and retry.'}
  const priorUnknown=!!await this.db.prepare("SELECT 1 FROM digest_attempts a WHERE delivery_id=? AND event='unknown' AND NOT EXISTS(SELECT 1 FROM digest_attempts s WHERE s.delivery_id=a.delivery_id AND s.event='sent' AND s.ordinal>a.ordinal)").bind(row.id).first()
  const retry=outcome==='transient'&&!priorUnknown?retryInstant(row.firstAttempt!,row.retryCount):null
  const status=outcome==='sent'?'sent':outcome==='empty'?'empty':outcome==='unknown'||priorUnknown?'unknown':retry&&Date.parse(now)<Date.parse(row.firstAttempt!)+3600_000?'pending':'failed'
  reason=status==='unknown'?'Delivery outcome is unknown. Sending again may duplicate mail and requires explicit acceptance.':reason??(status==='pending'?'Rate limited; retry scheduled for this frozen day.':status==='failed'?'Mail rejected or bounded retry budget exhausted. Retry this day explicitly.':null)
  if(receipt.code&&reason)reason+=` ${receipt.provider}: ${receipt.code}.`
  await this.db.batch([
   this.db.prepare(`INSERT OR IGNORE INTO digest_attempts(id,delivery_id,ordinal,event,provider,provider_code,created_at) SELECT ?,id,attempts,?,?,?,? FROM digest_deliveries WHERE id=? AND status='sending' AND attempts=?`).bind(crypto.randomUUID(),outcome,receipt.provider,receipt.code,now,row.id,row.attempts),
   this.db.prepare("UPDATE digest_deliveries SET status=?,reason=?,provider_id=?,available_at=?,updated_at=? WHERE id=? AND status='sending' AND attempts=?").bind(status,reason,providerId,retry??now,now,row.id,row.attempts),
   this.db.prepare('UPDATE digest_preferences SET failure_reason=? WHERE flow_id=? AND operator_id=?').bind(reason,row.flowId,row.operatorId),
   // Like immediate mail, retain only the feature, time and outcome. Audit IDs
   // are independent of recipient, delivery, attempt and local capture claims.
   // Do not join the live recipient here: removal can commit during sender I/O.
   this.db.prepare(`INSERT OR IGNORE INTO audit_entries(id,workspace_id,kind,actor_operator_id,subject_type,subject_id,details_json,created_at)
    VALUES(?,?,'digest.delivery',NULL,'digest',NULL,?,?)`).bind(crypto.randomUUID(),row.workspaceId,JSON.stringify({status}),now),
  ])
 }
}
