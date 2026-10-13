import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { archiveFixture, snapshotFixture, restoreFixture } from './archive-fixture'
import { prepareImport } from '../../src/core/features/importing/prepare'
import { importContext } from '../../src/core/features/importing/service'
import { custodyActor, custodyContext, custodyTargets } from '../../scripts/custody-test-targets.mjs'
import { custodySource, custodyMapping } from '../../scripts/custody-test-graph.mjs'
import { preparationCustody, preparationRows } from '../../scripts/custody-test-preparations.mjs'
import { planD1ImportStream, prepareD1ImportStream, publishD1ImportPreparation, readD1ImportPreparation,
  readD1ImportStream, resumeD1ImportStream, cancelD1ImportStaging, eraseD1ImportTarget } from '../../src/base/import-kit/src/d1/index'

declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(() => applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__))

contract(['DATA-001','IMPORT-003','IMPORT-004','BASE-ACCESS-004','NOTIFY-004'], 'restored private preparation stays owner bound until cold verification and historical native application', async () => {
  const actor = await custodyActor(env.DB)
  const input = { definition: JSON.stringify({ title: 'Preparation recovery', fields: [{ ref: 'answer', type: 'short_text', title: 'Answer' }], thankyou_screens: [{ ref: 'end', title: 'Thanks' }] }),
    csv: 'Answer,Submit Date\nretained historical answer,2026-09-12 10:03:00\n', plannedAt: '2026-09-12T10:05:00.000Z' }
  const normalized = prepareImport(input, actor.workspaceId)
  expect(normalized.rowErrors).toEqual([])
  const context = () => ({ ...importContext(env.DB, actor, normalized.namespace), batchSize: 1, maxBatches: 1 })
  const plan = await planD1ImportStream(normalized.source, normalized.mapping, context())
  const prepared = await prepareD1ImportStream(normalized.source, normalized.mapping, { ...context(), reviewedFingerprint: plan.fingerprint, operationKey: normalized.namespace })
  expect(prepared.state).toBe('preparing')
  expect(prepared.checkpoint).toBe(0)
  const privateRows = await preparationRows(env.DB, prepared.id)
  expect(privateRows.ik_d1_preparation_receipts).toHaveLength(1)
  expect(privateRows.ik_d1_preparation_receipts[0].codec_id).toBe(context().storage.targets.planCodec!.id)
  expect(privateRows.ik_d1_staging_headers.length).toBeGreaterThan(0)
  const unpublished = async () => {
    expect(await env.DB.prepare('SELECT count(*) n FROM flows WHERE workspace_id=?').bind(actor.workspaceId).first()).toEqual({ n: 0 })
    expect(await env.DB.prepare('SELECT count(*) n FROM ik_jobs WHERE destination=?').bind(actor.workspaceId).first()).toEqual({ n: 0 })
    expect(await env.DB.prepare('SELECT count(*) n FROM ik_d1_streams WHERE destination=?').bind(actor.workspaceId).first()).toEqual({ n: 0 })
  }
  await unpublished()
  const archive = await archiveFixture(env.DB, __PENCIL_CORE_MIGRATIONS__)
  await restoreFixture(env.DB, archive)
  expect(await archiveFixture(env.DB, __PENCIL_CORE_MIGRATIONS__)).toEqual(archive)
  expect(await preparationRows(env.DB, prepared.id)).toEqual(privateRows)
  expect(await readD1ImportPreparation(prepared.id, context())).toEqual(prepared)
  await unpublished()

  const other = await custodyActor(env.DB)
  await env.DB.prepare('UPDATE operators SET workspace_id=? WHERE id=?').bind(actor.workspaceId, other.operatorId).run()
  other.workspaceId = actor.workspaceId
  const wrongContexts = [importContext(env.DB, other, normalized.namespace), { ...context(), namespace: 'different-namespace' },
    { ...context(), destination: 'different-destination' }, { ...context(), mappingVersion: 'different-mapping' }]
  for (const wrong of wrongContexts) {
    const before = await snapshotFixture(env.DB, __PENCIL_CORE_MIGRATIONS__)
    await expect(readD1ImportPreparation(prepared.id, wrong)).rejects.toThrow()
    await expect(publishD1ImportPreparation(prepared.id, wrong)).rejects.toThrow()
    expect(await snapshotFixture(env.DB, __PENCIL_CORE_MIGRATIONS__)).toEqual(before)
  }
  const beforeOtherCancellation = await snapshotFixture(env.DB, __PENCIL_CORE_MIGRATIONS__)
  await cancelD1ImportStaging(normalized.namespace, importContext(env.DB, other, normalized.namespace))
  expect(await snapshotFixture(env.DB, __PENCIL_CORE_MIGRATIONS__)).toEqual(beforeOtherCancellation)
  await env.DB.prepare('UPDATE oa_sessions SET revoked_at=? WHERE id=?').bind(Date.now(), actor.id).run()
  const revoked = await snapshotFixture(env.DB, __PENCIL_CORE_MIGRATIONS__)
  await expect(readD1ImportPreparation(prepared.id, context())).rejects.toThrow()
  await expect(publishD1ImportPreparation(prepared.id, context())).rejects.toThrow()
  await expect(cancelD1ImportStaging(normalized.namespace, context())).rejects.toThrow()
  expect(await snapshotFixture(env.DB, __PENCIL_CORE_MIGRATIONS__)).toEqual(revoked)
  await env.DB.prepare('UPDATE oa_sessions SET revoked_at=NULL WHERE id=?').bind(actor.id).run()

  // A fresh context supplies no source, mapping callback or parsed upload.
  expect((await publishD1ImportPreparation(prepared.id, context())).state).toBe('applying')
  expect(await preparationRows(env.DB, prepared.id)).toEqual({ ik_d1_preparation_receipts: [], ik_d1_staging_headers: [] })
  for (let record = 0; record < prepared.total; record++) await resumeD1ImportStream(prepared.id, context())
  expect((await readD1ImportStream(prepared.id, context())).state).toBe('completed')
  expect(await env.DB.prepare('SELECT count(*) n FROM flows WHERE workspace_id=?').bind(actor.workspaceId).first()).toEqual({ n: 1 })
  expect((await env.DB.prepare('SELECT source,notification_eligible,completed_at FROM responses WHERE workspace_id=?').bind(actor.workspaceId).all()).results)
    .toEqual([{ source: 'imported', notification_eligible: 0, completed_at: '2026-09-12T10:03:00.000Z' }])
  expect(await env.DB.prepare('SELECT count(*) n FROM response_outbox WHERE workspace_id=?').bind(actor.workspaceId).first()).toEqual({ n: 0 })
  expect(await env.DB.prepare('SELECT count(*) n FROM notification_deliveries WHERE response_id IN (SELECT id FROM responses WHERE workspace_id=?)').bind(actor.workspaceId).first()).toEqual({ n: 0 })
  const beforeReplay = await archiveFixture(env.DB, __PENCIL_CORE_MIGRATIONS__)
  expect((await prepareD1ImportStream(normalized.source, normalized.mapping, { ...context(), reviewedFingerprint: plan.fingerprint, operationKey: normalized.namespace })).id).toBe(prepared.id)
  expect(await archiveFixture(env.DB, __PENCIL_CORE_MIGRATIONS__)).toEqual(beforeReplay)
  expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
})

