import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { FormImports, importContext } from '../../src/core/features/importing/service'
import { prepareImport } from '../../src/core/features/importing/prepare'
import { ValidationError } from '../../src/core/shared/errors'
import { prepareD1ImportStream } from '../../src/base/import-kit/src/d1/index'
import { allStoredData, importPrivacyFixture } from './import-privacy-fixture'
import { simpleJson, simpleCsv } from '../fixtures/form-import/fixture'
declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(() => applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__))
const input = { definition: simpleJson, csv: simpleCsv, plannedAt: '2026-10-08T00:00:00.000Z' }
const privateTables = ['ik_d1_staging', 'ik_d1_staging_pages', 'ik_d1_staging_index', 'ik_d1_staging_chunks', 'ik_d1_staging_originals', 'ik_d1_preparation_receipts', 'ik_d1_staging_headers']
async function emptyPrivate() { for (const table of privateTables) expect(await env.DB.prepare(`SELECT count(*) n FROM ${table}`).first()).toEqual({ n: 0 }) }
async function unpublished(destination: string) {
  for (const table of ['ik_jobs', 'ik_d1_streams', 'flows', 'responses']) expect(await env.DB.prepare(`SELECT count(*) n FROM ${table} WHERE ${table.startsWith('ik_') ? 'destination' : 'workspace_id'}=?`).bind(destination).first()).toEqual({ n: 0 })
}

contract(['IMPORT-002', 'IMPORT-004', 'BASE-ACCESS-004'], 'acknowledgment creates owner-private unverified preparation and cold continuation verifies before native publication', async () => {
  const f = await importPrivacyFixture(), review = await f.imports.review(input)
  await emptyPrivate(); await unpublished(f.actor.workspaceId)
  let job = await f.imports.commit(input, review.fingerprint, true)
  expect(job).toMatchObject({ state: 'preparing', checkpoint: 0, total: 2, expectedFingerprint: review.fingerprint })
  expect(job).not.toHaveProperty('fingerprint')
  await unpublished(f.actor.workspaceId)
  const cold = new FormImports(env.DB, f.actor)
  expect(await cold.status(job.id)).toEqual(job)
  expect(await cold.list()).toEqual([job])
  expect((await cold.review(input))).toMatchObject({ jobId: job.id, jobState: 'preparing', alreadyImported: false, pendingCustody: review.fingerprint })
  expect(await cold.commit(input, review.fingerprint, true)).toEqual(job)
  const other = await importPrivacyFixture()
  await env.DB.prepare('UPDATE operators SET workspace_id=? WHERE id=?').bind(f.actor.workspaceId, other.actor.operatorId).run()
  other.actor.workspaceId = f.actor.workspaceId
  const foreign = new FormImports(env.DB, other.actor)
  expect(await foreign.list()).toEqual([])
  await expect(foreign.status(job.id)).rejects.toThrow('not found')
  await expect(foreign.resume(job.id)).rejects.toThrow('not found')
  await expect(foreign.undo(job.id)).rejects.toThrow('not found')
  await expect(foreign.commit(input, review.fingerprint, true)).rejects.toThrow('already have an import')
  await env.DB.prepare('UPDATE oa_sessions SET revoked_at=? WHERE id=?').bind(Date.now(), f.actor.id).run()
  await expect(cold.resume(job.id)).rejects.toThrow()
  await expect(cold.undo(job.id)).rejects.toThrow()
  await unpublished(f.actor.workspaceId)
  await env.DB.prepare('UPDATE oa_sessions SET revoked_at=NULL WHERE id=?').bind(f.actor.id).run()
  job = await cold.resume(job.id)
  expect(job.state).toBe('completed'); await emptyPrivate()
  expect(await env.DB.prepare('SELECT count(*) n FROM responses WHERE flow_id=?').bind(review.flowId).first()).toEqual({ n: 1 })
  expect((await cold.undo(job.id)).state).toBe('undone')
}, 90_000)

contract(['IMPORT-002', 'IMPORT-004'], 'commit rejects an unreviewed fingerprint without writes, and cold verification and owner cancellation prevent publication', async () => {
  const f = await importPrivacyFixture(), review = await f.imports.review(input)
  const mismatch = `${review.fingerprint[0] === '0' ? '1' : '0'}${review.fingerprint.slice(1)}`
  await emptyPrivate(); await unpublished(f.actor.workspaceId)
  const before = await allStoredData()
  await expect(f.imports.commit(input, mismatch, true)).rejects.toBeInstanceOf(ValidationError)
  // Compare every durable table without exposing stored private values on failure.
  expect(await allStoredData() === before).toBe(true)
  await emptyPrivate(); await unpublished(f.actor.workspaceId)
  expect(await f.imports.list()).toEqual([])

  // Base deliberately accepts unverified custody. Persist a mismatched preparation
  // through its real D1 transport to retain the cold fingerprint defense even
  // though Pencil's commit boundary now rejects it before any write.
  const prepared = prepareImport(input, f.actor.workspaceId)
  let job = await prepareD1ImportStream(prepared.source, prepared.mapping, {
    ...importContext(env.DB, f.actor, prepared.namespace), reviewedFingerprint: mismatch, operationKey: prepared.namespace,
  })
  expect(job.state).toBe('preparing'); await unpublished(f.actor.workspaceId)
  await expect(new FormImports(env.DB, f.actor).resume(job.id)).rejects.toThrow('REVIEW_FINGERPRINT_MISMATCH')
  await emptyPrivate(); await unpublished(f.actor.workspaceId)
  job = await f.imports.commit(input, review.fingerprint, true)
  expect((await new FormImports(env.DB, f.actor).undo(job.id)).state).toBe('cancelled')
  await emptyPrivate(); await unpublished(f.actor.workspaceId)
  expect(await f.imports.list()).toEqual([])
  await expect(f.imports.resume(job.id)).rejects.toThrow('not found')
}, 90_000)

contract(['IMPORT-002', 'IMPORT-004'], 'a publication winning the private cancellation race is reported as its actual public progress', async () => {
  const f = await importPrivacyFixture(), review = await f.imports.review(input)
  const prepared = await f.imports.commit(input, review.fingerprint, true)
  let raced = false
  const track = (statement: D1PreparedStatement, query: string): D1PreparedStatement => new Proxy(statement, { get(target, key) {
    if (key === 'bind') return (...values: unknown[]) => track(target.bind(...values), query)
    if (key === 'first') return async () => {
      if (!raced && query.startsWith('SELECT * FROM ik_d1_staging WHERE destination=? AND namespace=? AND principal_id=? AND operation_key=?')) {
        raced = true
        expect((await new FormImports(env.DB, f.actor).resume(prepared.id)).state).toBe('completed')
      }
      return target.first()
    }
    const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value
  } })
  const database = new Proxy(env.DB, { get(target, key) {
    if (key === 'prepare') return (query: string) => track(target.prepare(query), query)
    const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value
  } })
  const result = await new FormImports(database, f.actor).undo(prepared.id)
  expect(raced).toBe(true); expect(result.state).toBe('completed'); expect(result.id).toBe(prepared.id)
  await emptyPrivate()
  expect(await env.DB.prepare('SELECT count(*) n FROM responses WHERE flow_id=?').bind(review.flowId).first()).toEqual({ n: 1 })
  expect((await f.imports.undo(result.id)).state).toBe('undone')
}, 90_000)
