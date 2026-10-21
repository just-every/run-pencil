import { admittedResponseSql } from '../payments/admission'
import { z } from 'zod'
import type { MailSender } from '../../../base/operator-auth/index.mjs'
import type { FormSettings } from '../../shared/hiddenFields'
import { formSettings } from '../../shared/hiddenFields'
import { FlowClosedError, NotFoundError, PencilError, SessionUnavailableError, ValidationError } from '../../shared/errors'
import { createPasswordVerifier, hashCredential, signAdmissionGrant, verifyAdmissionGrant, verifyBusinessAppLink, verifyPassword, type AdmissionGrant } from './credentials'

const id = z.string().min(1).max(256).regex(/^[A-Za-z0-9_-]+$/)
const email = z.string().trim().max(320).email().toLowerCase()
const domain = z.string().trim().toLowerCase().max(253).regex(/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/)
const mode = z.enum(['password', 'email', 'signed'])
const reference = z.object({ id, mode }).strict()
const publicKey = z.string().regex(/^[A-Za-z0-9_-]{43}$/).refine(value => {
  try { const raw = atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='); return raw.length === 32 && btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') === value } catch { return false }
})
export const accessRuleInput = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('password'), password: z.string().min(1).max(256) }).strict(),
  z.object({ mode: z.literal('email'), domains: z.array(domain).max(100), emails: z.array(email).max(1000) }).strict().refine(value => value.domains.length + value.emails.length > 0),
  z.object({ mode: z.literal('signed'), publicKey }).strict(),
])
const location = { slug: id, revisionId: id }
const unlockInput = z.object({ ...location, password: z.string().min(1).max(256).optional(), challengeId: id.optional(), code: z.string().regex(/^\d{6}$/).optional(), signedLink: z.string().min(1).max(8192).optional() }).strict()
const requestInput = z.object({ ...location, email }).strict()
export type AccessReference = z.infer<typeof reference>
export type AccessRequirement = { mode: AccessReference['mode']; revisionId: string; title: string; slug: string }
export type AccessIdentity = { email?: string; subject?: string }
type Rule = { id: string; flow_id: string; mode: AccessReference['mode']; password_verifier: string | null; domains_json: string; emails_json: string; public_key: string | null }
type Revision = { is_current:number; flow_id: string; title: string; slug: string; status: string; form_settings_json: string; admission_closed_at: string | null; deadline_at: string | null; target_completed_responses: number | null; completed: number }
const unavailable = () => new PencilError('ACCESS_UNAVAILABLE', 'This form’s access requirement is unavailable. Contact the business for help.')
const invalid = () => new ValidationError('The access details are invalid or have expired. Try again.')
const mailUnavailable = () => new PencilError('ACCESS_MAIL_UNAVAILABLE', 'The verification email could not be sent. Please try again later.')
function parse<T>(schema: z.ZodType<T>, input: unknown): T { const result = schema.safeParse(input); if (!result.success) throw invalid(); return result.data }
function access(settings: FormSettings): AccessReference | undefined {
  const candidate = (settings as FormSettings & { access?: unknown }).access
  if (candidate === undefined) return undefined
  const result = reference.safeParse(candidate)
  if (!result.success) throw unavailable()
  return result.data
}
function identityMatches(rule: Rule, identity: AccessIdentity): boolean {
  return rule.mode === 'password' ? identity.email === undefined && identity.subject === undefined
    : rule.mode === 'email' ? !!identity.email && identity.email === identity.email.toLowerCase() && identity.subject === undefined
    : !!identity.subject && identity.email === undefined
}
function equalHash(a: string, b: string): boolean { let difference = a.length ^ b.length; for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ (b.charCodeAt(i) || 0); return difference === 0 }

export class AccessRequiredError extends PencilError {
  constructor(readonly requirement: AccessRequirement) { super('ACCESS_REQUIRED', 'Complete this form’s access requirement to continue.') }
}

