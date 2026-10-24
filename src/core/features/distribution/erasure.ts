import { ulid } from 'ulid'
import { NotFoundError } from '../../shared/errors'
import { eraseContactLocalMail } from '../../platform/mail/erasure'
import { restoreCheckpoint } from '../../platform/restore/checkpoint'
import { analysisErasureStatements } from '../analysis'
/** Pencil's one cascade declaration; SQL below and existing response triggers apply it atomically. */
export const contactErasureCascade = [
  { target:'distribution_contacts.* (including fields_json)', action:'delete', reason:'Remove the contact and every custom field.' },
  { target:'contact_consent_events.*', action:'delete', reason:'Remove contact-linked consent history and source text.' },
  { target:'invitation_candidates.contact_id,email_snapshot,name_snapshot,outcome', action:'anonymise', reason:'Remove staged identity; pending selections become terminal so replay cannot recreate credentials.' },
  { target:'invitation_participants.contact_id,email_snapshot,name_snapshot,token,opt_out_token,completion_step_id', action:'anonymise', reason:'Revoke every invitation and erase identity while retaining delivery and completion facts.' },
  { target:'response_collector.*', action:'delete', reason:'Response deletion cascades collector attribution; no contact values are stored in the collector configuration.' },
  { target:'session_collector.*,invitation_launch_collector.*,collectors.*', action:'retained', reason:'Anonymous session attribution and operator campaign configuration contain no contact values.' },
  { target:'submission_workflows.*,submission_tags.*,submission_notes.*', action:'delete', reason:'Response foreign keys cascade internal workflow, tags and private notes.' },
  { target:'submission_statuses.*,submission_write_assertions.*', action:'retained', reason:'Per-form operator configuration and an empty transaction guard contain no contact data.' },
  { target:'responses.*,response_answers.*,response_outbox.*', action:'delete', reason:'Remove identified answers, responses and downstream payloads.' },
  { target:'rer_mail_development_outbox.*,local_mail_outbox.*', action:'delete', reason:'Remove invitation, reminder and response notification copies by delivery key.' },
  { target:'confirmation_deliveries.*,confirmation_attempts.*', action:'delete', reason:'Response cascade removes the receipt mailbox, rendered message and attempts; capture cleanup uses its delivery key.' },
  { target:'response_event_deliveries.*,response_event_attempts.*', action:'delete', reason:'The response-delete trigger removes its queued webhook events and attempts; the deletion notice keeps only the response ID until it is delivered or fails, then nothing.' },
  { target:'notification_deliveries.*,notification_attempts.*', action:'delete', reason:'Existing response trigger and foreign keys remove response-linked notifications and attempts.' },
  { target:'mail_deliveries.status,reason,provider_id', action:'anonymise', reason:'Cancel unsent work and remove free text/provider references; retain delivery facts.' },
  { target:'mail_delivery_attempts.reason,provider_id', action:'anonymise', reason:'Remove external references; retain append-only attempt kinds, times and ordinals.' },
  { target:'audit_entries.subject_id,details_json', action:'anonymise', reason:'Anonymise contact/response references; append completion counts only.' },
  { target:'revision_metric_counters.completions,total_completion_milliseconds,updated_at', action:'anonymise', reason:'Subtract erased released responses from aggregate counters.' },
  { target:'reporting_generations.generation,reporting_changes.*', action:'retained', reason:'Existing response triggers invalidate cached reports using non-identifying generations.' },
  { target:'form_import_native_clock.revision,form_import_native_epochs.*', action:'retained', reason:'Existing native custody triggers advance aggregate clock and remove any erased response epoch.' },
  { target:'distribution_segments.*', action:'retained', reason:'Rules are operator configuration; SQL matching excludes the removed contact without membership records.' },
  { target:'invitation_launches.*,flow_revisions.invitation_reserved_count', action:'retained', reason:'Policy participant IDs are opaque; evaluated policy, command identity and historical capacity contain no contact values.' },
  { target:'respondent_sessions.*,respondent_session_step_events.*,revision_step_metric_counters.*', action:'retained', reason:'Anonymous session metrics contain no participant/contact identity or answers.' },
  { target:'analysis_evidence.*,analysis_theme_members.*,analysis_quotes.*', action:'delete', reason:'Remove the erased responses from every analysis evidence set, theme and quote.' },
  { target:'analysis_themes.title,summary,analysis_recommendations.title,rationale,analysis_runs.summary', action:'anonymise', reason:'Withhold provider text that may paraphrase an erased response.' },
  { target:'restore_erasure_checkpoint.epoch', action:'retained', reason:'Advanced in the same batch, so rer import --journal refuses any archive made before this erasure.' },
] as const
export async function eraseContact(db:D1Database, workspaceId: string, contactId: string, operatorId: string) {
    const started=Date.now()
    if (!await db.prepare('SELECT id FROM distribution_contacts WHERE id = ? AND workspace_id = ?').bind(contactId, workspaceId).first()) throw new NotFoundError('This contact is not in your workspace.')
    const counts = (await db.prepare(`SELECT
      1 AS contacts,
      (SELECT count(*) FROM invitation_participants WHERE contact_id=?1 AND workspace_id=?2) AS participants,
      (SELECT count(*) FROM responses WHERE participant_id IN(SELECT id FROM invitation_participants WHERE contact_id=?1 AND workspace_id=?2)) AS responses,
      (SELECT count(*) FROM response_answers WHERE response_id IN(SELECT id FROM responses WHERE participant_id IN(SELECT id FROM invitation_participants WHERE contact_id=?1 AND workspace_id=?2))) AS answers,
      (SELECT count(*) FROM mail_deliveries WHERE participant_id IN(SELECT id FROM invitation_participants WHERE contact_id=?1 AND workspace_id=?2)) AS deliveries,
      (SELECT count(*) FROM mail_delivery_attempts WHERE delivery_id IN(SELECT id FROM mail_deliveries WHERE participant_id IN(SELECT id FROM invitation_participants WHERE contact_id=?1 AND workspace_id=?2))) AS attempts,
      ((SELECT count(*) FROM contact_consent_events WHERE contact_id=?1 AND workspace_id=?2)+(SELECT count(*) FROM sms_consent_events WHERE contact_id=?1)) AS consentEvents,
      ((SELECT count(*) FROM rer_mail_development_outbox WHERE json_extract(message,'$.deliveryId') IN(
        SELECT d.idempotency_key FROM mail_deliveries d JOIN invitation_participants p ON p.id=d.participant_id WHERE p.contact_id=?1 AND p.workspace_id=?2
        UNION
        SELECT d.idempotency_key FROM notification_deliveries d JOIN responses r ON r.id=d.response_id JOIN invitation_participants p ON p.id=r.participant_id WHERE p.contact_id=?1 AND p.workspace_id=?2
        UNION
        SELECT d.id FROM confirmation_deliveries d JOIN responses r ON r.id=d.response_id JOIN invitation_participants p ON p.id=r.participant_id WHERE p.contact_id=?1 AND p.workspace_id=?2))
       +(SELECT count(*) FROM local_mail_outbox WHERE delivery_id IN(SELECT d.idempotency_key FROM mail_deliveries d JOIN invitation_participants p ON p.id=d.participant_id WHERE p.contact_id=?1 AND p.workspace_id=?2))) AS localMessages
    `).bind(contactId,workspaceId).first())!
    const owned = `SELECT r.id FROM responses r JOIN invitation_participants p ON p.id = r.participant_id WHERE p.contact_id = ? AND p.workspace_id = ?`
    const now = new Date().toISOString()
    await db.batch([
      db.prepare(`INSERT INTO audit_entries (id, workspace_id, kind, actor_operator_id, subject_type, subject_id, details_json, created_at) VALUES (?, ?, 'contact.erased', ?, 'contact', NULL, ?, ?)`).bind(ulid(), workspaceId, operatorId, JSON.stringify(counts), now),
      db.prepare("UPDATE audit_entries SET subject_id = NULL, details_json = '{}' WHERE subject_type = 'contact' AND subject_id = ? AND workspace_id = ?").bind(contactId, workspaceId),
      db.prepare(`UPDATE revision_metric_counters SET completions = MAX(0, completions - (SELECT count(*) FROM responses WHERE id IN (${owned}) AND revision_id = revision_metric_counters.revision_id AND state = 'released')),
        total_completion_milliseconds = MAX(0, total_completion_milliseconds - COALESCE((SELECT SUM(completion_milliseconds) FROM responses WHERE id IN (${owned}) AND revision_id = revision_metric_counters.revision_id AND state = 'released'), 0)), updated_at = ?
        WHERE revision_id IN (SELECT revision_id FROM invitation_participants WHERE contact_id = ? AND workspace_id = ?)`).bind(contactId, workspaceId, contactId, workspaceId, now, contactId, workspaceId),
      db.prepare(`UPDATE audit_entries SET subject_id = NULL, details_json = '{}' WHERE subject_type = 'response' AND subject_id IN (${owned})`).bind(contactId, workspaceId),
      eraseContactLocalMail(db, contactId, workspaceId),
      db.prepare(`DELETE FROM local_mail_outbox WHERE delivery_id IN(SELECT d.idempotency_key FROM mail_deliveries d JOIN invitation_participants p ON p.id=d.participant_id WHERE p.contact_id=? AND p.workspace_id=?)`).bind(contactId,workspaceId),
      ...analysisErasureStatements(owned, [contactId, workspaceId], now).map(statement => db.prepare(statement.sql).bind(...statement.params ?? [])),
      db.prepare(`DELETE FROM response_answers WHERE response_id IN (${owned})`).bind(contactId, workspaceId),
      db.prepare(`DELETE FROM response_outbox WHERE response_id IN (${owned})`).bind(contactId, workspaceId),
      db.prepare(`DELETE FROM responses WHERE id IN (${owned})`).bind(contactId, workspaceId),
      db.prepare(`UPDATE mail_delivery_attempts SET reason = NULL, provider_id = NULL WHERE delivery_id IN (SELECT d.id FROM mail_deliveries d JOIN invitation_participants p ON p.id = d.participant_id WHERE p.contact_id = ? AND p.workspace_id = ?)`).bind(contactId, workspaceId),
      db.prepare(`UPDATE mail_deliveries SET status = CASE WHEN status IN ('pending','sending','unknown') THEN 'cancelled' ELSE status END, reason = NULL, provider_id = NULL WHERE participant_id IN (SELECT id FROM invitation_participants WHERE contact_id = ? AND workspace_id = ?)`).bind(contactId, workspaceId),
      db.prepare(`UPDATE invitation_participants SET contact_id = NULL, email_snapshot = NULL, name_snapshot = NULL, sms_mobile_snapshot = NULL, token = NULL, opt_out_token = NULL, completion_step_id = NULL WHERE contact_id = ? AND workspace_id = ?`).bind(contactId, workspaceId),
      db.prepare('DELETE FROM contact_consent_events WHERE contact_id = ? AND workspace_id = ?').bind(contactId, workspaceId),
      db.prepare(`UPDATE invitation_candidates SET contact_id=NULL,email_snapshot=NULL,name_snapshot=NULL,sms_mobile_snapshot=NULL,outcome=CASE WHEN outcome='pending' THEN 'noAddress' ELSE outcome END WHERE contact_id=? AND launch_id IN(SELECT id FROM invitation_launches WHERE workspace_id=?)`).bind(contactId,workspaceId),
      db.prepare('DELETE FROM distribution_contacts WHERE id = ? AND workspace_id = ?').bind(contactId, workspaceId),
      db.prepare(restoreCheckpoint.sql),
    ])
    return {completed:true as const,counts,elapsedMilliseconds:Date.now()-started}
  }
