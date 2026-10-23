import { confirmationCaptureClaim } from './confirmation-capture'
import { resumeCaptureClaim } from '../../src/core/features/resuming'
import { notificationCaptureClaim } from './notification-capture'
import { digestCaptureClaim } from './notification-digest-capture'
import { createD1DevelopmentOutbox, type DevelopmentMessage, type DevelopmentD1Statement } from '../../src/base/mail/src/development/index.mjs'

/** Trusted product SQL, evaluated atomically with capture. The predicate must
 * bind this message's durable delivery key and require its current sending claim.
 * Keeping the predicate injectable avoids referencing optional feature tables. */
export type DevelopmentCaptureClaim = (message: DevelopmentMessage) => {
  sql: string
  bindings: (string | number | null)[]
}

/** Add product eligibility to the same transaction as Base's durable capture.
 * Erasure and capture serialize in D1: neither ordering can restore erased mail. */
export function guardedDevelopmentOutbox(db: D1Database, additionalClaim?: DevelopmentCaptureClaim) {
  return { async put(message: DevelopmentMessage) {
    const claim = additionalClaim?.(message)
    const guarded = {
      prepare: (sql: string) => db.prepare(sql),
      async batch(statements: DevelopmentD1Statement[]) {
        const results = await db.batch([
          // SQLite evaluates CASE lazily. A refused claim raises inside the same
          // transaction, before Base can insert or trim any retained messages.
          db.prepare(`SELECT CASE WHEN (
              EXISTS (SELECT 1 FROM oa_tokens t JOIN oa_operators o ON o.id=t.operator_id
                WHERE t.id=? AND t.revoked_at IS NULL AND t.consumed_at IS NULL AND t.expires_at>?
                  AND o.status IN ('active','invited'))
              OR EXISTS (SELECT 1 FROM mail_deliveries d JOIN invitation_participants p ON p.id=d.participant_id
                JOIN distribution_contacts c ON c.id=p.contact_id WHERE d.idempotency_key=? AND d.status='sending'
                  AND p.email_snapshot IS NOT NULL AND c.opted_out_at IS NULL)
              ${claim ? `OR (${claim.sql})` : ''}) THEN 1 ELSE json_extract('{}', 'The local delivery is no longer eligible.') END AS eligible`)
            .bind(message.deliveryId, Date.now(), message.deliveryId, ...(claim?.bindings ?? [])),
          ...statements as D1PreparedStatement[],
        ])
        return results.slice(1)
      },
    }
    await createD1DevelopmentOutbox({ db: guarded }).put(message)
  } }
}


// A fake paid mail edge used only by the native/browser suites. Product dev/demo mail is suppressed.
export function baseMailSender(configuration: any, db: D1Database, claim?: DevelopmentCaptureClaim) {
  if (configuration.kind !== 'local-development') return productionMailSender(configuration)
  return { async send(message: DevelopmentMessage) {
    const prepared = applyUnsubscribeHeaders(structuredClone(message))
    await createMailSender({ provider: 'development', mode: 'development' }).send(message)
    try { await guardedDevelopmentOutbox(db, claim ?? (message.deliveryId.startsWith('confirmation:') ? confirmationCaptureClaim : message.deliveryId.startsWith('access:') ? accessCaptureClaim : message.deliveryId.startsWith('resume:') ? resumeCaptureClaim : message.headers?.['X-Pencil-Digest-Claim'] ? digestCaptureClaim : notificationCaptureClaim)).put(prepared) } catch (error) { if (error instanceof MailValidationError) throw error; throw new DevelopmentOutboxError() }
    return { provider: 'development', status: 'development', providerMessageId: null } as const
  } }
}
// @ts-expect-error Maintained JavaScript mail adapter.
import { createMailSender } from '../../src/base/mail/index.mjs'

// @ts-expect-error Maintained JavaScript error type.
import { DevelopmentOutboxError, MailValidationError } from '../../src/base/mail/src/core/errors.mjs'
// @ts-expect-error Maintained JavaScript unsubscribe assembly.
import { applyUnsubscribeHeaders } from '../../src/base/mail/src/unsubscribe/index.mjs'

import { productionMailSender } from '../../src/core/platform/mail/production.server'

function accessCaptureClaim(message:DevelopmentMessage){return {sql:"EXISTS(SELECT 1 FROM access_challenges WHERE id=? AND delivery_state='pending' AND expires_at>?)",bindings:[message.deliveryId.slice(7),new Date().toISOString()]}}
