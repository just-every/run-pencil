import { ulid } from 'ulid'
import { z } from 'zod'
import { NotFoundError, ValidationError } from '../../shared/errors'
import { eraseContactLocalMail } from '../../platform/mail/erasure'
export class DistributionContacts {
  constructor(private readonly db: D1Database) {}
  async save(workspaceId: string, input: { email: string; name: string }) {
    const valid = z.object({ email: z.email().max(320), name: z.string().trim().min(1).max(200) }).safeParse(input)
    if (!valid.success) throw new ValidationError('Provide a name and valid email address.')
    const id = ulid(), now = new Date().toISOString()
    await this.db.prepare(`INSERT INTO distribution_contacts (id, workspace_id, email, name, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(workspace_id, email) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at`)
      .bind(id, workspaceId, valid.data.email, valid.data.name, now, now).run()
    return this.db.prepare('SELECT id, name, email, opted_out_at AS optedOutAt FROM distribution_contacts WHERE workspace_id = ? AND email = ? COLLATE NOCASE').bind(workspaceId, valid.data.email).first()
  }
  async list(workspaceId: string) {
    return (await this.db.prepare('SELECT id, name, email, opted_out_at AS optedOutAt FROM distribution_contacts WHERE workspace_id = ? ORDER BY name, id LIMIT 1000').bind(workspaceId).all()).results
  }
  async consent(input: { workspaceId: string; contactId: string; actor: string; source: string; renewed: boolean }) {
    if (!input.actor.trim() || !input.source.trim() || input.source.length > 200) throw new ValidationError('Consent requires its actor and source.')
    const id = ulid(), now = new Date().toISOString()
    const results = await this.db.batch([
      this.db.prepare(`INSERT INTO contact_consent_events (id, contact_id, workspace_id, consent, actor, source, created_at)
        SELECT ?, id, workspace_id, ?, CASE WHEN ? = 'recipient' THEN 'recipient' ELSE COALESCE((SELECT id FROM operators WHERE id = ? AND workspace_id = distribution_contacts.workspace_id), 'erased-operator') END, ?, ? FROM distribution_contacts WHERE id = ? AND workspace_id = ?`)
        .bind(id, input.renewed ? 'renewed' : 'opted-out', input.actor, input.actor, input.source, now, input.contactId, input.workspaceId),
      this.db.prepare(`INSERT INTO audit_entries (id, workspace_id, kind, actor_operator_id, subject_type, subject_id, details_json, created_at)
        SELECT ?, workspace_id, 'contact.consent-changed', (SELECT id FROM operators WHERE id = ? AND workspace_id = distribution_contacts.workspace_id), 'contact', id, ?, ? FROM distribution_contacts
        WHERE id = ? AND workspace_id = ? AND EXISTS (SELECT 1 FROM contact_consent_events WHERE id = ?)` )
        .bind(ulid(), input.actor, JSON.stringify({ feature: 'distribution-consent', consent: input.renewed ? 'renewed' : 'opted-out' }), now, input.contactId, input.workspaceId, id),
      this.db.prepare('UPDATE distribution_contacts SET opted_out_at = ?, updated_at = ? WHERE id = ? AND workspace_id = ? AND EXISTS (SELECT 1 FROM contact_consent_events WHERE id = ?)')
        .bind(input.renewed ? null : now, now, input.contactId, input.workspaceId, id),
      this.db.prepare(`UPDATE mail_deliveries SET status = 'cancelled', reason = 'Contact opted out.', updated_at = ?
        WHERE status = 'pending' AND ? = 0 AND participant_id IN (SELECT id FROM invitation_participants WHERE contact_id = ? AND workspace_id = ?)`)
        .bind(now, input.renewed ? 1 : 0, input.contactId, input.workspaceId),
    ])
    if (!results[0].meta.changes) throw new NotFoundError('This contact is not in your workspace.')
  }
  async erase(workspaceId: string, contactId: string, operatorId: string) {
    if (!await this.db.prepare('SELECT id FROM distribution_contacts WHERE id = ? AND workspace_id = ?').bind(contactId, workspaceId).first()) throw new NotFoundError('This contact is not in your workspace.')
    const owned = `SELECT r.id FROM responses r JOIN invitation_participants p ON p.id = r.participant_id WHERE p.contact_id = ? AND p.workspace_id = ?`
    const now = new Date().toISOString()
    await this.db.batch([
      this.db.prepare(`INSERT INTO audit_entries (id, workspace_id, kind, actor_operator_id, subject_type, subject_id, details_json, created_at) VALUES (?, ?, 'contact.erased', ?, 'contact', NULL, '{}', ?)`).bind(ulid(), workspaceId, operatorId, now),
      this.db.prepare("UPDATE audit_entries SET subject_id = NULL, details_json = '{}' WHERE subject_type = 'contact' AND subject_id = ? AND workspace_id = ?").bind(contactId, workspaceId),
      this.db.prepare(`UPDATE revision_metric_counters SET completions = MAX(0, completions - (SELECT count(*) FROM responses WHERE id IN (${owned}) AND revision_id = revision_metric_counters.revision_id AND state = 'released')),
        total_completion_milliseconds = MAX(0, total_completion_milliseconds - COALESCE((SELECT SUM(completion_milliseconds) FROM responses WHERE id IN (${owned}) AND revision_id = revision_metric_counters.revision_id AND state = 'released'), 0)), updated_at = ?
        WHERE revision_id IN (SELECT revision_id FROM invitation_participants WHERE contact_id = ? AND workspace_id = ?)`).bind(contactId, workspaceId, contactId, workspaceId, now, contactId, workspaceId),
      this.db.prepare(`UPDATE audit_entries SET subject_id = NULL, details_json = '{}' WHERE subject_type = 'response' AND subject_id IN (${owned})`).bind(contactId, workspaceId),
      eraseContactLocalMail(this.db, contactId, workspaceId),
      this.db.prepare(`DELETE FROM response_answers WHERE response_id IN (${owned})`).bind(contactId, workspaceId),
      this.db.prepare(`DELETE FROM response_outbox WHERE response_id IN (${owned})`).bind(contactId, workspaceId),
      this.db.prepare(`DELETE FROM responses WHERE id IN (${owned})`).bind(contactId, workspaceId),
      this.db.prepare(`UPDATE mail_delivery_attempts SET reason = NULL, provider_id = NULL WHERE delivery_id IN (SELECT d.id FROM mail_deliveries d JOIN invitation_participants p ON p.id = d.participant_id WHERE p.contact_id = ? AND p.workspace_id = ?)`).bind(contactId, workspaceId),
      this.db.prepare(`UPDATE mail_deliveries SET status = CASE WHEN status IN ('pending','sending','unknown') THEN 'cancelled' ELSE status END, reason = NULL, provider_id = NULL WHERE participant_id IN (SELECT id FROM invitation_participants WHERE contact_id = ? AND workspace_id = ?)`).bind(contactId, workspaceId),
      this.db.prepare(`UPDATE invitation_participants SET contact_id = NULL, email_snapshot = NULL, name_snapshot = NULL, token = NULL, opt_out_token = NULL, completion_step_id = NULL WHERE contact_id = ? AND workspace_id = ?`).bind(contactId, workspaceId),
      this.db.prepare('DELETE FROM contact_consent_events WHERE contact_id = ? AND workspace_id = ?').bind(contactId, workspaceId),
      this.db.prepare('DELETE FROM distribution_contacts WHERE id = ? AND workspace_id = ?').bind(contactId, workspaceId),
    ])
  }
  async optOut(token: string) {
    const participant = await this.db.prepare('SELECT contact_id AS contactId, workspace_id AS workspaceId FROM invitation_participants WHERE opt_out_token = ? AND contact_id IS NOT NULL').bind(token).first<{ contactId: string; workspaceId: string }>()
    if (!participant) throw new NotFoundError('This opt-out link is no longer available.')
    await this.consent({ ...participant, actor: 'recipient', source: 'invitation-opt-out', renewed: false })
  }
}
