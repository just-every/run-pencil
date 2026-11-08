import { formSettings, hiddenValue, normalizeHidden, type FormSettings, type ResponseContext } from '../../shared/hiddenFields'
import { PencilError, ValidationError } from '../../shared/errors'

type Scope = { workspaceId: string; flowId: string; revisionId: string }
type Claim = Scope & { values: Record<string, string | number | boolean> }
export type IdentityInput = { identityLink?: string; removeIdentity?: boolean; hidden?: Record<string, unknown> }
export class IdentityLinkError extends PencilError {
  constructor(message = 'This identifying link could not be verified. Ask the operator for a new link.') { super('IDENTITY_LINK_INVALID', message) }
}
const key = (secret: string) => crypto.subtle.importKey('raw', new TextEncoder().encode(`pencil-identity-link.v1:${secret}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])

export async function issueIdentityLink(secret: string, scope: Scope, settings: FormSettings, raw: Record<string, unknown>) {
  if (settings.identityMode !== 'identified') throw new ValidationError('Publish this form with identified public links first.')
  const fields = settings.hiddenFields.filter(field => field.category === 'identifying')
  if (Object.keys(raw).some(name => !fields.some(field => field.name === name))) throw new ValidationError('Only declared identifying fields belong in this link.')
  const values: Claim['values'] = {}
  for (const [name, candidate] of Object.entries(raw)) {
    if (candidate === '') continue
    const value = hiddenValue(fields.find(field => field.name === name)!, candidate)
    if (value === undefined) throw new ValidationError(`Enter a valid value for ${name}.`)
    values[name] = value
  }
  if (!Object.keys(values).length) throw new ValidationError('Enter at least one identifying value.')
  const body = Buffer.from(JSON.stringify({ ...scope, values })).toString('base64url')
  return `${body}.${Buffer.from(await crypto.subtle.sign('HMAC', await key(secret), new TextEncoder().encode(body))).toString('base64url')}`
}

export async function readIdentityLink(secret: string, token: string, scope: Scope, settings: FormSettings) {
  let claim: Claim
  try {
    const [body, signature, extra] = token.split('.')
    if (!body || !signature || extra || !await crypto.subtle.verify('HMAC', await key(secret), Buffer.from(signature, 'base64url'), new TextEncoder().encode(body))) throw new Error()
    claim = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Claim
    if (claim.workspaceId !== scope.workspaceId || claim.flowId !== scope.flowId || !claim.values || settings.identityMode !== 'identified') throw new Error()
  } catch { throw new IdentityLinkError() }
  if (claim.revisionId !== scope.revisionId) throw new IdentityLinkError('This identifying link belongs to an earlier published revision. Ask the operator for a link to the current revision.')
  return claim.values
}

export async function identitySessionToken(random: string, token?: string) {
  if (!token) return random
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return `i.${random}.${Buffer.from(digest).toString('hex')}`
}

/** Only an opaque digest enters the session credential; identifying values never enter session metrics. */
export async function identityContext(secret: string, scope: Scope, settings: FormSettings, input: IdentityInput, sessionToken: string): Promise<ResponseContext> {
  if (sessionToken.startsWith('i.')) {
    if (!input.identityLink || await identitySessionToken(sessionToken.split('.')[1], input.identityLink) !== sessionToken) throw new IdentityLinkError('The identifying link cannot be replaced or omitted during collection.')
  } else if (input.identityLink) throw new IdentityLinkError('Start this identifying link again before answering.')
  if (!input.identityLink) return normalizeHidden(settings, input.hidden ?? {})
  const fixed = await readIdentityLink(secret, input.identityLink, scope, settings)
  const raw = input.hidden ?? {}
  for (const field of settings.hiddenFields.filter(field => field.category === 'identifying')) {
    const supplied = Object.hasOwn(raw, field.name)
    if (input.removeIdentity ? supplied : supplied && hiddenValue(field, raw[field.name]) !== fixed[field.name]) throw new IdentityLinkError('Identifying values cannot change. Use This isn’t me to remove them without replacement.')
  }
  const plain = Object.fromEntries(Object.entries(raw).filter(([name]) => !settings.hiddenFields.some(field => field.name === name && field.category === 'identifying')))
  return normalizeHidden(settings, { ...plain, ...(input.removeIdentity ? {} : fixed) })
}