export class RestrictedAccess {
  constructor(private readonly db: D1Database, private readonly secret: string, private readonly sender: MailSender, private readonly mail: { from: string; local: boolean }) {}

  requirement(settings: FormSettings, revisionId: string, title: string, slug: string): AccessRequirement | undefined {
    const ref = access(settings)
    return ref ? { mode: ref.mode, revisionId, title, slug } : undefined
  }

  private async rule(ref: AccessReference, revisionId: string): Promise<Rule> {
    const row = await this.db.prepare(`SELECT a.* FROM form_access_rules a JOIN flow_revisions r ON r.flow_id=a.flow_id
      WHERE a.id=? AND r.id=? AND r.state='published'`).bind(ref.id, revisionId).first<Rule>()
    if (!row || row.mode !== ref.mode || row.mode === 'password' && !row.password_verifier || row.mode === 'signed' && !publicKey.safeParse(row.public_key).success) throw unavailable()
    return row
  }

  private async unused(flowId: string, address: string) {
    if (await this.db.prepare('SELECT 1 FROM response_access WHERE flow_id=? AND email=?').bind(flowId, address).first()) {
      throw new PencilError('ACCESS_ALREADY_COMPLETED', 'This email address has already completed this form.')
    }
  }

  private allowed(rule: Rule, address: string): boolean {
    try {
      const domains = z.array(domain).max(100).parse(JSON.parse(rule.domains_json))
      const emails = z.array(email).max(1000).parse(JSON.parse(rule.emails_json))
      return emails.includes(address) || domains.includes(address.slice(address.lastIndexOf('@') + 1))
    } catch { throw unavailable() }
  }

  async require(settings: FormSettings, revisionId: string, title: string, slug: string, token?: string): Promise<AdmissionGrant | undefined> {
    const requirement = this.requirement(settings, revisionId, title, slug), ref = access(settings)
    if (!requirement || !ref) return undefined
    if(!token)throw new AccessRequiredError(requirement)
    const rule = await this.rule(ref, revisionId)
    const grant = token ? await verifyAdmissionGrant(token, this.secret, { ruleId: ref.id, revisionId }) : null
    if (!grant || !identityMatches(rule, grant)) throw new AccessRequiredError(requirement)
    if (grant.email) {
      if (!this.allowed(rule, grant.email)) throw new AccessRequiredError(requirement)
      await this.unused(rule.flow_id, grant.email)
    }
    return grant
  }

  async createRule(flowId: string, input: unknown): Promise<AccessReference> {
    parse(id, flowId)
    const value = parse(accessRuleInput, input), ruleId = crypto.randomUUID()
    const verifier = value.mode === 'password' ? await createPasswordVerifier(value.password) : null
    await this.db.prepare(`INSERT INTO form_access_rules(id,flow_id,mode,password_verifier,domains_json,emails_json,public_key,created_at)
      VALUES(?,?,?,?,?,?,?,?)`).bind(ruleId, flowId, value.mode, verifier,
      JSON.stringify(value.mode === 'email' ? [...new Set(value.domains)] : []), JSON.stringify(value.mode === 'email' ? [...new Set(value.emails)] : []),
      value.mode === 'signed' ? value.publicKey : null, new Date().toISOString()).run()
    return { id: ruleId, mode: value.mode }
  }

  async getRuleForRevision(slug: string, revisionId: string) {
    parse(id, slug); parse(id, revisionId)
    const row = await this.db.prepare(`SELECT r.*,f.slug,f.status,
      (SELECT count(*) FROM responses admitted WHERE admitted.revision_id=r.id AND ${admittedResponseSql('admitted')}) AS completed
      FROM flow_revisions r JOIN flows f ON f.id=r.flow_id WHERE f.slug=? AND r.id=? AND r.state='published'`)
      .bind(slug, revisionId).first<Revision>()
    if (!row || !['open', 'closed'].includes(row.status)) throw new NotFoundError('Form not found.')
    const now = new Date().toISOString()
    if (row.status === 'closed' && row.is_current || row.admission_closed_at || row.deadline_at && row.deadline_at <= now || row.target_completed_responses !== null && row.completed >= row.target_completed_responses) throw new FlowClosedError({ title: row.title, slug })
    let settings: FormSettings
    try { settings = formSettings(row.form_settings_json) } catch { throw unavailable() }
    const ref = access(settings)
    if (!ref) throw invalid()
    return { rule: await this.rule(ref, revisionId), settings, revisionId, title: row.title, slug, flowId: row.flow_id }
  }

