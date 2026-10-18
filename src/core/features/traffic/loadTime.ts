import { ValidationError } from '../../shared/errors'

const encoder = new TextEncoder()
const maximumAge = 30 * 24 * 60 * 60 * 1000
const invalid = () => new ValidationError('Form load-time is invalid. Reload the form and try again.')
const positiveInteger = (value: number) => Number.isSafeInteger(value) && value > 0
const material = (revisionId: string, at: number) => encoder.encode(JSON.stringify(['pencil-form-load', 'v1', revisionId, at]))

async function key(secret: string, revisionId: string, usage: 'sign' | 'verify') {
  if (typeof secret !== 'string' || !secret.length || typeof revisionId !== 'string' || !revisionId.length) throw invalid()
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [usage])
}

// Equal revision/timestamp pairs deliberately produce equal tokens: no visitor identity or nonce.
export async function issueLoadTime(secret: string, revisionId: string, at = Date.now()): Promise<string> {
  if (!positiveInteger(at)) throw invalid()
  try {
    const signature = new Uint8Array(await crypto.subtle.sign('HMAC', await key(secret, revisionId, 'sign'), material(revisionId, at)))
    return `v1.${at}.${Array.from(signature, byte => byte.toString(16).padStart(2, '0')).join('')}`
  } catch { throw invalid() }
}

export async function verifyLoadTime(secret: string, revisionId: string, token: string, now = Date.now()): Promise<number> {
  if (token === undefined || token === null || token === '') throw new ValidationError('Form load-time is missing. Reload the form and try again.')
  if (typeof token !== 'string' || token.length > 84 || !positiveInteger(now)) throw invalid()
  const parsed = /^v1\.([1-9]\d{0,15})\.([0-9a-f]{64})$/.exec(token)
  if (!parsed) throw invalid()
  const at = Number(parsed[1])
  if (!positiveInteger(at)) throw invalid()
  const signature = Uint8Array.from(parsed[2].match(/../g)!, byte => Number.parseInt(byte, 16))
  try {
    if (!await crypto.subtle.verify('HMAC', await key(secret, revisionId, 'verify'), signature, material(revisionId, at))) throw invalid()
  } catch { throw invalid() }
  if (at > now) throw invalid()
  if (now - at > maximumAge) throw new ValidationError('Form load-time has expired. Reload the form and try again.')
  return at
}
