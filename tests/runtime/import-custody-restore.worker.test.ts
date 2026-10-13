import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { archiveFixture, restoreFixture } from './archive-fixture'
import { stagingPlan, destinationGuards, stageRows } from '../../scripts/deployment-data-staging.mjs'
import { schemaQuery, quote } from '../../scripts/deployment-data-sql.mjs'
import { canonicalSchema } from '../../scripts/deployment-data-schema.mjs'
import { custodyGraph } from '../../scripts/custody-test-graph.mjs'
import { custodyActor, custodyContext, custodySignIn } from '../../scripts/custody-test-targets.mjs'
import { verifyCustodyReadback, custodyTriggerCanaries } from '../../scripts/custody-test-canaries.mjs'
import { sha256, readD1ImportStream, resumeD1ImportStream, planD1ImportStream, createD1ImportStream, cancelD1ImportStaging } from '../../src/base/import-kit/src/d1/index'
import { custodyMapping } from '../../scripts/custody-test-graph.mjs'

declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
const second = (env as unknown as { IMPORT_SECOND: D1Database }).IMPORT_SECOND
beforeAll(async () => { await applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__); await applyD1Migrations(second, __PENCIL_CORE_MIGRATIONS__) })

contract(['DATA-001','BASE-DATA-001','IMPORT-004','BASE-OPS-003'], 'native custody restore preserves typed sealed generations and partial streams before cold recovery and restores every trigger', async () => {
  const graph = await custodyGraph(env.DB), archive = await archiveFixture(env.DB, __PENCIL_CORE_MIGRATIONS__)
  const empty = await archiveFixture(second, __PENCIL_CORE_MIGRATIONS__)
  const allSchema = (await env.DB.prepare("SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE sql IS NOT NULL AND name NOT GLOB 'sqlite_*' AND name!='_cf_METADATA' ORDER BY type,name").all()).results
  const foreignKeys = Object.fromEntries(await Promise.all([archive.payload.d1Migrations, ...archive.payload.tables].map(async table =>
    [table.name, (await env.DB.prepare(`PRAGMA foreign_key_list(${quote(table.name)})`).all()).results])))
  const store = { ...archive, sha256: sha256(JSON.stringify(archive.payload)), *rows(index: number) { yield* archive.payload.tables[index].rows } }
  const plan = stagingPlan(store, { schema: allSchema, foreignKeys })
  const query = (statements: Array<{ sql: string; params?: unknown[] }>) => second.batch(statements.map(({ sql, params = [] }) => second.prepare(sql).bind(...params)))
  await query([...destinationGuards(store, empty.payload.schema), ...plan.create])
  await stageRows(query, store, plan)
  expect(await second.prepare('SELECT count(*) n FROM ik_jobs').first()).toEqual({ n: 0 })
  const stagedSchema = JSON.stringify((await second.prepare(schemaQuery).all()).results)
  await query([...destinationGuards(store, stagedSchema), ...plan.publish])
  const restored = await archiveFixture(second, __PENCIL_CORE_MIGRATIONS__)
  canonicalSchema(JSON.parse(restored.payload.schema), archive.payload.schema)
  expect({ ...restored, payload: { ...restored.payload, schema: archive.payload.schema } }).toEqual(archive)
  await custodySignIn(second, graph.actor)
  await verifyCustodyReadback(second, graph)
  const beforeRefusal = JSON.stringify(await archiveFixture(second, __PENCIL_CORE_MIGRATIONS__))
  await expect(query(destinationGuards(store, restored.payload.schema))).rejects.toThrow()
  expect(JSON.stringify(await archiveFixture(second, __PENCIL_CORE_MIGRATIONS__)) === beforeRefusal).toBe(true)

  const other = await custodyActor(second)
  await second.prepare('UPDATE operators SET workspace_id=? WHERE id=?').bind(graph.actor.workspaceId, other.operatorId).run()
  other.workspaceId = graph.actor.workspaceId
  await expect(readD1ImportStream(graph.streamId, custodyContext(second, other, graph.namespace))).rejects.toThrow('JOB_BINDING_MISMATCH')
  const context = custodyContext(second, graph.actor, graph.namespace)
  expect((await resumeD1ImportStream(graph.streamId, context)).state).toBe('completed')
  expect(await second.prepare('SELECT id FROM ik_targets WHERE destination=? AND id=?').bind(graph.actor.workspaceId, graph.erasedId).first()).toBeNull()
  const pendingContext = custodyContext(second, graph.actor, graph.sealed.namespace)
  const reviewed = await planD1ImportStream(graph.sealed.source, custodyMapping, pendingContext)
  const recovered = await createD1ImportStream(reviewed, { ...pendingContext, reviewedFingerprint: reviewed.fingerprint, operationKey: graph.sealed.namespace })
  expect(recovered.state).toBe('applying')
  expect(await second.prepare('SELECT id FROM ik_d1_staging WHERE id=?').bind(graph.sealed.stage.id).first()).toBeNull()
  await cancelD1ImportStaging(graph.interrupted.namespace, { ...custodyContext(second, graph.actor, graph.interrupted.namespace), reviewedFingerprint: graph.interrupted.plan.fingerprint })
  for (const table of ['ik_d1_staging_pages','ik_d1_staging_chunks','ik_d1_staging_index','ik_d1_staging_originals']) {
    expect(await second.prepare(`SELECT count(*) n FROM ${table} WHERE stage_id=?`).bind(graph.interrupted.stage.id).first()).toEqual({ n: 0 })
  }
  expect((await second.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])

  await restoreFixture(env.DB, archive)
  expect(await archiveFixture(env.DB, __PENCIL_CORE_MIGRATIONS__)).toEqual(archive)
  await custodySignIn(env.DB, graph.actor)
  await verifyCustodyReadback(env.DB, graph)
  await custodyTriggerCanaries(env.DB, graph)
})