  async requestCode(input: { slug: string; revisionId: string; email: string }): Promise<{ challengeId: string; expiresAt: string }> {
    const value = parse(requestInput, input), context = await this.getRuleForRevision(value.slug, value.revisionId)
    if (context.rule.mode !== 'email' || !this.allowed(context.rule, value.email)) throw invalid()
    await this.unused(context.flowId, value.email)
    const challengeId = crypto.randomUUID(), now = new Date().toISOString(), expiresAt = new Date(Date.now() + 10 * 60_000).toISOString()
    let number: number
    do { number = crypto.getRandomValues(new Uint32Array(1))[0] } while (number >= 4_294_000_000)
    const code = String(number % 1_000_000).padStart(6, '0')
    const hash = await hashCredential(`access-code.v1:${challengeId}:${code}`)
    await this.db.prepare(`INSERT INTO access_challenges(id,rule_id,revision_id,email,code_hash,attempts,expires_at,created_at,delivery_state)
      VALUES(?,?,?,?,?,0,?,?,'pending')`).bind(challengeId, context.rule.id, value.revisionId, value.email, hash, expiresAt, now).run()
    const title = context.title.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 150)
    let sent = false
    try {
      const outcome = await this.sender.send({ deliveryId: `access:${challengeId}`, from: this.mail.from, to: [value.email], subject: `Your verification code: ${title}`,
        text: `Your verification code is ${code}. It expires in 10 minutes. If you did not request it, ignore this email.`,
        html: `<p>Your verification code is <strong>${code}</strong>.</p><p>It expires in 10 minutes. If you did not request it, ignore this email.</p>`, headers: { 'Auto-Submitted': 'auto-generated' } })
      sent = outcome.status === 'accepted' || outcome.status === 'development' && this.mail.local
    } catch { /* Record the provider failure without exposing its message or the code. */ }
    await this.db.prepare("UPDATE access_challenges SET delivery_state=? WHERE id=? AND delivery_state='pending'").bind(sent ? 'sent' : 'failed', challengeId).run()
    if (!sent) throw mailUnavailable()
    return { challengeId, expiresAt }
  }

  async unlock(input: { slug: string; revisionId: string; password?: string; challengeId?: string; code?: string; signedLink?: string }): Promise<{ accessToken: string; verifiedEmail?: string; verifiedSubject?:string }> {
    const value = parse(unlockInput, input), context = await this.getRuleForRevision(value.slug, value.revisionId), rule = context.rule
    const identity: AccessIdentity = {}
    if (rule.mode === 'password') {
      if (!value.password || value.challengeId || value.code || value.signedLink || !rule.password_verifier || !await verifyPassword(value.password, rule.password_verifier)) throw invalid()
    } else if (rule.mode === 'signed') {
      if (!value.signedLink || value.password || value.challengeId || value.code || !rule.public_key) throw invalid()
      const link = await verifyBusinessAppLink(value.signedLink, rule.public_key, { revisionId: value.revisionId })
      if (!link) throw invalid()
      identity.subject = link.subject
    } else {
      if (!value.challengeId || !value.code || value.password || value.signedLink) throw invalid()
      const now = new Date().toISOString()
      const challenge = await this.db.prepare(`UPDATE access_challenges SET attempts=attempts+1
        WHERE id=? AND rule_id=? AND revision_id=? AND delivery_state='sent' AND expires_at>? AND attempts<5 RETURNING email,code_hash`)
        .bind(value.challengeId, rule.id, value.revisionId, now).first<{ email: string; code_hash: string }>()
      if (!challenge || !equalHash(await hashCredential(`access-code.v1:${value.challengeId}:${value.code}`), challenge.code_hash)) throw invalid()
      if (!this.allowed(rule, challenge.email)) throw invalid()
      await this.unused(context.flowId, challenge.email)
      const consumed = await this.db.prepare(`DELETE FROM access_challenges WHERE id=? AND rule_id=? AND revision_id=? AND code_hash=?
        AND attempts<=5 AND delivery_state='sent' AND expires_at>? RETURNING id`)
        .bind(value.challengeId, rule.id, value.revisionId, challenge.code_hash, new Date().toISOString()).first()
      if (!consumed) throw invalid()
      identity.email = challenge.email
    }
    const grant: AdmissionGrant = { ruleId: rule.id, revisionId: value.revisionId, ...identity, expiresAt: Date.now() + 60 * 60_000, nonce: crypto.randomUUID() }
    return { accessToken: await signAdmissionGrant(grant, this.secret), ...(identity.email ? { verifiedEmail: identity.email } : {}), ...(identity.subject ? {verifiedSubject:identity.subject} : {}) }
  }

  /** grant must come from require(), or from this service's verified unlock path. */
  async bindSession(sessionId: string, grant: AdmissionGrant | undefined): Promise<void> {
    if (!grant) return
    parse(id, sessionId)
    const row = await this.db.prepare('SELECT mode FROM form_access_rules WHERE id=?').bind(grant.ruleId).first<{ mode: Rule['mode'] }>()
    if (!row || !identityMatches(row as Rule, grant) || grant.expiresAt <= Date.now()) throw new SessionUnavailableError()
    const result = await this.db.prepare(`INSERT INTO session_access(session_id,rule_id,email,subject)
      SELECT s.id,a.id,?,? FROM respondent_sessions s JOIN flow_revisions r ON r.id=s.revision_id JOIN form_access_rules a ON a.flow_id=r.flow_id
      WHERE s.id=? AND s.revision_id=? AND s.completed_at IS NULL AND s.expires_at>? AND a.id=?
        AND json_extract(r.form_settings_json,'$.access.id')=a.id AND json_extract(r.form_settings_json,'$.access.mode')=a.mode
      ON CONFLICT(session_id) DO UPDATE SET rule_id=excluded.rule_id
        WHERE session_access.rule_id=excluded.rule_id AND session_access.email IS excluded.email AND session_access.subject IS excluded.subject
      RETURNING session_id`).bind(grant.email ?? null, grant.subject ?? null, sessionId, grant.revisionId, new Date().toISOString(), grant.ruleId).first()
    if (!result) throw new SessionUnavailableError()
  }

  async sessionIdentity(sessionId: string, settings: FormSettings): Promise<AccessIdentity | undefined> {
    const ref = access(settings)
    if (!ref) return undefined
    const row = await this.db.prepare(`SELECT a.email,a.subject FROM session_access a JOIN respondent_sessions s ON s.id=a.session_id
      JOIN flow_revisions r ON r.id=s.revision_id JOIN form_access_rules rule ON rule.id=a.rule_id AND rule.flow_id=r.flow_id
      WHERE a.session_id=? AND a.rule_id=? AND rule.mode=? AND json_extract(r.form_settings_json,'$.access.id')=rule.id
        AND json_extract(r.form_settings_json,'$.access.mode')=rule.mode`).bind(sessionId, ref.id, ref.mode).first<{ email: string | null; subject: string | null }>()
    const identity = row ? { ...(row.email !== null ? { email: row.email } : {}), ...(row.subject !== null ? { subject: row.subject } : {}) } : undefined
    if (!identity || !identityMatches({ mode: ref.mode } as Rule, identity)) throw new SessionUnavailableError()
    return identity
  }
}
