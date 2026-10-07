import { AuthRepository as CurrentAuthRepository } from '../../src/core/features/auth/repository'
import type { PencilDatabase } from '../../src/core/platform/db/repository'
import type { D1BatchExecutor } from '../../src/core/platform/db/batch'
import { localDevInbox } from '../../src/core/platform/db/schema'
import { sha256 } from '../../src/core/features/auth/tokens'
/** Historical writer retained only as a test fixture for erasure and delayed writes. */
export class AuthRepository extends CurrentAuthRepository {
 constructor(private readonly legacyDatabase: PencilDatabase, private readonly legacyBatch: D1BatchExecutor) { super(legacyDatabase,legacyBatch) }
  async addLocalInboxMessage(message: typeof localDevInbox.$inferInsert) {
    // Delivery is tied to the already persisted credential. A delayed sender
    // cannot recreate personal inbox data after removal, consumption or revoke.
    const tokenHash = await sha256(message.magicLinkToken)
    const result = await this.legacyBatch.execute([{
      sql: `INSERT INTO local_dev_inbox (id, to_email, magic_link_token, expires_at, created_at)
        SELECT ?, ?, ?, ?, ? FROM auth_magic_links l JOIN operators o ON o.id = l.operator_id
        WHERE 'auth_magic_link/' || l.id = ? AND l.token_hash = ?
          AND lower(o.email) = lower(?) AND l.expires_at = ?
          AND l.expires_at > ? AND l.consumed_at IS NULL AND l.revoked_at IS NULL
        ON CONFLICT(id) DO UPDATE SET id = excluded.id
          WHERE local_dev_inbox.to_email = excluded.to_email
            AND local_dev_inbox.magic_link_token = excluded.magic_link_token
            AND local_dev_inbox.expires_at = excluded.expires_at`,
      parameters: [message.id, message.toEmail, message.magicLinkToken, message.expiresAt, message.createdAt,
        message.id, tokenHash, message.toEmail, message.expiresAt, message.createdAt],
    }])
    if (result[0]?.changes !== 1) throw new Error('The local sign-in credential is no longer deliverable.')
  }

}
