import { eq, sql } from 'drizzle-orm'
import type { D1BatchStatement } from '../../platform/db/batch'
import type { PencilDatabase } from '../../platform/db/repository'
import { authMagicLinks, localDevInbox } from '../../platform/db/schema'
import { sha256 } from './tokens'

/** Statements run in the same D1 batch as the guarded operator deletion. */
export async function operatorCustodyStatements(
  database: PencilDatabase,
  target: { id: string; email: string },
  guard: string,
  guardParameters: readonly unknown[],
): Promise<D1BatchStatement[]> {
  // Old inbox ULIDs are matched by credential hash. Current writers use link
  // IDs, so a concurrent delivery cannot be missed by these preliminary reads.
  const [links, inbox] = await Promise.all([
    database.select({ tokenHash: authMagicLinks.tokenHash }).from(authMagicLinks).where(eq(authMagicLinks.operatorId, target.id)),
    database.select({ id: localDevInbox.id, token: localDevInbox.magicLinkToken }).from(localDevInbox)
      .where(sql`lower(${localDevInbox.toEmail}) = lower(${target.email})`),
  ])
  const [authLink] = await database.all<{ auth_id: string }>(sql`SELECT auth_id FROM operator_auth_links WHERE operator_id=${target.id}`)
  const authId = authLink?.auth_id ?? target.id
  const hashes = new Set(links.map((link) => link.tokenHash))
  const legacyIds = (await Promise.all(inbox.map(async (message) => hashes.has(await sha256(message.token)) ? message.id : null)))
    .filter((id): id is string => id !== null)
  return [
    { sql: `DELETE FROM rer_mail_development_outbox WHERE ${guard} AND (
        json_extract(message,'$.deliveryId') IN (SELECT id FROM oa_tokens WHERE operator_id = ?)
        OR EXISTS (SELECT 1 FROM json_each(json_extract(message,'$.to')) WHERE lower(value)=lower(?)))`,
      parameters: [...guardParameters, authId, target.email] },
    { sql: `DELETE FROM local_dev_inbox WHERE ${guard} AND (
        id IN (SELECT 'auth_magic_link/' || id FROM auth_magic_links WHERE operator_id = ?)
        OR id IN (SELECT id FROM oa_tokens WHERE operator_id = ?)
        OR id IN (SELECT value FROM json_each(?))
        OR (lower(to_email) = lower(?) AND NOT EXISTS (
          SELECT 1 FROM operators WHERE lower(email) = lower(?) AND id <> ?)))`,
      parameters: [...guardParameters, target.id, authId, JSON.stringify(legacyIds), target.email, target.email, target.id] },
    { sql: `UPDATE audit_entries SET actor_operator_id = CASE WHEN actor_operator_id = ? THEN NULL ELSE actor_operator_id END,
        subject_id = CASE WHEN (subject_type = 'operator' AND subject_id = ?)
          OR (subject_type = 'operator_session' AND (actor_operator_id = ? OR subject_id IN (SELECT s.id FROM oa_sessions s JOIN operator_auth_links l ON l.auth_id=s.operator_id WHERE l.operator_id = ?)))
          THEN NULL ELSE subject_id END,
        details_json = CASE WHEN (subject_type = 'operator' AND subject_id = ?)
          OR (subject_type = 'operator_session' AND (actor_operator_id = ? OR subject_id IN (SELECT s.id FROM oa_sessions s JOIN operator_auth_links l ON l.auth_id=s.operator_id WHERE l.operator_id = ?)))
          THEN '{}' ELSE details_json END
      WHERE ${guard} AND (actor_operator_id = ? OR (subject_type = 'operator' AND subject_id = ?)
        OR (subject_type = 'operator_session' AND subject_id IN (SELECT s.id FROM oa_sessions s JOIN operator_auth_links l ON l.auth_id=s.operator_id WHERE l.operator_id = ?)))`,
      parameters: [target.id, target.id, target.id, target.id, target.id, target.id, target.id, ...guardParameters, target.id, target.id, target.id] },
    { sql: `UPDATE responses SET released_by_operator_id = NULL WHERE released_by_operator_id = ? AND ${guard}`, parameters: [target.id, ...guardParameters] },
    ...[
      `UPDATE oa_sessions SET source_token_id=NULL WHERE operator_id != ? AND source_token_id IN (SELECT id FROM oa_tokens WHERE issuer_id = ?)`,
      `DELETE FROM oa_sessions WHERE operator_id = ? AND operator_id = ?`,
      `DELETE FROM oa_tokens WHERE (operator_id = ? OR issuer_id = ?)`,
      `DELETE FROM oa_external_identities WHERE operator_id = ? AND operator_id = ?`,
      `DELETE FROM operator_auth_links WHERE auth_id = ? AND auth_id = ?`,
      `DELETE FROM oa_operators WHERE id = ? AND id = ?`,
    ].map(statement => ({ sql: `${statement} AND ${guard}`, parameters: [authId, authId, ...guardParameters] })),
    { sql: `DELETE FROM operator_sessions WHERE operator_id = ? AND ${guard}`, parameters: [target.id, ...guardParameters] },
    { sql: `DELETE FROM auth_magic_links WHERE operator_id = ? AND ${guard}`, parameters: [target.id, ...guardParameters] },
  ]
}
