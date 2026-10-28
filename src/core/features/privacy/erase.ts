import { eraseContact } from '../distribution'
import { eraseResponseAndImportCustody } from '../importing/server'
import { responseErasureStatements } from '../responses'
import { restoreCheckpoint } from '../../platform/restore/checkpoint'
import { identifierCte, matchingValue } from './identity'
import type { PrivacySelection } from './selection'

export async function erasePrivacyData(db: D1Database, workspaceId: string, operatorId: string, sessionId: string, selected: PrivacySelection) {
  const now = new Date().toISOString()
  // Each response keeps DATA-002's imported-capture tombstones and live authority predicates.
  for (const response of selected.responses) {
    const input = { workspaceId, operatorId, sessionId, responseId: response.id, state: response.state, now }
    await eraseResponseAndImportCustody(db, input, responseErasureStatements(input, crypto.randomUUID()))
  }
  for (const contact of selected.contacts) await eraseContact(db, workspaceId, contact.id, operatorId)
  const participants = JSON.stringify(selected.participants.map(row => row.id))
  const sessions = JSON.stringify(selected.sessionIds)
  await db.batch([
    db.prepare(`UPDATE mail_delivery_attempts SET reason=NULL,provider_id=NULL WHERE delivery_id IN(SELECT id FROM mail_deliveries WHERE participant_id IN(SELECT value FROM json_each(?)))`).bind(participants),
    db.prepare(`UPDATE mail_deliveries SET status=CASE WHEN status IN('pending','sending','unknown') THEN 'cancelled' ELSE status END,reason=NULL,provider_id=NULL WHERE participant_id IN(SELECT value FROM json_each(?))`).bind(participants),
    db.prepare(`DELETE FROM rer_mail_development_outbox WHERE json_extract(message,'$.deliveryId') IN(SELECT idempotency_key FROM mail_deliveries WHERE participant_id IN(SELECT value FROM json_each(?)))`).bind(participants),
    db.prepare(`DELETE FROM local_mail_outbox WHERE delivery_id IN(SELECT idempotency_key FROM mail_deliveries WHERE participant_id IN(SELECT value FROM json_each(?)))`).bind(participants),
    db.prepare(`UPDATE invitation_participants SET contact_id=NULL,email_snapshot=NULL,name_snapshot=NULL,sms_mobile_snapshot=NULL,token=NULL,opt_out_token=NULL,completion_step_id=NULL WHERE workspace_id=? AND id IN(SELECT value FROM json_each(?))`).bind(workspaceId, participants),
    db.prepare(`${identifierCte} UPDATE invitation_candidates SET contact_id=NULL,email_snapshot=NULL,name_snapshot=NULL,sms_mobile_snapshot=NULL,outcome=CASE WHEN outcome='pending' THEN 'noAddress' ELSE outcome END WHERE launch_id IN(SELECT id FROM invitation_launches WHERE workspace_id=?) AND (${matchingValue('email_snapshot')} OR ${matchingValue('sms_mobile_snapshot')})`).bind(selected.known, workspaceId),
    db.prepare('DELETE FROM respondent_session_step_events WHERE session_id IN(SELECT value FROM json_each(?))').bind(sessions),
    db.prepare('DELETE FROM respondent_sessions WHERE id IN(SELECT value FROM json_each(?))').bind(sessions),
    db.prepare('DELETE FROM respondent_saves WHERE session_id IN(SELECT value FROM json_each(?))').bind(sessions),
    db.prepare(`${identifierCte} DELETE FROM access_challenges WHERE rule_id IN(SELECT a.id FROM form_access_rules a JOIN flows f ON f.id=a.flow_id WHERE f.workspace_id=?) AND ${matchingValue('email')}`).bind(selected.known, workspaceId),
    db.prepare(`INSERT INTO audit_entries(id,workspace_id,kind,actor_operator_id,subject_type,subject_id,details_json,created_at) VALUES(?,?,'privacy.erased',?,'privacy-request',NULL,?,?)`).bind(crypto.randomUUID(), workspaceId, operatorId, JSON.stringify(selected.counts), now),
    db.prepare(restoreCheckpoint.sql),
  ])
}