contract(['DATA-001','DATA-002','IMPORT-004'], 'restored preparation cancellation and erasure cascade private headers and receipts without later resurrection', async () => {
  const actor = await custodyActor(env.DB)
  const make = async (namespace: string) => preparationCustody(env.DB, actor, namespace, custodySource(namespace, [{ answer: 'private preparation answer' }]), custodyMapping)
  const cancelled = await make(`cancel-${crypto.randomUUID()}`), erased = await make(`erase-${crypto.randomUUID()}`)
  const archive = await archiveFixture(env.DB, __PENCIL_CORE_MIGRATIONS__)
  await restoreFixture(env.DB, archive)
  expect(await archiveFixture(env.DB, __PENCIL_CORE_MIGRATIONS__)).toEqual(archive)
  await cancelD1ImportStaging(cancelled.namespace, { ...custodyContext(env.DB, actor, cancelled.namespace), reviewedFingerprint: cancelled.plan.fingerprint })
  const context = custodyContext(env.DB, actor, erased.namespace), id = `${erased.namespace}:0`
  await eraseD1ImportTarget('record', id, custodyTargets.remove(actor.workspaceId, 'record', id), context)
  const absent = async () => {
    for (const item of [cancelled, erased]) {
      expect(await preparationRows(env.DB, item.stage.id)).toEqual({ ik_d1_preparation_receipts: [], ik_d1_staging_headers: [] })
      expect(await env.DB.prepare('SELECT id FROM ik_d1_staging WHERE id=?').bind(item.stage.id).first()).toBeNull()
      expect(await env.DB.prepare('SELECT count(*) n FROM ik_jobs WHERE namespace=?').bind(item.namespace).first()).toEqual({ n: 0 })
      await expect(publishD1ImportPreparation(item.stage.id, custodyContext(env.DB, actor, item.namespace))).rejects.toThrow('IMPORT_PREPARATION_NOT_FOUND')
    }
    expect(await custodyTargets.read(env.DB, actor.workspaceId, 'record', id)).toBeNull()
  }
  await absent()
  const afterErasure = await archiveFixture(env.DB, __PENCIL_CORE_MIGRATIONS__)
  await restoreFixture(env.DB, afterErasure)
  expect(await archiveFixture(env.DB, __PENCIL_CORE_MIGRATIONS__)).toEqual(afterErasure)
  await expect(prepareD1ImportStream(erased.source, custodyMapping, { ...context, reviewedFingerprint: erased.plan.fingerprint, operationKey: erased.namespace })).rejects.toThrow()
  await absent()
  expect(await env.DB.prepare('SELECT count(*) n FROM ik_d1_erased_targets WHERE destination=?').bind(actor.workspaceId).first()).toEqual({ n: 1 })
  expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
})
