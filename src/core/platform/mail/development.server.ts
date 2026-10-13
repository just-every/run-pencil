import { createD1DevelopmentOutbox, createDevelopmentOutboxHandler, type DevelopmentMessage, type DevelopmentD1Statement } from '../../../base/mail/src/development/index.mjs'
import { devGate, devNotFound } from '../../../base/operator-auth/index.mjs'
import type { WorkerBindings } from '../../app/environment'
import { isLocalDevelopmentRequest } from '../config/runtime'

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

/** The checkout's key gate: only a local runtime (loopback, local mail) that holds RER_DEV_KEY has one. */
export function localDevGate(request: Request, environment: WorkerBindings) {
  return isLocalDevelopmentRequest(request.url, environment) ? devGate({ key: environment.RER_DEV_KEY, origin: new URL(request.url).origin, local: true }) : null
}

/** The outbox and the key exchange answer only a local runtime holding RER_DEV_KEY. A tunnel or local proxy makes remote
 * requests look local, so the outbox also needs the gate's cookie (or the rer harness's key header). Everything else is 404. */
export async function developmentOutboxResponse(request: Request, environment: WorkerBindings, db: D1Database) {
  const url = new URL(request.url), gate = localDevGate(request, environment)
  if (!gate) return devNotFound()
  if (url.pathname === '/__dev/key') return await gate.exchange(request) ?? devNotFound()
  if (request.headers.get('host') !== url.host || (request.headers.has('origin') && request.headers.get('origin') !== url.origin)
    || request.headers.get('sec-fetch-site') === 'cross-site' || !await gate.admits(request)) return devNotFound()
  return await createDevelopmentOutboxHandler({ local: true, origin: url.origin, outbox: createD1DevelopmentOutbox({ db }) })(request) ?? devNotFound()
}
