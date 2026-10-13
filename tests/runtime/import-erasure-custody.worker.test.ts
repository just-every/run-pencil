import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { archiveFixture, snapshotFixture, restoreFixture } from './archive-fixture'
import { nativeCustodyFixture } from './import-custody-native-fixture'
import { interceptCustodyCommit } from './import-custody-commit-boundary'
import { importContext } from '../../src/core/features/importing/service'
import { custodyGraph } from '../../scripts/custody-test-graph.mjs'
import { custodyContext, custodyTargets, custodySignIn } from '../../scripts/custody-test-targets.mjs'
import { readD1ImportStream, resumeD1ImportStream, undoD1ImportStream, planD1ImportStream, createD1ImportStream,
  upgradeD1ImportErasureIndex, eraseD1ImportTarget, readD1ImportUndoReport, d1RequestContext } from '../../src/base/import-kit/src/d1/index'

declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(() => applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__))

contract(['DATA-002','IMPORT-003','IMPORT-004','BASE-ACCESS-004'], 'native imported erasure requires complete indexes and current commit authority, then erases repeated and private custody across cold restore', async () => {
  const f = await nativeCustodyFixture(env.DB, env)
  const page = await env.DB.prepare('SELECT job_id FROM ik_d1_stream_pages WHERE stream_id=? ORDER BY ordinal LIMIT 1').bind(f.first.id).first<{ job_id: string }>()
  await env.DB.prepare('DELETE FROM ik_d1_indexed_jobs WHERE job_id=?').bind(page!.job_id).run()
  const snapshot = async () => JSON.stringify(await snapshotFixture(env.DB, __PENCIL_CORE_MIGRATIONS__))
  const missingIndex = await snapshot()
  await expect(f.services.responses.eraseReleasedResponse(f.input)).rejects.toThrow('IMPORT_ERASURE_INDEX_UPGRADE_REQUIRED')
  expect(await snapshot() === missingIndex).toBe(true)
  // Exercise both index preparation and erasure with native revocation arriving
  // after their reads and before their actual atomic batch.
  for (const change of ['revoked', 'expired', 'version'] as const) for (const action of ['index', 'erase'] as const) {
    if (action === 'index') await env.DB.prepare('DELETE FROM ik_d1_indexed_jobs WHERE job_id=?').bind(page!.job_id).run()
    let expected = ''
    const boundary = interceptCustodyCommit(env.DB, action, async () => {
      if (change === 'version') await env.DB.prepare('UPDATE oa_operators SET version=version+1 WHERE id=(SELECT auth_id FROM operator_auth_links WHERE operator_id=?)').bind(f.actor.operatorId).run()
      else await env.DB.prepare(`UPDATE oa_sessions SET ${change === 'revoked' ? 'revoked_at' : 'expires_at'}=? WHERE id=?`).bind(Date.now() - 1, f.actor.id).run()
      expected = await snapshot()
    })
    try {
      await expect(action === 'index' ? upgradeD1ImportErasureIndex(f.context) : f.services.responses.eraseReleasedResponse(f.input)).rejects.toThrow()
      expect(boundary.state.initialAuthorizedBatch).toBe(true)
      expect(boundary.state.authorizedBeforeMutation).toBe(true)
      expect(boundary.state.readBeforeMutation).toBe(true)
      expect(boundary.state.mutationReached).toBe(true)
      expect(await snapshot() === expected).toBe(true)
    } finally { boundary.restore() }
    await env.DB.prepare('UPDATE oa_sessions SET revoked_at=NULL,expires_at=?,operator_version=(SELECT version FROM oa_operators WHERE id=oa_sessions.operator_id) WHERE id=?').bind(Date.now() + 3600000, f.actor.id).run()
    expect((await upgradeD1ImportErasureIndex(f.context)).complete).toBe(true)
  }
  const exhausted = d1RequestContext(f.context), exhaustedDatabase = exhausted.storage.database
  for (let batch = 0; batch < 10; batch++) await exhaustedDatabase.batch(Array.from({ length: 100 }, () => exhaustedDatabase.prepare('SELECT 1')))
  const beforeBudgetRefusal = await snapshot()
  await expect(eraseD1ImportTarget('response', f.erasedId, f.context.storage.targets.remove(f.actor.workspaceId, 'response', f.erasedId), exhausted)).rejects.toThrow('IMPORT_D1_REQUEST_LIMIT')
  expect(await snapshot() === beforeBudgetRefusal).toBe(true)
  await f.services.responses.eraseReleasedResponse(f.input)
  const absent = async () => {
    for (const [table, key] of [['responses','id'], ['response_answers','response_id'], ['response_outbox','response_id'], ['notification_deliveries','response_id'], ['form_import_targets','target_id']] as const)
      expect(await env.DB.prepare(`SELECT count(*) n FROM ${table} WHERE ${key}=?`).bind(f.erasedId).first()).toEqual({ n: 0 })
    expect(await env.DB.prepare('SELECT * FROM ik_d1_staging WHERE id=?').bind(f.stage.id).first()).toBeNull()
    for (const table of ['ik_d1_staging_pages','ik_d1_staging_chunks','ik_d1_staging_index','ik_d1_staging_originals'])
      expect(await env.DB.prepare(`SELECT count(*) n FROM ${table} WHERE stage_id=?`).bind(f.stage.id).first()).toEqual({ n: 0 })
  }
  await absent()
  for (const id of [f.first.id, f.repeated.id]) expect((await readD1ImportStream(id, f.context)).erasedRecords).toBe(1)
  const archive = await archiveFixture(env.DB, __PENCIL_CORE_MIGRATIONS__)
  await restoreFixture(env.DB, archive)
  expect(await archiveFixture(env.DB, __PENCIL_CORE_MIGRATIONS__)).toEqual(archive)
  await custodySignIn(env.DB, f.actor)
  const cold = { ...importContext(env.DB, f.actor, f.prepared.namespace), batchSize: 1, maxBatches: 1 }
  for (const id of [f.first.id, f.repeated.id]) {
    for (let step = 0; step < 3; step++) await resumeD1ImportStream(id, cold)
    expect((await readD1ImportStream(id, cold)).state).toBe('completed')
    await absent()
  }
  const again = await planD1ImportStream(f.prepared.source, f.prepared.mapping, cold)
  await expect(createD1ImportStream(again, { ...cold, reviewedFingerprint: again.fingerprint, operationKey: 'after-restore' })).rejects.toThrow()
  await absent()
  for (const id of [f.repeated.id, f.first.id]) {
    for (let step = 0; step < 3; step++) await undoD1ImportStream(id, cold)
    await absent()
  }
  expect(await env.DB.prepare('SELECT count(*) n FROM response_outbox WHERE workspace_id=?').bind(f.actor.workspaceId).first()).toEqual({ n: 0 })
  expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
})

