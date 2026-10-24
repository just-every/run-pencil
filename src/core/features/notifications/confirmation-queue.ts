import { unpaidResponseSql } from '../payments/admission'
import { prepareConfirmation, type ConfirmationCandidate } from './confirmation-prepare'
export const confirmationLive=`r.state='released' AND r.notification_eligible=1 AND r.source IN ('direct','embed','invitation') AND NOT ${unpaidResponseSql('r.id')}
 AND json_extract(v.form_settings_json,'$.confirmation.enabled')=1
 AND (r.participant_id IS NULL OR EXISTS(SELECT 1 FROM invitation_participants p JOIN distribution_contacts c ON c.id=p.contact_id
  WHERE p.id=r.participant_id AND p.workspace_id=r.workspace_id AND p.revision_id=r.revision_id AND c.workspace_id=r.workspace_id AND c.opted_out_at IS NULL))`
/** Recheck the selected mailbox; no hidden, verified-public or arbitrary answer fallback. */
export const confirmationRecipient=`NOT EXISTS(SELECT 1 FROM distribution_contacts c WHERE c.workspace_id=r.workspace_id AND lower(c.email)=lower(d.recipient) AND c.opted_out_at IS NOT NULL)
 AND NOT EXISTS(SELECT 1 FROM invitation_participants p WHERE p.workspace_id=r.workspace_id AND lower(p.email_snapshot)=lower(d.recipient) AND p.delivery_status='bounced')
 AND CASE WHEN json_extract(v.form_settings_json,'$.confirmation.emailStepId') IS NOT NULL THEN EXISTS(
 SELECT 1 FROM response_answers a JOIN flow_steps s ON s.revision_id=r.revision_id AND s.stable_id=a.step_id
 WHERE a.response_id=r.id AND s.kind='question' AND s.question_type='email' AND a.step_id=json_extract(v.form_settings_json,'$.confirmation.emailStepId')
 AND json_type(a.value_json)='text' AND json_extract(a.value_json,'$')=d.recipient)
 ELSE r.source='invitation' AND EXISTS(SELECT 1 FROM invitation_participants p JOIN distribution_contacts c ON c.id=p.contact_id
 WHERE p.id=r.participant_id AND c.opted_out_at IS NULL AND p.email_snapshot=d.recipient) END`
export async function auditConfirmation(db:D1Database,workspaceId:string,status:string,reason:string|null,now:string) {
 await db.prepare(`INSERT INTO audit_entries(id,workspace_id,kind,actor_operator_id,subject_type,subject_id,details_json,created_at)
 VALUES(?,?,'respondent.confirmation',NULL,'confirmation',NULL,?,?)`).bind(crypto.randomUUID(),workspaceId,JSON.stringify({status,reason}),now).run()
}
export async function materializeConfirmations(db:D1Database,now:string,origin='http://localhost') {
 const rows=await db.prepare(`SELECT r.id,r.workspace_id AS workspaceId,r.revision_id AS revisionId,r.response_context_json AS contextJson,
 v.form_settings_json AS settingsJson,v.policy_snapshot_json AS policyJson,
 (SELECT p.email_snapshot FROM invitation_participants p WHERE p.id=r.participant_id AND r.source='invitation') AS participantEmail
 FROM responses r JOIN flow_revisions v ON v.id=r.revision_id WHERE ${confirmationLive}
 AND NOT EXISTS(SELECT 1 FROM confirmation_deliveries d WHERE d.response_id=r.id) ORDER BY r.completed_at,r.id LIMIT 50`).all<ConfirmationCandidate>()
 for(const row of rows.results) {
  let prepared:Awaited<ReturnType<typeof prepareConfirmation>>=null,reason:string|null=null
  try { prepared=await prepareConfirmation(db,row,origin) }
  catch { reason='Confirmation preparation failed: retained questions, answers, settings or business branding could not be read or validated.' }
  reason ??= prepared ? null : 'Confirmation cancelled: no valid consented mailbox was selected on the completed path.'
  const status=prepared?'pending':reason?.startsWith('Confirmation preparation')?'failed':'cancelled'
  // Async graph/brand preparation cannot recreate erased work. SQLite serializes this guard and insert.
  const inserted=await db.prepare(`INSERT OR IGNORE INTO confirmation_deliveries(id,response_id,recipient,message_json,status,available_at,reason,armed,created_at,updated_at)
 SELECT 'confirmation:'||r.id,r.id,?,?,?, ?,?,1,?,? FROM responses r JOIN flow_revisions v ON v.id=r.revision_id
 WHERE r.id=? AND ${confirmationLive} AND v.form_settings_json=? AND r.response_context_json=?
 AND (? IS NULL OR EXISTS(SELECT 1 FROM (SELECT ? AS recipient) d WHERE ${confirmationRecipient}))`)
   .bind(prepared?.recipient??null,prepared?.messageJson??null,status,now,reason,now,now,row.id,row.settingsJson,row.contextJson,prepared?.recipient??null,prepared?.recipient??null).run()
  if(inserted.meta.changes && status!=='pending') await auditConfirmation(db,row.workspaceId,status,reason,now)
 }
}
