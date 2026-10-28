import { ulid } from 'ulid'
import { NotFoundError, ValidationError } from '../../shared/errors'
import { createPasswordVerifier, verifyPassword, hashCredential } from '../restricted-access'
import { disclosureThreshold } from '../analysis'
import { loadSavedView } from './savedRepository'
import { sharedReport } from './sharedReport'
import type { SavedReportShare, SharedReport } from './savedModel'

const shareColumns = 'id,view_id AS viewId,password_verifier IS NOT NULL AS passwordRequired,expires_at AS expiresAt,revoked_at AS revokedAt,created_at AS createdAt'
type ShareRow = Omit<SavedReportShare, 'passwordRequired'> & { passwordRequired: number }
const shareMetadata = (row: ShareRow): SavedReportShare => ({ ...row, passwordRequired: Boolean(row.passwordRequired) })

export async function listReportShares(db: D1Database, workspaceId: string, viewId: string) {
  await loadSavedView(db, workspaceId, viewId)
  return (await db.prepare(`SELECT ${shareColumns} FROM saved_report_shares WHERE workspace_id=? AND view_id=? ORDER BY created_at DESC,id`).bind(workspaceId, viewId).all<ShareRow>()).results.map(shareMetadata)
}
export async function createReportShare(db: D1Database, workspaceId: string, viewId: string, input: { password?: string; expiresAt?: string }) {
  const view = await loadSavedView(db, workspaceId, viewId)
  if (input.expiresAt && Date.parse(input.expiresAt) <= Date.now()) throw new ValidationError('The report expiry must be in the future.')
  const threshold = Math.max(view.threshold, await disclosureThreshold(db, workspaceId))
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('')
  const verifier = input.password ? await createPasswordVerifier(input.password) : null
  const share: SavedReportShare = { id: ulid(), viewId, passwordRequired: Boolean(verifier), expiresAt: input.expiresAt ? new Date(input.expiresAt).toISOString() : null, revokedAt: null, createdAt: new Date().toISOString() }
  await db.prepare('INSERT INTO saved_report_shares(id,workspace_id,view_id,token_hash,password_verifier,expires_at,revoked_at,threshold,created_at) VALUES(?,?,?,?,?,?,NULL,?,?)').bind(share.id, workspaceId, viewId, await hashCredential(token), verifier, share.expiresAt, threshold, share.createdAt).run()
  return { share, token, url: `/reports/${token}` }
}
export async function revokeReportShare(db: D1Database, workspaceId: string, id: string) {
  const changed = await db.prepare('UPDATE saved_report_shares SET revoked_at=COALESCE(revoked_at,?) WHERE id=? AND workspace_id=?').bind(new Date().toISOString(), id, workspaceId).run()
  if (!changed.meta.changes) throw new NotFoundError('This report link is unavailable.')
}

/** Used by both the public API and native document loader; passwords grant no persistent session. */
export async function readSharedReport(db: D1Database, token: string, password?: string): Promise<{ passwordRequired: true } | SharedReport> {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new NotFoundError('This report link is unavailable.')
  const share = await db.prepare('SELECT workspace_id AS workspaceId,view_id AS viewId,password_verifier AS verifier,threshold FROM saved_report_shares WHERE token_hash=? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>?)').bind(await hashCredential(token), new Date().toISOString()).first<{ workspaceId: string; viewId: string; verifier: string | null; threshold: number }>()
  if (!share) throw new NotFoundError('This report link is unavailable.')
  if (share.verifier && (!password || !await verifyPassword(password, share.verifier))) return { passwordRequired: true }
  return sharedReport(db, await loadSavedView(db, share.workspaceId, share.viewId), share.threshold)
}
