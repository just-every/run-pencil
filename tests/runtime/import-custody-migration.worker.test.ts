import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { canonicalJson, sha256, planD1Import, readD1ImportOriginals, initializeD1ImportStorage, preservedUndoEvolution } from '../../src/base/import-kit/src/d1/index'
import { originalsFor } from '../../src/base/import-kit/src/storage/originals'
import { custodyActor, custodyContext } from '../../scripts/custody-test-targets.mjs'
import { custodyMapping, custodySource } from '../../scripts/custody-test-graph.mjs'

declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
const predecessor = __PENCIL_CORE_MIGRATIONS__.filter(migration => Number(migration.name.slice(0, 4)) <= 18)
const second = (env as unknown as { IMPORT_SECOND: D1Database }).IMPORT_SECOND

contract(['BASE-OPS-002','BASE-OPS-003','IMPORT-004'], 'additive custody migration preserves a populated ordinary job and its version-three original receipt with strict defaults and ledger idempotence', async () => {
  expect(__PENCIL_CORE_MIGRATIONS__.some(migration => migration.name === '0019_import_custody.sql')).toBe(true)
  await applyD1Migrations(env.DB, predecessor)
  const actor = await custodyActor(env.DB), context = custodyContext(env.DB, actor, 'ordinary-before-upgrade')
  const plan = await planD1Import(custodySource(context.namespace, [{ answer: 'prior data\u0000😀', score: 0 }]), custodyMapping, context)
  const id = crypto.randomUUID(), flowId = crypto.randomUUID(), stamp = '2026-09-12T10:05:00.000Z'
  await env.DB.batch([
    env.DB.prepare("INSERT INTO flows(id,workspace_id,slug,title,status,draft_version,last_activity_at,created_at,updated_at) VALUES(?,?,?,'Prior imported form','draft',1,?,?,?)").bind(flowId, actor.workspaceId, `prior-${flowId}`, stamp, stamp, stamp),
    env.DB.prepare("INSERT INTO form_import_targets(target_id,workspace_id,kind,revision,flow_id) VALUES(?,?,'form',?,?)").bind(flowId, actor.workspaceId, sha256('{}'), flowId),
  ])
  const priorFlow = await env.DB.prepare('SELECT * FROM flows WHERE id=?').bind(flowId).first()
  const priorTarget = await env.DB.prepare('SELECT * FROM form_import_targets WHERE target_id=?').bind(flowId).first()
  await env.DB.batch([
    env.DB.prepare("INSERT INTO ik_jobs(id,destination,namespace,mapping_version,principal_id,fingerprint,operation_key,plan_json,state,total) VALUES(?,?,?,?,?,?,?,?,'queued',?)")
      .bind(id, actor.workspaceId, context.namespace, context.mappingVersion, actor.operatorId, plan.fingerprint, context.namespace, canonicalJson(plan), plan.entries.length),
    env.DB.prepare('INSERT INTO ik_original_sets(job_id,version) VALUES(?,3)').bind(id),
    ...originalsFor(plan, id).map(original => env.DB.prepare('INSERT INTO ik_originals(job_id,kind,original_key,name,sha256,size,bytes) VALUES(?,?,?,?,?,?,NULL)')
      .bind(id, original.kind, original.key, original.name, original.sha256, original.size)),
  ])
  const before = await env.DB.prepare('SELECT * FROM ik_jobs WHERE id=?').bind(id).first<Record<string, unknown>>()
  const originals = (await env.DB.prepare('SELECT * FROM ik_originals WHERE job_id=?').bind(id).all()).results
  await applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__)
  expect(await env.DB.prepare('SELECT * FROM ik_jobs WHERE id=?').bind(id).first()).toEqual({ ...before,
    reversal_policy: 'strict', reversal_policy_hash: null, reversal_cursor: 0, reversal_hash: sha256('[]') })
  expect((await env.DB.prepare('SELECT * FROM ik_originals WHERE job_id=?').bind(id).all()).results).toEqual(originals)
  expect(await env.DB.prepare('SELECT version FROM ik_original_sets WHERE job_id=?').bind(id).first()).toEqual({ version: 3 })
  expect(await env.DB.prepare('SELECT * FROM flows WHERE id=?').bind(flowId).first()).toEqual(priorFlow)
  expect(await env.DB.prepare('SELECT * FROM form_import_targets WHERE target_id=?').bind(flowId).first()).toEqual(priorTarget)
  expect(await env.DB.prepare('SELECT * FROM form_import_native_clock').first()).toEqual({ id: 1, revision: 1 })
  expect(await env.DB.prepare('SELECT * FROM form_import_native_epochs WHERE target_id=?').bind(flowId).first()).toEqual({ target_id: flowId, revision: 1, seal: null })
  expect(await env.DB.prepare('SELECT * FROM ik_d1_custody_revisions WHERE job_id=?').bind(id).first()).toEqual({ job_id: id, revision: 0, seal: null })
  expect(await env.DB.prepare('SELECT * FROM ik_d1_custody_states WHERE job_id=?').bind(id).first()).toEqual({ job_id: id, revision: 0 })
  expect((await readD1ImportOriginals(id, context)).every(original => original.original.status === 'unavailable')).toBe(true)
  const schema = async () => (await env.DB.prepare("SELECT type,name,sql FROM sqlite_schema WHERE name LIKE 'ik_%' ORDER BY type,name").all()).results
  const installed = await schema()
  await applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__)
  await initializeD1ImportStorage(env.DB)
  expect(await schema()).toEqual(installed)
  expect((await env.DB.prepare('SELECT name FROM d1_migrations ORDER BY id').all<{ name: string }>()).results.map(row => row.name)).toEqual(__PENCIL_CORE_MIGRATIONS__.map(migration => migration.name))
  expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
})

contract(['BASE-OPS-002','IMPORT-004'], 'a partial custody evolution is refused without silently completing or relabeling stored data', async () => {
  await applyD1Migrations(second, predecessor)
  await second.prepare(preservedUndoEvolution[0]).run()
  const schema = async () => (await second.prepare("SELECT type,name,sql FROM sqlite_schema WHERE name LIKE 'ik_%' ORDER BY type,name").all()).results
  const before = await schema()
  await expect(initializeD1ImportStorage(second)).rejects.toThrow('IMPORT_SCHEMA_EVOLUTION_INCOMPLETE')
  expect(await schema()).toEqual(before)
  expect(await second.prepare("SELECT name FROM sqlite_schema WHERE name='ik_d1_staging'").first()).toBeNull()
})
