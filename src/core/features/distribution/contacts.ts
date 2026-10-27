import { ulid } from 'ulid'
import type { SmsService } from '../sms'
import { NotFoundError, ValidationError, ConflictError } from '../../shared/errors'
import { eraseContact } from './erasure'
import { contactSchema, contactColumns, contactLimits, decodeContact, type ContactRow } from './contact-model'
export class DistributionContacts {
  constructor(private readonly db: D1Database, private readonly sms?: SmsService) {}
  async save(workspaceId: string, input: unknown, actor?:string) { return this.write(workspaceId, input,undefined,actor) }
  async edit(workspaceId: string, id: string, input: unknown, actor?:string) { return this.write(workspaceId, input, id,actor) }
  private async write(workspaceId: string, input: unknown, id?: string, actor?:string) {
    const valid = contactSchema.safeParse(input)
    if (!valid.success) throw new ValidationError('Provide a name, valid email and bounded custom fields.')
    if (id && !await this.db.prepare('SELECT id FROM distribution_contacts WHERE workspace_id=? AND id=?').bind(workspaceId,id).first()) throw new NotFoundError('This contact is not in your workspace.')
    const data=valid.data
    if(data.smsConsent && (!data.mobile || !this.sms || !actor))throw new ValidationError('SMS consent requires a mobile number.')
    const now=new Date().toISOString(), contactId=id ?? ulid()
    try {
      if (id) await this.db.prepare('UPDATE distribution_contacts SET name=?,email=?,fields_json=?,updated_at=? WHERE id=? AND workspace_id=?').bind(data.name,data.email,JSON.stringify(data.fields),now,id,workspaceId).run()
      else {
        const result=await this.db.prepare(`INSERT INTO distribution_contacts(id,workspace_id,name,email,fields_json,created_at,updated_at)
          SELECT ?,?,?,?,?,?,? WHERE (SELECT count(*) FROM distribution_contacts WHERE workspace_id=?) < ?`).bind(contactId,workspaceId,data.name,data.email,JSON.stringify(data.fields),now,now,workspaceId,contactLimits.total).run()
        if (!result.meta.changes) throw new ValidationError('Contact limit reached.')
      }
    } catch(error) { if (String(error).includes('UNIQUE constraint')) throw new ConflictError('A contact with this email address already exists.'); throw error }
    if(data.timeZone!==undefined)await this.db.prepare('UPDATE distribution_contacts SET time_zone=?,updated_at=? WHERE id=? AND workspace_id=?').bind(data.timeZone,now,contactId,workspaceId).run()
    if(data.mobile!==undefined)await this.db.prepare('UPDATE distribution_contacts SET mobile=?,updated_at=? WHERE id=? AND workspace_id=?').bind(data.mobile,now,contactId,workspaceId).run()
    if(data.smsConsent&&data.mobile&&this.sms)await this.sms.consent(contactId,data.mobile,data.smsConsent.given,data.smsConsent.wording,'operator-recorded',actor)
    return decodeContact((await this.db.prepare(`SELECT ${contactColumns} FROM distribution_contacts WHERE id=?`).bind(contactId).first<ContactRow>())!)
  }
  async list(workspaceId: string, query = '', offset = 0, limit = 250) {
    return (await this.db.prepare(`SELECT ${contactColumns} FROM distribution_contacts WHERE workspace_id=? AND (instr(lower(name),lower(?))>0 OR instr(lower(email),lower(?))>0) ORDER BY name,id LIMIT ? OFFSET ?`).bind(workspaceId,query,query,limit,offset).all<ContactRow>()).results.map(decodeContact)
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
  async erase(workspaceId: string, contactId: string, operatorId: string) { return eraseContact(this.db,workspaceId,contactId,operatorId) }
  async optOut(token: string) {
    const participant = await this.db.prepare('SELECT contact_id AS contactId, workspace_id AS workspaceId FROM invitation_participants WHERE opt_out_token = ? AND contact_id IS NOT NULL').bind(token).first<{ contactId: string; workspaceId: string }>()
    if (!participant) throw new NotFoundError('This opt-out link is no longer available.')
    await this.consent({ ...participant, actor: 'recipient', source: 'invitation-opt-out', renewed: false })
  }
}
