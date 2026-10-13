import { applyD1Migrations, env, SELF, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { hashToken, opaqueToken } from '../../src/base/operator-auth/crypto.mjs'
import { FormImports } from '../../src/core/features/importing/service'
import { importPrivacyFixture } from './import-privacy-fixture'
import { simpleJson, simpleCsv } from '../fixtures/form-import/fixture'

declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(() => applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__))
const privateTables = ['ik_d1_staging', 'ik_d1_staging_pages', 'ik_d1_staging_index', 'ik_d1_staging_chunks', 'ik_d1_staging_originals', 'ik_d1_preparation_receipts', 'ik_d1_staging_headers']
const input = { definition: simpleJson, csv: simpleCsv, plannedAt: '2026-10-08T00:00:00.000Z' }

// Real D1 runs every preceding transaction; the fault models a runtime exit
// after payload custody, including the unavailable cleanup transaction.
function interruptedDatabase(): D1Database {
  const statements = new WeakMap<object, string>()
  let stopped = false
  const track = (statement: D1PreparedStatement, query: string): D1PreparedStatement => {
    const wrapped = new Proxy(statement, { get(target, key) { if (key === 'bind') return (...values: unknown[]) => track(target.bind(...values), query); const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value } })
    statements.set(wrapped, query)
    return wrapped
  }
  return new Proxy(env.DB, { get(target, key) {
    if (key === 'prepare') return (query: string) => track(target.prepare(query), query)
    if (key === 'batch') return (batch: D1PreparedStatement[]) => { if (batch.some(statement => statements.get(statement)?.startsWith('INSERT INTO ik_d1_staging_originals'))) stopped = true; if (stopped) throw new Error('synthetic runtime interruption'); return target.batch(batch) }
    const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value
  } })
}

contract(['IMPORT-002', 'IMPORT-004', 'BASE-ACCESS-004'], 'interrupted private custody is discoverable on review and cancellation requires the current owning operator', async () => {
  const f = await importPrivacyFixture(), service = new FormImports(interruptedDatabase(), f.actor)
  const review = await service.review(input)
  await expect(service.commit(input, review.fingerprint, true)).rejects.toThrow('synthetic runtime interruption')
  for (const table of ['ik_jobs', 'ik_d1_streams', 'flows', 'responses']) expect(await env.DB.prepare(`SELECT count(*) n FROM ${table} WHERE ${table.startsWith('ik_') ? 'destination' : 'workspace_id'}=?`).bind(f.actor.workspaceId).first()).toEqual({ n: 0 })
  expect((await env.DB.prepare('SELECT count(*) n FROM ik_d1_staging_chunks').first<{ n: number }>())!.n).toBeGreaterThan(0)
  const cold = new FormImports(env.DB, f.actor)
  expect((await cold.review(input)).pendingCustody).toBe(review.fingerprint)
  const other = await importPrivacyFixture()
  await env.DB.prepare('UPDATE operators SET workspace_id=? WHERE id=?').bind(f.actor.workspaceId, other.actor.operatorId).run()
  other.actor.workspaceId = f.actor.workspaceId
  const foreign = new FormImports(env.DB, other.actor)
  expect((await foreign.review(input)).pendingCustody).toBeUndefined()
  expect(await foreign.cancelStaging(review.fingerprint)).toEqual({ cancelled: true })
  expect(await env.DB.prepare('SELECT count(*) n FROM ik_d1_staging').first()).toEqual({ n: 1 })
  await env.DB.prepare('UPDATE oa_sessions SET revoked_at=? WHERE id=?').bind(Date.now(), f.actor.id).run()
  await expect(cold.cancelStaging(review.fingerprint)).rejects.toThrow('current operator session')
  expect(await env.DB.prepare('SELECT count(*) n FROM ik_d1_staging').first()).toEqual({ n: 1 })
  await env.DB.prepare('UPDATE oa_sessions SET revoked_at=NULL WHERE id=?').bind(f.actor.id).run()
  expect(await cold.cancelStaging(review.fingerprint)).toEqual({ cancelled: true })
  for (const table of privateTables) expect(await env.DB.prepare(`SELECT count(*) n FROM ${table}`).first()).toEqual({ n: 0 })
  expect(await cold.cancelStaging(review.fingerprint)).toEqual({ cancelled: true })
  let job = await cold.commit(input, review.fingerprint, true)
  expect(job.state).toBe('preparing')
  job = await cold.resume(job.id)
  expect(await cold.cancelStaging(review.fingerprint)).toEqual({ cancelled: false, job })
  expect((await cold.status(job.id)).id).toBe(job.id)
}, 90_000)