contract(['DATA-001','DATA-002','IMPORT-004'], 'erasure removes cross-target preserved evidence with valid recomputed report seals while preserving the later native edit through archive replay', async () => {
  const graph = await custodyGraph(env.DB), context = custodyContext(env.DB, graph.actor, graph.namespace)
  const retainedId = `${graph.namespace}:1`, editedId = `${graph.ordinaryNamespace}:0`
  const edited = await custodyTargets.read(env.DB, graph.actor.workspaceId, 'record', editedId)
  expect(JSON.stringify(graph.report).includes('retained\\u0000')).toBe(true)
  await eraseD1ImportTarget('record', retainedId, custodyTargets.remove(graph.actor.workspaceId, 'record', retainedId), context)
  const reportContext = custodyContext(env.DB, graph.actor, graph.ordinaryNamespace)
  const report = await readD1ImportUndoReport(graph.ordinaryId, reportContext)
  expect(report.dispositions).toHaveLength(1)
  expect(report.dispositions[0]).toMatchObject({ reason: 'edited', redacted: 'evidence', evidence: null,
    expected: { valueHash: null, ownedValue: null }, observed: { valueHash: null, ownedValue: null } })
  expect(await custodyTargets.read(env.DB, graph.actor.workspaceId, 'record', editedId)).toEqual(edited)
  const archive = await archiveFixture(env.DB, __PENCIL_CORE_MIGRATIONS__)
  await restoreFixture(env.DB, archive)
  await custodySignIn(env.DB, graph.actor)
  expect(await readD1ImportUndoReport(graph.ordinaryId, reportContext)).toEqual(report)
  expect(await custodyTargets.read(env.DB, graph.actor.workspaceId, 'record', editedId)).toEqual(edited)
  expect(await custodyTargets.read(env.DB, graph.actor.workspaceId, 'record', retainedId)).toBeNull()
  await eraseD1ImportTarget('record', editedId, custodyTargets.remove(graph.actor.workspaceId, 'record', editedId), reportContext)
  const direct = await readD1ImportUndoReport(graph.ordinaryId, reportContext)
  expect(direct.dispositions[0]).toMatchObject({ reason: 'edited', redacted: 'erased', evidence: null, targetKind: 'erased',
    expected: { valueHash: null, ownedValue: null }, observed: { valueHash: null, ownedValue: null } })
  expect(await custodyTargets.read(env.DB, graph.actor.workspaceId, 'record', editedId)).toBeNull()
})
