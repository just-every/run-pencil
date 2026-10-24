import type { MailSender } from '../../../base/operator-auth/index.mjs'
import { retryInstant } from '../distribution'
import { safeNotificationReceipt } from './failure'
import { deserializeConfirmation } from './confirmation-message'
import { auditConfirmation, confirmationLive, confirmationRecipient, materializeConfirmations } from './confirmation-queue'
type Due={id:string;workspaceId:string;recipient:string;messageJson:string;attempts:number;firstAttempt:string|null}
export class RespondentConfirmationDispatcher {
 constructor(private db:D1Database,private sender:MailSender,private from:string,private configurationFailure:string|null=null,private origin='http://localhost') {}
 async run(now=new Date().toISOString()):Promise<{attempted:number}> {
  await materializeConfirmations(this.db,now,this.origin)
  // A started transport without a receipt is ambiguous, including a process interruption.
  const interrupted=await this.db.prepare(`UPDATE confirmation_deliveries SET status='unknown',reason='Interrupted delivery has an unknown outcome; automatic resend is disabled.',updated_at=?
   WHERE id IN (SELECT id FROM confirmation_deliveries WHERE status='sending' AND last_attempt_at<=? ORDER BY last_attempt_at,id LIMIT 50) RETURNING id,(SELECT workspace_id FROM responses WHERE id=response_id) AS workspaceId`)
   .bind(now,new Date(Date.parse(now)-300000).toISOString()).all<{id:string;workspaceId:string}>()
  for(const row of interrupted.results) await auditConfirmation(this.db,row.workspaceId,'unknown','Interrupted delivery; automatic resend disabled.',now)
  const due=await this.db.prepare(`SELECT d.id,r.workspace_id AS workspaceId,d.recipient,d.message_json AS messageJson,d.attempts,d.first_attempt_at AS firstAttempt
   FROM confirmation_deliveries d JOIN responses r ON r.id=d.response_id WHERE d.status='pending' AND d.armed=1 AND d.available_at<=? ORDER BY d.available_at,d.id LIMIT 50`).bind(now).all<Due>()
  let attempted=0
  for(const row of due.results) {
   if(row.firstAttempt && (Date.parse(now)>Date.parse(row.firstAttempt)+3600000 || row.attempts>=6)) {
    await this.finishPending(row,'failed','Confirmation retry budget exhausted after five retries within one hour.',now);continue
   }
   const claim=crypto.randomUUID()
   const claimed=await this.db.batch([
    this.db.prepare(`INSERT OR IGNORE INTO confirmation_attempts(id,delivery_id,ordinal,event,created_at)
     SELECT ?,d.id,d.attempts+1,'started',? FROM confirmation_deliveries d JOIN responses r ON r.id=d.response_id JOIN flow_revisions v ON v.id=r.revision_id
     WHERE d.id=? AND d.status='pending' AND d.armed=1 AND d.attempts=? AND d.available_at<=? AND ${confirmationLive} AND ${confirmationRecipient}`)
     .bind(claim,now,row.id,row.attempts,now),
    this.db.prepare(`UPDATE confirmation_deliveries SET status='sending',attempts=attempts+1,first_attempt_at=COALESCE(first_attempt_at,?),last_attempt_at=?,updated_at=?
     WHERE id=? AND status='pending' AND EXISTS(SELECT 1 FROM confirmation_attempts t WHERE t.id=? AND t.ordinal=confirmation_deliveries.attempts+1)`)
     .bind(now,now,now,row.id,claim),
   ])
   if(!claimed[1].meta.changes) {
    // Do not cancel another worker's claim; a pending row with lost consent is terminal.
    await this.finishPending(row,'cancelled','Response or selected mailbox is no longer eligible.',now);continue
   }
   attempted++
   await this.deliver({...row,attempts:row.attempts+1,firstAttempt:row.firstAttempt??now},claim,now)
  }
  return {attempted}
 }
 private async finishPending(row:Due,status:string,reason:string,now:string) {
  const result=await this.db.prepare("UPDATE confirmation_deliveries SET status=?,reason=?,updated_at=? WHERE id=? AND status='pending' AND attempts=?").bind(status,reason,now,row.id,row.attempts).run()
  if(result.meta.changes) await auditConfirmation(this.db,row.workspaceId,status,reason,now)
 }
 private async deliver(row:Due,claim:string,now:string) {
  let outcome:'sent'|'transient'|'permanent'|'unknown'|'cancelled'='permanent',reason:string|null=null,providerId:string|null=null
  let receipt:{provider:string|null;code:string|null}={provider:null,code:null}
  try {
   if(this.configurationFailure) throw new Error('Mail configuration is unavailable.')
   const message=deserializeConfirmation(row.messageJson)
   const live=await this.db.prepare(`SELECT d.id FROM confirmation_deliveries d JOIN responses r ON r.id=d.response_id JOIN flow_revisions v ON v.id=r.revision_id
    WHERE d.id=? AND d.status='sending' AND d.armed=1 AND d.attempts=? AND ${confirmationLive} AND ${confirmationRecipient}
    AND EXISTS(SELECT 1 FROM confirmation_attempts t WHERE t.id=? AND t.delivery_id=d.id AND t.ordinal=d.attempts AND t.event='started')`).bind(row.id,row.attempts,claim).first()
   if(!live) { outcome='cancelled';reason='Response or selected mailbox is no longer eligible.' }
   else {
    outcome='unknown'
    try {
     const result=await this.sender.send({deliveryId:row.id,from:this.from,to:[row.recipient],...message,headers:{'Auto-Submitted':'auto-generated','X-Pencil-Confirmation-Attempt':String(row.attempts),'X-Pencil-Confirmation-Claim':claim}})
     outcome=result.status==='accepted'||result.status==='development'?'sent':result.status==='rate_limited'?'transient':result.status==='rejected'?'permanent':'unknown'
     providerId=result.providerMessageId;receipt=safeNotificationReceipt(result.provider,result.code)
    } catch { reason='Mail transport ended without a definitive receipt; automatic resend is disabled.' }
   }
  } catch { reason='Confirmation preparation failed: stored message or installation mail configuration is unavailable.' }
  const retry=outcome==='transient' && Date.parse(now)<=Date.parse(row.firstAttempt!)+3600000 ? retryInstant(row.firstAttempt!,row.attempts):null
  const status=outcome==='sent'?'sent':outcome==='unknown'?'unknown':outcome==='cancelled'?'cancelled':retry?'pending':'failed'
  reason ??= status==='sent'?null:status==='unknown'?'Delivery outcome is unknown; automatic resend is disabled.':status==='pending'?'Mail provider rate limited this confirmation; retry scheduled.':'Mail provider rejected this confirmation or exhausted its retry budget.'
  const event=crypto.randomUUID()
  await this.db.batch([
   this.db.prepare(`INSERT OR IGNORE INTO confirmation_attempts(id,delivery_id,ordinal,event,provider,provider_code,created_at)
    SELECT ?,id,attempts,?,?,?,? FROM confirmation_deliveries WHERE id=? AND status='sending' AND attempts=?`)
    .bind(event,outcome,receipt.provider,receipt.code,now,row.id,row.attempts),
   this.db.prepare(`UPDATE confirmation_deliveries SET status=?,reason=?,provider_id=?,available_at=?,updated_at=? WHERE id=? AND status='sending' AND attempts=?
    AND EXISTS(SELECT 1 FROM confirmation_attempts WHERE id=?)`).bind(status,reason,providerId,retry??now,now,row.id,row.attempts,event),
  ])
  // Audit deliberately survives response erasure without retaining identity or message content.
  await auditConfirmation(this.db,row.workspaceId,status,reason,now)
 }
}
