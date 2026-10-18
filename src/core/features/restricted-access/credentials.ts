const encoder = new TextEncoder()
const decoder = new TextDecoder('utf-8', { fatal: true })
const maximumLifetime = 24 * 60 * 60 * 1000
const passwordIterations = 100_000
const admissionPurpose = 'pencil-restricted-admission.v1\0'

export type PasswordVerifier = { salt: string; hash: string }
export type AdmissionGrant = {
  ruleId: string
  revisionId: string
  email?: string
  subject?: string
  /** Epoch milliseconds. */
  expiresAt: number
  nonce: string
}
export type BusinessAppLink = {
  revisionId: string
  /** Epoch milliseconds. */
  expiresAt: number
  subject: string
}
export type RevisionVerification = { revisionId: string; now?: number }
export type AdmissionVerification = RevisionVerification & { ruleId: string }

function encode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function decode(value: unknown, byteLength?: number): Uint8Array<ArrayBuffer> | null {
  if (typeof value !== 'string' || !value.length || value.length > 8192 || !/^[A-Za-z0-9_-]+$/.test(value)) return null
  try {
    const raw = atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4))
    const bytes = Uint8Array.from(raw, char => char.charCodeAt(0))
    return encode(bytes) === value && (byteLength === undefined || bytes.length === byteLength) ? bytes : null
  } catch { return null }
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function fields(value: Record<string, unknown>, allowed: string[]): boolean {
  return Object.keys(value).every(key => allowed.includes(key))
}

function text(value: unknown, limit = 256): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= limit && value.trim().length > 0 && !/[\u0000-\u001f\u007f]/.test(value)
}

function expiration(value: unknown, now: number): value is number {
  return Number.isSafeInteger(now) && now > 0 && typeof value === 'number' && Number.isSafeInteger(value)
    && value > now && value - now <= maximumLifetime
}

function admission(value: unknown, now: number): value is AdmissionGrant {
  return object(value) && fields(value, ['ruleId', 'revisionId', 'email', 'subject', 'expiresAt', 'nonce'])
    && text(value.ruleId) && text(value.revisionId) && text(value.nonce)
    && expiration(value.expiresAt, now)
    && (!Object.hasOwn(value, 'email') || (text(value.email, 320) && /^[^\s@]+@[^\s@]+$/.test(value.email)))
    && (!Object.hasOwn(value, 'subject') || text(value.subject, 1000))
}

function businessLink(value: unknown, now: number): value is BusinessAppLink {
  return object(value) && fields(value, ['revisionId', 'expiresAt', 'subject'])
    && text(value.revisionId) && text(value.subject, 1000) && expiration(value.expiresAt, now)
}

function validPassword(password: unknown): password is string {
  return typeof password === 'string' && password.length > 0 && password.length <= 4096
}

async function passwordHash(password: string, salt: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', iterations: passwordIterations, salt }, key, 256))
}

/** Only the returned JSON {salt,hash} is stored; neither field contains plaintext. */
export async function createPasswordVerifier(password: string): Promise<string> {
  if (!validPassword(password)) throw new Error('Invalid access password.')
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const verifier: PasswordVerifier = { salt: encode(salt), hash: encode(await passwordHash(password, salt)) }
  return JSON.stringify(verifier)
}

export async function verifyPassword(password: string, serialized: string): Promise<boolean> {
  if (!validPassword(password) || typeof serialized !== 'string' || serialized.length > 256) return false
  let verifier: unknown
  try { verifier = JSON.parse(serialized) } catch { return false }
  if (!object(verifier) || !fields(verifier, ['salt', 'hash'])) return false
  const salt = decode(verifier.salt, 16), expected = decode(verifier.hash, 32)
  if (!salt || !expected) return false
  const actual = await passwordHash(password, salt)
  let difference = 0
  for (let index = 0; index < expected.length; index++) difference |= actual[index] ^ expected[index]
  return difference === 0
}

/** SHA-256 base64url digest for opaque bearer and one-time-code storage. */
export async function hashCredential(value: string): Promise<string> {
  if (typeof value !== 'string' || !value.length) throw new Error('Invalid access credential.')
  return encode(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))))
}

async function admissionKey(secret: string, usage: 'sign' | 'verify'): Promise<CryptoKey> {
  if (typeof secret !== 'string' || !secret.length) throw new Error('Access signing is not configured.')
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [usage])
}

function parseToken(token: string, signatureLength: number): { encoded: string; signature: Uint8Array<ArrayBuffer>; payload: unknown } | null {
  if (typeof token !== 'string' || token.length > 8192) return null
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const bytes = decode(parts[0]), signature = decode(parts[1], signatureLength)
  if (!bytes || !signature) return null
  try { return { encoded: parts[0], signature, payload: JSON.parse(decoder.decode(bytes)) } } catch { return null }
}

/** The caller supplies the installation session secret and a fresh random nonce. */
export async function signAdmissionGrant(payload: AdmissionGrant, sessionSecret: string, now = Date.now()): Promise<string> {
  if (!admission(payload, now)) throw new Error('Invalid admission grant.')
  const grant: AdmissionGrant = { ruleId: payload.ruleId, revisionId: payload.revisionId, expiresAt: payload.expiresAt, nonce: payload.nonce,
    ...(payload.email !== undefined ? { email: payload.email } : {}), ...(payload.subject !== undefined ? { subject: payload.subject } : {}) }
  const encoded = encode(encoder.encode(JSON.stringify(grant)))
  const signature = await crypto.subtle.sign('HMAC', await admissionKey(sessionSecret, 'sign'), encoder.encode(admissionPurpose + encoded))
  return `${encoded}.${encode(new Uint8Array(signature))}`
}

export async function verifyAdmissionGrant(token: string, sessionSecret: string, expected: AdmissionVerification): Promise<AdmissionGrant | null> {
  const key = await admissionKey(sessionSecret, 'verify')
  const parsed = parseToken(token, 32)
  if (!parsed || !admission(parsed.payload, expected.now ?? Date.now())
    || parsed.payload.ruleId !== expected.ruleId || parsed.payload.revisionId !== expected.revisionId) return null
  if (!await crypto.subtle.verify('HMAC', key, parsed.signature, encoder.encode(admissionPurpose + parsed.encoded))) return null
  return parsed.payload
}

/** Business apps sign the exact base64url JSON payload using their own Ed25519 private key. */
export async function verifyBusinessAppLink(token: string, publicKey: string, expected: RevisionVerification): Promise<BusinessAppLink | null> {
  const parsed = parseToken(token, 64), rawKey = decode(publicKey, 32)
  if (!parsed || !rawKey || !businessLink(parsed.payload, expected.now ?? Date.now()) || parsed.payload.revisionId !== expected.revisionId) return null
  try {
    const key = await crypto.subtle.importKey('raw', rawKey, 'Ed25519', false, ['verify'])
    return await crypto.subtle.verify('Ed25519', key, parsed.signature, encoder.encode(parsed.encoded)) ? parsed.payload : null
  } catch { return null }
}
