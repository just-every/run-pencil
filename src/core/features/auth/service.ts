import { ulid } from 'ulid'
import type { AuditService } from '../audit'
import { ConflictError, ForbiddenError, PencilError, ValidationError } from '../../shared/errors'
import type { AuthRepository } from './repository'
import { createOperatorAuth, type OperatorAuth, type MailSender } from '../../../base/operator-auth/index.mjs'
import { baseMailSender } from '../../platform/mail/base.server'
import type { PencilPlatform } from '../../platform/runtime'
import { sendAuthMail } from './mailDelivery'

export type AuthRuntimeConfiguration = { readonly appOrigin: string }

function normalizeEmail(value: string) {
  const email = value.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ValidationError('Enter a valid operator email address.')
  }
  return email
}

export class AuthService {
  private readonly deliveredInvitations = new Set<string>()
  readonly native: OperatorAuth
  private readonly binding: D1Database
  constructor(
    private readonly repository: AuthRepository,
    platform: PencilPlatform,
    private readonly audit: Pick<AuditService, 'record'>,
    sender: MailSender = baseMailSender(platform.configuration.mail, platform.databaseBinding),
  ) {
    this.binding = platform.databaseBinding
    const config = platform.configuration
    const native = createOperatorAuth({ db: this.binding,
      config: { origin: config.appOrigin, OWNER_EMAIL: config.bootstrapAdminEmail ?? 'owner@aurora-coffee.test',
        SESSION_SECRET: config.sessionSecret, SETUP_TOKEN: config.setupToken,
        MAIL_FROM: config.mail.kind === 'local-development' ? 'no-reply@pencil.test' : config.mail.from,
        local: config.isLocalDevelopment, sessionSeconds: 30 * 86400 },
      mailSender: { send: async message => {
        await this.attachTokenOperator(message.deliveryId)
        const target = await this.repository.findOperatorByEmail(message.to[0])
        if (target) await this.audit.record({ workspaceId: target.workspaceId, kind: 'auth.magic_link_prepared', subjectType: 'operator', subjectId: target.id, details: { feature: 'operator-auth' } })
        const result = await sendAuthMail(sender, message, { audit: this.audit, operator: target, configuration: config })
        if (result.status === 'accepted' || result.status === 'development') {
          const operator = await this.repository.findOperatorByEmail(message.to[0])
          if (operator) await this.audit.record({ workspaceId: operator.workspaceId, kind: 'auth.magic_link_sent', subjectType: 'operator', subjectId: operator.id, details: { provider: result.provider, providerMessageId: result.providerMessageId } })
        }
        return result
      } },
      clientIp: request => config.isLocalDevelopment ? 'loopback' : request.headers.get('CF-Connecting-IP') ?? '',
      rolePolicy: ({ action, role }) => action !== 'operators:role' && (action !== 'operators:invite' || role === 'owner'),
    })
    this.native = { ...native, bootstrap: async (request, input) => {
      const result = await native.bootstrap(request, input)
      await this.attachOperator(result.operator.id, true)
      return result
    } }
  }

  private async attachTokenOperator(tokenId: string) {
    const token = await this.binding.prepare('SELECT operator_id,issuer_id FROM oa_tokens WHERE id=?').bind(tokenId).first<{ operator_id: string; issuer_id: string | null }>()
    if (!token) throw new Error('The authentication token is missing.')
    const created = await this.attachOperator(token.operator_id, !token.issuer_id)
    if (token.issuer_id && created) this.deliveredInvitations.add(created)
  }

  private async attachOperator(authId: string, setup: boolean) {
    const linked = await this.binding.prepare('SELECT operator_id FROM operator_auth_links WHERE auth_id=?').bind(authId).first()
    if (linked) return
    const id = ulid(), now = new Date().toISOString()
    await this.binding.batch([
      this.binding.prepare(`INSERT INTO operators(id,workspace_id,email,display_name,is_setup_operator,created_at,updated_at)
        SELECT ?,w.id,o.email,o.display_name,CASE WHEN ? AND w.setup_operator_initialized_at IS NULL THEN 1 ELSE 0 END,?,?
        FROM oa_operators o JOIN workspaces w ON w.id=COALESCE(
          (SELECT p.workspace_id FROM oa_tokens t JOIN operator_auth_links l ON l.auth_id=t.issuer_id JOIN operators p ON p.id=l.operator_id WHERE t.operator_id=o.id LIMIT 1),
          (SELECT id FROM workspaces ORDER BY created_at,id LIMIT 1))
        WHERE o.id=? AND NOT EXISTS(SELECT 1 FROM operator_auth_links WHERE auth_id=o.id)`)
        .bind(id,setup ? 1 : 0,now,now,authId),
      this.binding.prepare(`UPDATE workspaces SET setup_operator_initialized_at=COALESCE(setup_operator_initialized_at,?)
        WHERE id IN (SELECT workspace_id FROM operators WHERE id=? AND is_setup_operator=1)`).bind(now,id),
      this.binding.prepare(`INSERT INTO audit_entries(id,workspace_id,kind,actor_operator_id,subject_type,subject_id,details_json,created_at)
        SELECT ?,workspace_id,'operator.setup_bootstrapped',id,'operator',id,'{"feature":"operator-auth"}',?
        FROM operators WHERE id=? AND is_setup_operator=1`).bind(ulid(),now,id),
    ])
    return id
  }

