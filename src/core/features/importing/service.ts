import { planD1ImportStream, prepareD1ImportStream, publishD1ImportPreparation, readD1ImportPreparation, resumeD1ImportStream, readD1ImportStream, undoD1ImportStream, upgradeD1ImportErasureIndex, resumeD1Import, undoD1Import, rollbackD1Import, readD1ImportJob, cancelD1NativeStaging, cancelD1ErasureStaging, d1RequestContext, type D1ImportContext } from '../../../base/import-kit/src/d1/index'
import { ValidationError } from '../../shared/errors'
import manifest from '../../../../seed.json'
import { importTargetsFor } from './native'
import { mappingVersion, type ImportInput, type ImportReview } from './model'
import { prepareImport } from './prepare'
import { createCanonicalHasher } from '../../../base/import-kit/src/provenance/canonical-hash'
import { cancelPrivatePreparation, publishedCancellation, requireCancellationAuthority } from './cancellation'
export type ImportActor = { id: string; operatorId: string; workspaceId: string }
// HTTP callers supply the session already authenticated by native getSession, including
// local-key-gated dev sessions. This predicate rechecks live database authority on each batch.
export function importContext(database: D1Database, actor: ImportActor, namespace: string): D1ImportContext {
  return { destination: actor.workspaceId, namespace, mappingVersion, storage: { database, targets: importTargetsFor(actor.operatorId) }, batchSize: 10, maxBatches: 1, maxBatchBytes: 2 * 1024 * 1024, authorization: { principalId: actor.operatorId, predicate: () => ({ sql: `EXISTS (SELECT 1 FROM oa_sessions s JOIN oa_operators o ON o.id = s.operator_id JOIN operator_auth_links l ON l.auth_id = o.id JOIN operators p ON p.id = l.operator_id WHERE s.id = ? AND p.id = ? AND p.workspace_id = ? AND s.revoked_at IS NULL AND s.expires_at > unixepoch('subsec')*1000 AND s.operator_version = o.version AND o.status = 'active' AND s.kind IN ('native','dev'))`, params: [actor.id, actor.operatorId, actor.workspaceId] }) } }
}
async function requireReviewedPlan(prepared: ReturnType<typeof prepareImport>, context: D1ImportContext, fingerprint: string) {
  const plan = await planD1ImportStream(prepared.source, prepared.mapping, context)
  if (plan.fingerprint !== fingerprint) throw new ValidationError('The mapping changed. Review the new report before importing.')
  // The plan belongs only to this check; do not retain its pages beside preparation.
}
export class FormImports {
  constructor(private readonly database: D1Database, private readonly actor: ImportActor) {}
  private async prepared(input: ImportInput, releaseUpload?: () => void) {
    const payloadHasher = createCanonicalHasher()
    let prepared: ReturnType<typeof prepareImport>, context: ReturnType<typeof d1RequestContext>, plan
    try {
      prepared = prepareImport(input, this.actor.workspaceId, payloadHasher.hash)
      releaseUpload?.()
      context = d1RequestContext(importContext(this.database, this.actor, prepared.namespace))
      plan = await planD1ImportStream(prepared.source, prepared.mapping, context)
    } catch (error) { if (error instanceof Error && /CREDENTIAL_IN_DURABLE/.test(error.message)) throw new ValidationError('Credential-bearing input cannot be retained. Remove credentials from the source files before review.'); throw error }
    finally { payloadHasher.clear() }
    const existing = await this.existing(prepared.namespace, context)
    const count = await context.storage.database.prepare('SELECT COUNT(*) AS count FROM flows WHERE workspace_id = ?').bind(this.actor.workspaceId).first<{ count: number }>()
    if (!existing && Number(count?.count) >= manifest.limits.flows.total) throw new ValidationError('Workspace flow limit reached. Nothing was written.')
    const { source: _source, mapping: _mapping, effects: _effects, ...review } = prepared
    return { ...review, context, plan, existing }
  }
  async review(input: ImportInput, releaseUpload?: () => void): Promise<ImportReview> {
    const p = await this.prepared(input, releaseUpload)
    const authority = p.context.authorization.predicate('read', this.actor.workspaceId)
    const pending = await p.context.storage.database.prepare(`SELECT fingerprint FROM ik_d1_staging WHERE destination=? AND principal_id=? AND namespace=? AND (${authority.sql}) UNION SELECT s.fingerprint FROM ik_d1_native_staging n JOIN ik_d1_stream_pages p ON p.job_id=n.job_id JOIN ik_d1_streams s ON s.id=p.stream_id WHERE n.destination=? AND n.principal_id=? AND s.namespace=? AND (${authority.sql}) LIMIT 1`).bind(this.actor.workspaceId, this.actor.operatorId, p.namespace, ...authority.params ?? [], this.actor.workspaceId, this.actor.operatorId, p.namespace, ...authority.params ?? []).first<{ fingerprint: string }>()
    return { ...(p.sourceName ? { source: p.sourceName, google: p.google } : {}), plannedAt: p.plannedAt, fingerprint: p.plan.fingerprint, flowId: p.flowId, title: p.form.title, report: p.form.report, headers: p.headers, forbiddenColumns: p.forbiddenColumns, columns: p.columns, questions: p.form.steps.filter(s => s.kind === 'question'), rowErrors: p.rowErrors, responseCount: p.responseCount, lossRequired: p.form.report.some(i => i.state !== 'imported'), alreadyImported: p.existing?.state === 'completed', heldByOtherOperator: !!p.existing && p.existing.principal_id !== this.actor.operatorId, ...(p.existing && p.existing.principal_id === this.actor.operatorId ? { jobId: p.existing.id, jobState: p.existing.state } : {}), ...(pending ? { pendingCustody: pending.fingerprint } : {}) }
  }
  async commit(input: ImportInput, fingerprint: string, acknowledged: boolean, releaseUpload?: () => void) {
    if (!acknowledged) throw new ValidationError('Acknowledge the reported changes and losses before importing.')
    const payloadHasher = createCanonicalHasher()
    try {
      const p = prepareImport(input, this.actor.workspaceId, payloadHasher.hash)
      releaseUpload?.()
      if (!p.form.steps.some(step => step.kind === 'question')) throw new ValidationError('Choose at least one ordinary question before importing.')
      if (p.rowErrors.length) throw new ValidationError('Correct every CSV row error before importing. Nothing was written.')
      const context = d1RequestContext(importContext(this.database, this.actor, p.namespace))
      const existing = await this.existing(p.namespace, context)
      if (existing && existing.principal_id !== this.actor.operatorId) throw new ValidationError('These exact files already have an import by another operator. Nothing was created. The creating operator can resume or undo it.')
      if (existing && existing.stream !== 2) {
        const plan = await planD1ImportStream(p.source, p.mapping, context)
        if (plan.fingerprint !== fingerprint) throw new ValidationError('The mapping changed. Review the new report before importing.')
        return this.status(existing.id)
      }
      await requireReviewedPlan(p, context, fingerprint)
      const count = await context.storage.database.prepare('SELECT COUNT(*) AS count FROM flows WHERE workspace_id = ?').bind(this.actor.workspaceId).first<{ count: number }>()
      if (!existing && Number(count?.count) >= manifest.limits.flows.total) throw new ValidationError('Workspace flow limit reached. Nothing was written.')
      return await prepareD1ImportStream(p.source, p.mapping, { ...this.creationContext(context), reviewedFingerprint: fingerprint, operationKey: p.namespace })
    } catch (error) { if (error instanceof Error && /CREDENTIAL_IN_DURABLE/.test(error.message)) throw new ValidationError('Credential-bearing input cannot be retained. Remove credentials from the source files before review.'); throw error }
    finally { payloadHasher.clear() }
  }
  private creationContext(context: D1ImportContext): D1ImportContext {
    // Only binding scalars and the current authority port cross awaited work.
    const namespace = context.namespace, principal = this.actor.operatorId, authorityPort = context.authorization
    return { ...context, authorization: { ...authorityPort, predicate(action, destination) {
      const authority = authorityPort.predicate(action, destination)
      return { sql: `(${authority.sql}) AND NOT EXISTS(SELECT 1 FROM ik_jobs WHERE destination=? AND namespace=? AND principal_id<>?) AND NOT EXISTS(SELECT 1 FROM ik_d1_streams WHERE destination=? AND namespace=? AND principal_id<>?) AND NOT EXISTS(SELECT 1 FROM ik_d1_staging WHERE destination=? AND namespace=? AND principal_id<>?)`, params: [...authority.params ?? [], destination, namespace, principal, destination, namespace, principal, destination, namespace, principal] }
    } } }
  }
  private existing(namespace: string, context: D1ImportContext) {
    return context.storage.database.prepare(`SELECT s.id, CASE WHEN NOT EXISTS(SELECT 1 FROM ik_d1_stream_pages p JOIN ik_jobs j ON j.id=p.job_id WHERE p.stream_id=s.id AND j.state<>'completed') THEN 'completed' ELSE s.state END state,s.principal_id,1 stream FROM ik_d1_streams s WHERE s.destination=? AND s.namespace=? UNION ALL SELECT j.id,j.state,j.principal_id,0 stream FROM ik_jobs j WHERE j.destination=? AND j.namespace=? AND NOT EXISTS(SELECT 1 FROM ik_d1_stream_pages p WHERE p.job_id=j.id) UNION ALL SELECT id,CASE WHEN sealed_revision=revision AND EXISTS(SELECT 1 FROM ik_d1_preparation_receipts r WHERE r.stage_id=ik_d1_staging.id) THEN 'preparing' ELSE 'preparation-interrupted' END,principal_id,2 stream FROM ik_d1_staging WHERE destination=? AND namespace=? LIMIT 1`).bind(this.actor.workspaceId, namespace, this.actor.workspaceId, namespace, this.actor.workspaceId, namespace).first<{ id: string; state: string; principal_id: string; stream: number }>()
  }
  private async context(id: string) {
    const row = await this.database.prepare(`SELECT namespace,1 stream,fingerprint,total,operation_key,NULL generation FROM ik_d1_streams WHERE id=? AND destination=? AND principal_id=? UNION ALL SELECT namespace,0 stream,fingerprint,total,operation_key,NULL generation FROM ik_jobs j WHERE id=? AND destination=? AND principal_id=? AND NOT EXISTS(SELECT 1 FROM ik_d1_stream_pages p WHERE p.job_id=j.id) UNION ALL SELECT namespace,2 stream,fingerprint,total,operation_key,generation FROM ik_d1_staging WHERE id=? AND destination=? AND principal_id=? LIMIT 1`).bind(id,this.actor.workspaceId,this.actor.operatorId,id,this.actor.workspaceId,this.actor.operatorId,id,this.actor.workspaceId,this.actor.operatorId).first<{ namespace: string; stream: number; fingerprint: string; total: number; operation_key: string; generation: string }>()
    if (!row) throw new ValidationError('Import not found for this operator.')
    return { context: importContext(this.database,this.actor,row.namespace), stream: row.stream, row }
  }
  async upgradeErasureIndex() { return upgradeD1ImportErasureIndex(importContext(this.database, this.actor, 'erasure-index-upgrade')) }
  async cancelStaging(fingerprint: string) {
    const context = d1RequestContext(importContext(this.database, this.actor, 'staging-cancellation')), db = context.storage.database
    const authority = context.authorization.predicate('create', this.actor.workspaceId)
    await requireCancellationAuthority(context)
    const stage = await db.prepare(`SELECT id,generation,namespace,operation_key FROM ik_d1_staging WHERE destination=? AND principal_id=? AND fingerprint=? AND (${authority.sql})`).bind(this.actor.workspaceId, this.actor.operatorId, fingerprint, ...authority.params ?? []).first<{ id: string; generation: string; namespace: string; operation_key: string }>()
    if (stage) {
      const job = await cancelPrivatePreparation({ ...context, namespace: stage.namespace }, fingerprint, stage.operation_key, stage)
      if (job) return { cancelled: false as const, job }
    }
    const native = (await db.prepare(`SELECT DISTINCT n.job_id,n.namespace,n.action FROM ik_d1_native_staging n JOIN ik_d1_stream_pages p ON p.job_id=n.job_id JOIN ik_d1_streams s ON s.id=p.stream_id WHERE n.destination=? AND n.principal_id=? AND s.fingerprint=? AND (${authority.sql})`).bind(this.actor.workspaceId,this.actor.operatorId,fingerprint,...authority.params ?? []).all<{job_id:string;namespace:string;action:string}>()).results
    for (const row of native) await (row.action === 'erase' ? cancelD1ErasureStaging : cancelD1NativeStaging)(row.job_id,{...context,namespace:row.namespace})
    const job = await publishedCancellation(context, fingerprint, stage ? { namespace: stage.namespace, operationKey: stage.operation_key } : undefined)
    return job ? { cancelled: false as const, job } : { cancelled: true as const }
  }
  async status(id: string) {
    const { context, stream } = await this.context(id)
    if (stream === 2) return readD1ImportPreparation(id, context)
    return stream ? readD1ImportStream(id,context) : readD1ImportJob(id,context)
  }
  async resume(id: string) {
    const { context, stream } = await this.context(id)
    if (stream === 2) { const scope = d1RequestContext(this.creationContext(context)); await publishD1ImportPreparation(id, scope); return resumeD1ImportStream(id, scope) }
    return stream ? resumeD1ImportStream(id,context) : resumeD1Import(id,context)
  }
  async undo(id: string) {
    const { context, stream, row } = await this.context(id)
    if (stream === 2) {
      const job = await cancelPrivatePreparation(d1RequestContext(context), row.fingerprint, row.operation_key, { id, generation: row.generation })
      return job ?? { id, expectedFingerprint: row.fingerprint, state: 'cancelled' as const, checkpoint: 0, total: row.total, error: null }
    }
    if (stream) return undoD1ImportStream(id,context)
    const job = await readD1ImportJob(id,context)
    return job.state === 'completed' || job.state === 'undoing' || job.state === 'undone' ? undoD1Import(id,context) : rollbackD1Import(id,context)
  }
  async list() {
    const context = importContext(this.database,this.actor,'history'), authority=context.authorization.predicate('read',this.actor.workspaceId)
    if (!await this.database.prepare(`SELECT 1 WHERE ${authority.sql}`).bind(...authority.params!).first()) throw new ValidationError('Current operator session required.')
    const jobs=(await this.database.prepare(`SELECT id FROM ik_d1_streams WHERE destination=? AND principal_id=? UNION ALL SELECT id FROM ik_jobs j WHERE destination=? AND principal_id=? AND NOT EXISTS(SELECT 1 FROM ik_d1_stream_pages p WHERE p.job_id=j.id) UNION ALL SELECT id FROM ik_d1_staging WHERE destination=? AND principal_id=?`).bind(this.actor.workspaceId,this.actor.operatorId,this.actor.workspaceId,this.actor.operatorId,this.actor.workspaceId,this.actor.operatorId).all<{id:string}>()).results
    return Promise.all(jobs.map(job=>this.status(job.id)))
  }
}
