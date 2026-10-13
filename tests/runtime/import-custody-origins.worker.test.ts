import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { archiveFixture, snapshotFixture } from './archive-fixture'
import { custodyGraph } from '../../scripts/custody-test-graph.mjs'
import { custodyActor, custodyContext } from '../../scripts/custody-test-targets.mjs'
import { readStreamOrigins } from '../../scripts/custody-test-origins.mjs'
import { verifyCustodyReadback } from '../../scripts/custody-test-canaries.mjs'
import { restoreStatements } from '../../scripts/deployment-data-sql.mjs'
import { d1StreamOriginSchema, initializeD1ImportStorage, readD1ImportStream } from '../../src/base/import-kit/src/d1/index'

declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
const second = (env as unknown as { IMPORT_SECOND: D1Database }).IMPORT_SECOND
beforeAll(async () => { await applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__); await applyD1Migrations(second, __PENCIL_CORE_MIGRATIONS__) })

contract(['DATA-001','IMPORT-004','BASE-OPS-002','BASE-OPS-003'], 'real membership backfills durable stream origins, preserves ordinary custody and survives archive replay without inferring orphan ownership', async () => {
  const graph = await custodyGraph(env.DB)
  // Construct the predecessor shape from genuine kit-created membership. The
  // ordinary job and every source value remain exactly as originally created.
  const originTriggers = d1StreamOriginSchema.flatMap(sql => {
    const match = /^CREATE TRIGGER IF NOT EXISTS (\w+)/.exec(sql)
    return match?.[1].startsWith('ik_d1_stream_origin_') ? [match[1]] : []
  })
  await env.DB.batch([
    ...originTriggers.map(name => env.DB.prepare(`DROP TRIGGER ${name}`)),
    env.DB.prepare('DROP TABLE ik_d1_stream_origins'),
    env.DB.prepare('UPDATE ik_original_sets SET version=3 WHERE job_id IN (SELECT job_id FROM ik_d1_stream_pages WHERE stream_id=?)').bind(graph.streamId),
  ])
  const jobs = (await env.DB.prepare('SELECT * FROM ik_jobs WHERE destination=? ORDER BY id').bind(graph.actor.workspaceId).all()).results
  const ordinaryOriginals = (await env.DB.prepare('SELECT * FROM ik_originals WHERE job_id=? ORDER BY original_key').bind(graph.ordinaryId).all()).results
  await initializeD1ImportStorage(env.DB)
  expect(await readStreamOrigins(env.DB, graph.streamId)).toEqual(graph.origins)
  expect(await env.DB.prepare('SELECT job_id FROM ik_d1_stream_origins WHERE job_id=?').bind(graph.ordinaryId).first()).toBeNull()
  expect(await env.DB.prepare('SELECT version FROM ik_original_sets WHERE job_id=?').bind(graph.ordinaryId).first()).toEqual({ version: 3 })
  expect((await env.DB.prepare('SELECT * FROM ik_jobs WHERE destination=? ORDER BY id').bind(graph.actor.workspaceId).all()).results).toEqual(jobs)
  expect((await env.DB.prepare('SELECT * FROM ik_originals WHERE job_id=? ORDER BY original_key').bind(graph.ordinaryId).all()).results).toEqual(ordinaryOriginals)
  for (const origin of graph.origins) expect(await env.DB.prepare('SELECT version FROM ik_original_sets WHERE job_id=?').bind(origin.job_id).first()).toEqual({ version: 4 })
  const installed = await snapshotFixture(env.DB, __PENCIL_CORE_MIGRATIONS__)
  await initializeD1ImportStorage(env.DB)
  expect(await snapshotFixture(env.DB, __PENCIL_CORE_MIGRATIONS__)).toEqual(installed)

  const archive = await archiveFixture(env.DB, __PENCIL_CORE_MIGRATIONS__)
  await second.batch(restoreStatements(archive, JSON.parse(archive.payload.schema), (base64: string) =>
    [...atob(base64)].map(char => char.charCodeAt(0).toString(16).padStart(2, '0')).join(''))
    .map(({ sql, params = [] }: { sql: string; params?: unknown[] }) => second.prepare(sql).bind(...params)))
  expect(await archiveFixture(second, __PENCIL_CORE_MIGRATIONS__)).toEqual(archive)
  await verifyCustodyReadback(second, graph)
  expect(await readStreamOrigins(second, crypto.randomUUID())).toEqual([])
  const other = await custodyActor(second), scoped = await snapshotFixture(second, __PENCIL_CORE_MIGRATIONS__)
  await expect(readD1ImportStream(graph.streamId, custodyContext(second, other, graph.namespace))).rejects.toThrow('JOB_BINDING_MISMATCH')
  expect(await snapshotFixture(second, __PENCIL_CORE_MIGRATIONS__)).toEqual(scoped)

  await expect(second.prepare('UPDATE ik_d1_stream_origins SET ordinal=ordinal WHERE stream_id=?').bind(graph.streamId).run()).rejects.toThrow()
  await expect(second.prepare('DELETE FROM ik_d1_stream_origins WHERE stream_id=?').bind(graph.streamId).run()).rejects.toThrow()
  await second.prepare('DELETE FROM ik_d1_stream_pages WHERE stream_id=?').bind(graph.streamId).run()
  await second.prepare('DELETE FROM ik_d1_streams WHERE id=?').bind(graph.streamId).run()
  expect(await readStreamOrigins(second, graph.streamId)).toEqual(graph.origins)
  const orphaned = await snapshotFixture(second, __PENCIL_CORE_MIGRATIONS__)
  await expect(initializeD1ImportStorage(second)).rejects.toThrow()
  expect(await snapshotFixture(second, __PENCIL_CORE_MIGRATIONS__)).toEqual(orphaned)
})