  async ensureSetupOperator(input: { workspaceId: string; email: string }) {
    const email = normalizeEmail(input.email)
    const now = new Date().toISOString()
    const initialized = await this.repository.initializeSetupOperator({ workspaceId: input.workspaceId, email, now })
    if (initialized.kind === 'missing-workspace') throw new PencilError('SETUP_OPERATOR_CONFLICT', 'The configured setup workspace could not be found.')
    if (initialized.kind === 'conflict') throw new PencilError('SETUP_OPERATOR_CONFLICT', 'The configured setup operator belongs to a different workspace.')
    if (initialized.kind !== 'initialized') return undefined

    await this.audit.record({
      workspaceId: input.workspaceId,
      kind: 'operator.setup_bootstrapped',
      subjectType: 'operator',
      subjectId: initialized.operatorId,
      details: {},
    })
    return initialized.operatorId
  }

  async listLocalInbox(input: { email: string; isLocalDevelopment: boolean }) {
    if (!input.isLocalDevelopment) {
      throw new PencilError('NOT_FOUND', 'The local development inbox is unavailable.')
    }
    return this.repository.listLocalInbox(normalizeEmail(input.email))
  }

  async inviteOperator(input: { workspaceId: string; actorOperatorId: string; email: string; displayName: string; runtime: AuthRuntimeConfiguration; request: Request }) {
    const email = normalizeEmail(input.email)
    const displayName = input.displayName.trim()
    if (!displayName || displayName.length > 100) throw new ValidationError('Enter an operator name of at most 100 characters.')

    let created: Awaited<ReturnType<AuthRepository['findOperatorByEmail']>>
    try {
      await this.native.invite(input.request, { email, displayName, role: 'owner' })
      created = await this.repository.findOperatorByEmail(email)
      if (!created) throw new ConflictError('The invited operator could not be found.')
      await this.audit.record({
        workspaceId: input.workspaceId,
        kind: 'operator.invited',
        actorOperatorId: input.actorOperatorId,
        subjectType: 'operator',
        subjectId: created.id,
        details: {},
      })
    } catch (error) {
      created = await this.repository.findOperatorByEmail(email)
      if (!created || !this.deliveredInvitations.delete(created.id)) throw error
      let cleanup: Awaited<ReturnType<AuthRepository['discardUninvitedOperator']>>
      try { cleanup = await this.repository.discardUninvitedOperator(input.workspaceId, created.id) }
      catch {
        throw new PencilError('INVITATION_RECOVERY_REQUIRED', 'The invitation could not finish and its cleanup could not complete. Operator access may remain; reload the operator list before retrying.')
      }
      if (cleanup === 'protected') {
        // Delivery may have completed before the inviter removed themselves.
        // Never revoke the last remaining or setup operator during recovery.
        let recoveryAudited = true
        try {
          await this.audit.record({ workspaceId: input.workspaceId, kind: 'operator.invitation_retained',
            actorOperatorId: input.actorOperatorId, subjectType: 'operator', subjectId: created.id,
            details: { reason: 'last-or-setup-operator-protection' } })
        } catch { recoveryAudited = false }
        throw new PencilError('INVITATION_RECOVERY_REQUIRED', `The invitation could not finish. The added operator remains to preserve protected workspace access. Sign in again to review operators before retrying.${recoveryAudited ? '' : ' The recovery audit could not be recorded.'}`)
      }
      throw error
    }
    this.deliveredInvitations.delete(created.id)
    return { id: created.id }
  }

  async listOperators(workspaceId: string) {
    return this.repository.listOperators(workspaceId)
  }

  async removeOperator(input: { workspaceId: string; actorOperatorId: string; targetOperatorId: string }) {
    const result = await this.repository.removeOperator(input)
    if (result === 'missing') throw new ValidationError('That operator no longer exists in this workspace.')
    if (result === 'setup-protected') throw new ForbiddenError('The setup operator can remove themselves, but no other operator can remove them.')
    if (result === 'last-operator') throw new ForbiddenError('The last operator cannot be removed.')

  }

  async expireSessions(now: string, limit: number) {
    const result = await this.binding.prepare('DELETE FROM oa_sessions WHERE id IN (SELECT id FROM oa_sessions WHERE expires_at <= ? ORDER BY expires_at,id LIMIT ?)').bind(Date.parse(now), limit).run()
    await this.binding.prepare('DELETE FROM oa_limits WHERE window < ?').bind(Math.floor(Date.parse(now) / (15 * 60_000)) - 1).run()
    return result.meta.changes
  }

  async getSession(request: Request) {
    const session = await this.native.getSession(request)
    if (!session) return undefined
    const operator = await this.repository.findOperatorByAuthId(session.operatorId)
    if (!operator) return undefined
    return { id: session.id, expiresAt: new Date(session.expiresAt).toISOString(), operatorId: operator.id,
      email: operator.email, displayName: operator.displayName, workspaceId: operator.workspaceId }
  }
}
