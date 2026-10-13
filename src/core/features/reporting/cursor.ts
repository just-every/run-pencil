import { ValidationError } from '../../shared/errors'
const bytes = new TextEncoder()
const encode = (value: Uint8Array) => btoa(String.fromCharCode(...value)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')
const decode = (value: string) => Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')), char => char.charCodeAt(0))
const context = bytes.encode('Pencil report cursor v1')
async function key(secret: string) {
  const material = await crypto.subtle.digest('SHA-256', bytes.encode(secret))
  return crypto.subtle.importKey('raw', material, 'AES-GCM', false, ['encrypt','decrypt'])
}
export async function sealCursor(value: object, secret: string) {
  const nonce = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt({name:'AES-GCM',iv:nonce,additionalData:context},await key(secret),bytes.encode(JSON.stringify(value)))
  return `v1.${encode(nonce)}.${encode(new Uint8Array(ciphertext))}`
}
export async function openCursor<T>(token: string, secret: string): Promise<T> {
  try {
    if (token.length > 65536 || !/^v1\.[\w-]+\.[\w-]+$/.test(token)) throw new Error()
    const [,nonce,ciphertext] = token.split('.')
    const iv = decode(nonce)
    if (iv.length !== 12) throw new Error()
    const plaintext = await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:context},await key(secret),decode(ciphertext))
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(plaintext)) as T
  } catch { throw new ValidationError('Invalid or expired report cursor. Start again.') }
}
export type EvidenceScope = { workspaceId: string; sessionId: string; flowId: string; cutoff: string; generation: number }
export async function generation(db: D1Database, workspaceId: string) {
  const row = await db.prepare('SELECT generation FROM reporting_generations WHERE workspace_id = ?').bind(workspaceId).first<{generation: number}>()
  if (!row) throw new Error('Reporting consistency migration is required.')
  return row.generation
}
export async function checkGeneration(db: D1Database, scope: EvidenceScope) {
  const changed = await db.prepare('SELECT 1 AS changed FROM reporting_changes WHERE workspace_id = ? AND flow_id = ? AND generation > ? AND eligible_at <= ? LIMIT 1').bind(scope.workspaceId,scope.flowId,scope.generation,scope.cutoff).first()
  if (changed) throw new ValidationError('Responses changed during this report. Refresh and try again.')
}
