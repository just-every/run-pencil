import { cancelD1ImportStaging, readD1ImportJob, readD1ImportStream, type D1ImportContext } from '../../../base/import-kit/src/d1/index'
import { ValidationError } from '../../shared/errors'

export async function requireCancellationAuthority(context: D1ImportContext) {
  const authority = context.authorization.predicate('create', context.destination)
  if (!await context.storage.database.prepare(`SELECT 1 WHERE ${authority.sql}`).bind(...authority.params ?? []).first()) {
    throw new ValidationError('A current operator session is required to cancel private import custody.')
  }
}

/** A fingerprint miss is only private absence. Resolve the durable outcome
 * through its current owner, destination, mapping and namespace before saying
 * cancellation won. The ordinary readers retain their own authority fences. */
export async function publishedCancellation(context: D1ImportContext, fingerprint: string, binding?: { id?: string; namespace: string; operationKey: string }) {
  await requireCancellationAuthority(context)
  const authority = context.authorization.predicate('read', context.destination)
  const scope = 'destination=? AND principal_id=? AND mapping_version=? AND fingerprint=?'
  const suffix = binding ? ` AND namespace=? AND operation_key=?${binding.id ? ' AND id=?' : ''}` : ''
  const params = [context.destination, context.authorization.principalId, context.mappingVersion, fingerprint, ...(binding ? [binding.namespace, binding.operationKey, ...(binding.id ? [binding.id] : [])] : []), ...authority.params ?? []]
  const row = await context.storage.database.prepare(`SELECT id,namespace,1 stream FROM ik_d1_streams WHERE ${scope}${suffix} AND (${authority.sql}) UNION ALL SELECT id,namespace,0 stream FROM ik_jobs j WHERE ${scope}${suffix} AND (${authority.sql}) AND NOT EXISTS(SELECT 1 FROM ik_d1_stream_pages p WHERE p.job_id=j.id) LIMIT 1`).bind(...params, ...params).first<{ id: string; namespace: string; stream: number }>()
  if (!row) { await requireCancellationAuthority(context); return undefined }
  const scoped = { ...context, namespace: row.namespace, reviewedFingerprint: fingerprint }
  return row.stream ? readD1ImportStream(row.id, scoped) : readD1ImportJob(row.id, scoped)
}

/** Base owns the exact-generation guarded delete. A failed guard can mean
 * publication or another cancellation won; it never grants authority itself. */
export async function cancelPrivatePreparation(context: D1ImportContext, fingerprint: string, operationKey: string, expected: { id: string; generation: string }) {
  const authorization = context.authorization
  const exactGeneration = { ...context, reviewedFingerprint: fingerprint, authorization: { ...authorization, predicate(action: Parameters<typeof authorization.predicate>[0], destination: string) {
    const current = authorization.predicate(action, destination)
    return { sql: `(${current.sql}) AND NOT EXISTS(SELECT 1 FROM ik_d1_staging WHERE destination=? AND namespace=? AND principal_id=? AND operation_key=? AND (id<>? OR generation<>?))`, params: [...current.params ?? [], destination, context.namespace, authorization.principalId, operationKey, expected.id, expected.generation] }
  } } }
  try { await cancelD1ImportStaging(operationKey, exactGeneration) }
  catch (error) {
    if (!(error instanceof Error) || !/\bIMPORT_ATOMIC_GUARD\b/.test(error.message)) throw error
  }
  const published = await publishedCancellation(context, fingerprint, { id: expected.id, namespace: context.namespace, operationKey })
  if (published) return published
  // A changed or replacement generation must remain visible as a failure;
  // absence is checked after the failed delete without deleting anything else.
  const authority = context.authorization.predicate('create', context.destination)
  const remaining = await context.storage.database.prepare(`SELECT id FROM ik_d1_staging WHERE destination=? AND namespace=? AND principal_id=? AND operation_key=? AND (${authority.sql})`).bind(context.destination, context.namespace, context.authorization.principalId, operationKey, ...authority.params ?? []).first()
  await requireCancellationAuthority(context)
  if (remaining) throw new ValidationError('Private preparation changed during cancellation. Refresh import history before continuing.')
  // Publication can remove staging during the absence check itself. A newly
  // admitted generation of this same reviewed import can also be the winner.
  return publishedCancellation(context, fingerprint, { namespace: context.namespace, operationKey })
}
