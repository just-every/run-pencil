import { ulid } from 'ulid'
import { defaultDistributionPolicies, reminderDelayHours, type DistributionPolicies } from '../../shared/distributionPolicies'
import { NotFoundError, ValidationError } from '../../shared/errors'
const opaque = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('')
export class InvitationLaunches {
  constructor(private readonly db: D1Database, private readonly policies: DistributionPolicies = defaultDistributionPolicies) {}
  async launch(input: { workspaceId: string; flowId: string; contactIds: string[]; commandKey: string; operatorId: string }) {
    if (!input.contactIds.length || input.contactIds.length > 1000 || new Set(input.contactIds).size !== input.contactIds.length) throw new ValidationError('Choose 1–1000 distinct contacts.')
    const prior = await this.db.prepare('SELECT id, revision_id AS revisionId FROM invitation_launches WHERE workspace_id = ? AND command_key = ?').bind(input.workspaceId, input.commandKey).first<{ id: string; revisionId: string }>()
    if (prior) {
      const revision = await this.db.prepare('SELECT flow_id FROM flow_revisions WHERE id = ?').bind(prior.revisionId).first<{ flow_id: string }>()
      if (revision?.flow_id !== input.flowId) throw new ValidationError('This launch key belongs to another flow.')
      return prior
    }
    const now = new Date().toISOString(), id = ulid()
    const revision = await this.db.prepare(`SELECT r.id FROM flow_revisions r JOIN flows f ON f.id = r.flow_id
      WHERE f.workspace_id = ? AND f.id = ? AND f.status = 'open' AND r.is_current = 1 AND r.state = 'published'
      AND r.admission_closed_at IS NULL AND (r.deadline_at IS NULL OR r.deadline_at > ?)
      AND (r.target_completed_responses IS NULL OR (SELECT count(*) FROM responses WHERE revision_id = r.id AND state = 'released') < r.target_completed_responses)`)
      .bind(input.workspaceId, input.flowId, now).first<{ id: string }>()
    if (!revision) throw new NotFoundError('This flow has no open published revision.')
    const statements = [this.db.prepare(`INSERT OR IGNORE INTO invitation_launches (id, workspace_id, revision_id, command_key, policy_json, actor_operator_id, created_at)
      VALUES (?, ?, ?, ?, ?, (SELECT id FROM operators WHERE id = ? AND workspace_id = ?), ?)`).bind(id, input.workspaceId, revision.id, input.commandKey,
      JSON.stringify({ audience: 'existing-consenting-email-not-previously-invited', reminderDelayHours: reminderDelayHours(this.policies), admission: 'one-completion', identity: 'identified' }), input.operatorId, input.workspaceId, now)]
    for (const contactId of input.contactIds) {
      const participantId = ulid(), deliveryId = ulid()
      statements.push(this.db.prepare(`INSERT OR IGNORE INTO invitation_participants
        (id, launch_id, workspace_id, revision_id, contact_id, email_snapshot, name_snapshot, token, opt_out_token, delivery_status, response_status, created_at)
        SELECT ?, ?, ?, ?, c.id, c.email, c.name, ?, ?, 'queued', 'not-started', ? FROM distribution_contacts c
        JOIN flow_revisions r ON r.id = ? JOIN flows f ON f.id = r.flow_id
        WHERE c.id = ? AND c.workspace_id = ? AND c.opted_out_at IS NULL AND length(c.email) > 0
        AND f.status = 'open' AND r.admission_closed_at IS NULL AND (r.deadline_at IS NULL OR r.deadline_at > ?)
        AND (r.target_completed_responses IS NULL OR (SELECT count(*) FROM responses WHERE revision_id = r.id AND state = 'released') < r.target_completed_responses)
        AND EXISTS (SELECT 1 FROM invitation_launches WHERE id = ?)`)
        .bind(participantId, id, input.workspaceId, revision.id, opaque(), opaque(), now, revision.id, contactId, input.workspaceId, now, id))
      statements.push(this.db.prepare(`INSERT INTO mail_deliveries (id, participant_id, kind, status, idempotency_key, available_at, created_at, updated_at)
        SELECT ?, id, 'invitation', 'pending', ?, ?, ?, ? FROM invitation_participants WHERE id = ?`)
        .bind(deliveryId, `invitation:${participantId}`, now, now, now, participantId))
    }
    await this.db.batch(statements)
    return (await this.db.prepare('SELECT id, revision_id AS revisionId FROM invitation_launches WHERE workspace_id = ? AND command_key = ?').bind(input.workspaceId, input.commandKey).first<{ id: string; revisionId: string }>())!
  }
  async list(workspaceId: string, flowId: string) {
    if (!await this.db.prepare('SELECT id FROM flows WHERE id = ? AND workspace_id = ?').bind(flowId, workspaceId).first()) throw new NotFoundError('This flow is not in your workspace.')
    return (await this.db.prepare(`SELECT p.id, p.name_snapshot AS name, p.email_snapshot AS email, p.revision_id AS revisionId,
      p.delivery_status AS deliveryStatus, p.response_status AS responseStatus, c.opted_out_at AS optedOutAt,
      d.id AS deliveryId, d.kind, d.status, d.reason, d.attempts, d.available_at AS availableAt FROM invitation_participants p
      JOIN flow_revisions r ON r.id = p.revision_id LEFT JOIN distribution_contacts c ON c.id = p.contact_id
      JOIN mail_deliveries d ON d.participant_id = p.id WHERE p.workspace_id = ? AND r.flow_id = ? ORDER BY p.created_at DESC, d.kind`)
      .bind(workspaceId, flowId).all()).results
  }
}