contract(['DATA-002', 'IMPORT-004', 'BASE-ACCESS-004'], 'imported response erasure rejects a missing or mismatched Host even with a current native cookie', async () => {
  const f = await importPrivacyFixture(), review = await f.imports.review(input)
  let job = await f.imports.commit(input, review.fingerprint, true)
  while (job.state !== 'completed') job = await f.imports.resume(job.id)
  const response = (await env.DB.prepare('SELECT id FROM responses WHERE flow_id=? LIMIT 1').bind(review.flowId).first<{ id: string }>())!
  const token = opaqueToken(), sessionId = crypto.randomUUID()
  await env.DB.prepare("INSERT INTO oa_sessions(id,token_hash,operator_id,operator_version,kind,created_at,expires_at) VALUES(?,?,?,1,'native',?,?)").bind(sessionId, await hashToken(env.SESSION_SECRET, 'session', token), f.actor.operatorId, Date.now(), Date.now() + 3600000).run()
  for (const host of [undefined, 'mismatched.example.test']) {
    const headers = new Headers({ Origin: 'http://localhost', Cookie: `operator_session_local_80=${token}` })
    if (host) headers.set('Host', host)
    const denied = await SELF.fetch(`http://localhost/api/app/responses/${response.id}`, { method: 'DELETE', headers })
    expect(denied.status).toBe(403)
    expect(await env.DB.prepare('SELECT id FROM responses WHERE id=?').bind(response.id).first()).toEqual(response)
    expect(await env.DB.prepare('SELECT count(*) n FROM ik_d1_erased_targets WHERE destination=?').bind(f.actor.workspaceId).first()).toEqual({ n: 0 })
  }
}, 90_000)

contract(['IMPORT-002', 'IMPORT-004', 'BASE-ACCESS-004'], 'concurrent operators cannot publish duplicate custody for the same files and the loser can cancel only its private copy', async () => {
  const first = await importPrivacyFixture(), second = await importPrivacyFixture()
  await env.DB.prepare('UPDATE operators SET workspace_id=? WHERE id=?').bind(first.actor.workspaceId, second.actor.operatorId).run()
  second.actor.workspaceId = first.actor.workspaceId
  const winner = new FormImports(env.DB, second.actor), reviewed = await winner.review(input)
  const statements = new WeakMap<object, string>()
  let raced = false, winnerId = ''
  const track = (statement: D1PreparedStatement, query: string): D1PreparedStatement => {
    const wrapped = new Proxy(statement, { get(target, key) { if (key === 'bind') return (...values: unknown[]) => track(target.bind(...values), query); const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value } })
    statements.set(wrapped, query); return wrapped
  }
  const database = new Proxy(env.DB, { get(target, key) {
    if (key === 'prepare') return (query: string) => track(target.prepare(query), query)
    if (key === 'batch') return async (batch: D1PreparedStatement[]) => {
      if (!raced && batch.some(statement => statements.get(statement)?.startsWith('INSERT INTO ik_d1_staging('))) {
        raced = true
        let job = await winner.commit(input, reviewed.fingerprint, true)
        while (job.state !== 'completed') job = await winner.resume(job.id)
        winnerId = job.id
      }
      return target.batch(batch)
    }
    const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value
  } })
  const loser = new FormImports(database, first.actor), review = await loser.review(input)
  await expect(loser.commit(input, review.fingerprint, true)).rejects.toThrow('IMPORT_ATOMIC_GUARD')
  expect(raced).toBe(true)
  expect((await env.DB.prepare('SELECT DISTINCT principal_id FROM ik_jobs WHERE destination=?').bind(first.actor.workspaceId).all()).results).toEqual([{ principal_id: second.actor.operatorId }])
  const before = (await env.DB.prepare('SELECT * FROM ik_jobs WHERE destination=? ORDER BY id').bind(first.actor.workspaceId).all()).results
  const nativeBefore = (await env.DB.prepare('SELECT * FROM responses WHERE workspace_id=? ORDER BY id').bind(first.actor.workspaceId).all()).results
  expect(await first.imports.cancelStaging(review.fingerprint)).toEqual({ cancelled: true })
  expect((await env.DB.prepare('SELECT * FROM ik_jobs WHERE destination=? ORDER BY id').bind(first.actor.workspaceId).all()).results).toEqual(before)
  expect((await env.DB.prepare('SELECT * FROM responses WHERE workspace_id=? ORDER BY id').bind(first.actor.workspaceId).all()).results).toEqual(nativeBefore)
  expect((await winner.status(winnerId)).state).toBe('completed')
  expect((await first.imports.review(input)).heldByOtherOperator).toBe(true)
  for (const table of privateTables) expect(await env.DB.prepare(`SELECT count(*) n FROM ${table}`).first()).toEqual({ n: 0 })
}, 90_000)
