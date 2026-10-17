import { z } from 'zod'
import { ValidationError } from '../../shared/errors'
import { auditFiltersSchema, type AuditSnapshot, type AuditScope } from './model'

const bytes = new TextEncoder()
const encode = (value: Uint8Array) => btoa(String.fromCharCode(...value)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
const decode = (value: string) => Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), char => char.charCodeAt(0))
const snapshotSchema = z.object({
  workspaceId: z.string(), sessionId: z.string(), filters: auditFiltersSchema.strict(),
  cutoff: z.string().datetime(), ceiling: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  after: z.object({ createdAt: z.string(), id: z.string() }).strict().nullable(),
}).strict()
async function key(secret: string) {
  const material = await crypto.subtle.digest('SHA-256', bytes.encode(`pencil-audit-cursor-v1:${secret}`))
  return crypto.subtle.importKey('raw', material, 'AES-GCM', false, ['encrypt', 'decrypt'])
}
function binding(scope: AuditScope) { return bytes.encode(JSON.stringify(['Pencil audit cursor v1', scope.workspaceId, scope.sessionId])) }

export async function sealAuditCursor(snapshot: AuditSnapshot, secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: binding(snapshot) }, await key(secret), bytes.encode(JSON.stringify(snapshot)))
  return `v1.${encode(iv)}.${encode(new Uint8Array(cipher))}`
}
export async function openAuditCursor(token: string, secret: string, scope: AuditScope): Promise<AuditSnapshot> {
  try {
    if (token.length > 12000 || !/^v1\.[\w-]+\.[\w-]+$/.test(token)) throw new Error()
    const [, nonce, ciphertext] = token.split('.'), iv = decode(nonce)
    if (iv.length !== 12) throw new Error()
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: binding(scope) }, await key(secret), decode(ciphertext))
    const snapshot = snapshotSchema.parse(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(plaintext)))
    if (snapshot.workspaceId !== scope.workspaceId || snapshot.sessionId !== scope.sessionId) throw new Error()
    return snapshot
  } catch { throw new ValidationError('Invalid audit cursor. Start the audit search again.') }
}
