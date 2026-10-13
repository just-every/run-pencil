import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { eraseResponseAndImportCustody } from '../../src/core/features/importing/erasure'
import { importPrivacyFixture } from './import-privacy-fixture'
import { simpleJson, simpleCsv } from '../fixtures/form-import/fixture'
declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(() => applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__))
async function ordinary() {
  const f = await importPrivacyFixture(), input = { definition: simpleJson, csv: simpleCsv, plannedAt: '2026-10-08T00:00:00.000Z' }
  const review = await f.imports.review(input); let job = await f.imports.commit(input, review.fingerprint, true)
  while (job.state !== 'completed') job = await f.imports.resume(job.id)
  const original = (await env.DB.prepare('SELECT * FROM responses WHERE flow_id=? LIMIT 1').bind(review.flowId).first<Record<string, unknown>>())!
  const row = { ...original, id: crypto.randomUUID(), session_id: crypto.randomUUID(), idempotency_key: crypto.randomUUID(), source: 'direct' }
  await env.DB.prepare(`INSERT INTO responses(${Object.keys(row).join(',')}) VALUES(${Object.keys(row).map(() => '?').join(',')})`).bind(...Object.values(row)).run()
  const request = { workspaceId: f.actor.workspaceId, responseId: row.id, operatorId: f.actor.operatorId, sessionId: f.actor.id }
  const statements = [{ sql: 'DELETE FROM responses WHERE id=? AND workspace_id=?', params: [row.id, f.actor.workspaceId] }]
  return { f, row, request, statements, flowId: review.flowId }
}
function beforeBatch(action: () => Promise<void>): D1Database {
  return new Proxy(env.DB, { get(target, key) {
    if (key === 'batch') return async (statements: D1PreparedStatement[]) => { await action(); return target.batch(statements) }
    const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value
  } })
}
for (const session of [true, false]) contract(['DATA-002', 'BASE-ACCESS-004'], `ordinary erasure retains native result positions with ${session ? 'current session' : 'existing internal caller'} authority`, async () => {
  const r = await ordinary(), input = { ...r.request, ...(session ? {} : { sessionId: undefined }) }
  const results = await eraseResponseAndImportCustody(env.DB, input, r.statements)
  expect(results).toHaveLength(1); expect(results[0].meta.changes).toBeGreaterThan(0)
  expect(await env.DB.prepare('SELECT id FROM responses WHERE id=?').bind(r.row.id).first()).toBeNull()
  expect(await env.DB.prepare('SELECT count(*) n FROM ik_d1_assertions').first()).toEqual({ n: 0 })
})
for (const race of ['source', 'marker', 'authority']) contract(['DATA-002', 'IMPORT-004', 'BASE-ACCESS-004'], `ordinary erasure refuses a ${race} change after its source read`, async () => {
  const r = await ordinary()
  const db = beforeBatch(async () => {
    if (race === 'source') await env.DB.prepare("UPDATE responses SET source='imported' WHERE id=?").bind(r.row.id).run()
    if (race === 'marker') await env.DB.prepare("INSERT INTO form_import_targets(target_id,workspace_id,kind,revision,flow_id) VALUES(?,?,'response','concurrent',?)").bind(r.row.id, r.request.workspaceId, r.flowId).run()
    if (race === 'authority') await env.DB.prepare('UPDATE oa_sessions SET revoked_at=? WHERE id=?').bind(Date.now(), r.request.sessionId).run()
  })
  await expect(eraseResponseAndImportCustody(db, r.request, r.statements)).rejects.toThrow('IMPORT_ATOMIC_GUARD')
  expect(await env.DB.prepare('SELECT id FROM responses WHERE id=?').bind(r.row.id).first()).toEqual({ id: r.row.id })
  expect(await env.DB.prepare('SELECT count(*) n FROM ik_d1_assertions').first()).toEqual({ n: 0 })
})
contract(['DATA-002', 'IMPORT-004', 'BASE-ACCESS-004'], 'ordinary erasure rolls back native writes when current authority changes inside its transaction', async () => {
  const r = await ordinary()
  await expect(eraseResponseAndImportCustody(env.DB, r.request, [
    { sql: 'UPDATE oa_sessions SET revoked_at=1 WHERE id=?', params: [r.request.sessionId] }, ...r.statements,
  ])).rejects.toThrow('IMPORT_ATOMIC_GUARD')
  expect(await env.DB.prepare('SELECT id FROM responses WHERE id=?').bind(r.row.id).first()).toEqual({ id: r.row.id })
  expect(await env.DB.prepare('SELECT revoked_at FROM oa_sessions WHERE id=?').bind(r.request.sessionId).first()).toEqual({ revoked_at: null })
})

for (const marker of [false, true]) contract(['DATA-002', 'IMPORT-004', 'BASE-ACCESS-004'], `ordinary erasure accepts a concurrent deletion only with no remaining custody marker: ${!marker}`, async () => {
  const r = await ordinary()
  const db = beforeBatch(async () => {
    await env.DB.prepare('DELETE FROM responses WHERE id=?').bind(r.row.id).run()
    if (marker) await env.DB.prepare("INSERT INTO form_import_targets(target_id,workspace_id,kind,revision,flow_id) VALUES(?,?,'response','concurrent',?)").bind(r.row.id, r.request.workspaceId, r.flowId).run()
  })
  const erased = eraseResponseAndImportCustody(db, r.request, r.statements)
  if (marker) await expect(erased).rejects.toThrow('IMPORT_ATOMIC_GUARD')
  else {
    const results = await erased
    expect(results).toHaveLength(1)
    expect(results[0].meta.changes).toBe(0)
  }
  expect(await env.DB.prepare('SELECT id FROM responses WHERE id=?').bind(r.row.id).first()).toBeNull()
  expect(await env.DB.prepare('SELECT count(*) n FROM ik_d1_assertions').first()).toEqual({ n: 0 })
})

for(const mutation of ['session','response'])contract(['DATA-002','IMPORT-004','BASE-ACCESS-004'],`ordinary erasure refuses ${mutation} mutation at final assertion cleanup`,async()=>{
  const r=await ordinary()
  const insert=`INSERT INTO responses(${Object.keys(r.row).join(',')}) VALUES(${Object.values(r.row).map(value=>value===null?'NULL':typeof value==='number'?String(value):"'"+String(value).replaceAll("'","''")+"'").join(',')})`
  const effect=mutation==='session'?`UPDATE oa_sessions SET revoked_at=1 WHERE id='${r.request.sessionId}'`:insert
  await env.DB.prepare(`CREATE TRIGGER ordinary_late_cleanup AFTER DELETE ON ik_d1_assertions WHEN NOT EXISTS(SELECT 1 FROM responses WHERE id='${r.row.id}') BEGIN ${effect};END`).run()
  try{
    await expect(eraseResponseAndImportCustody(env.DB,r.request,r.statements)).rejects.toThrow(/malformed JSON|IMPORT_ATOMIC_GUARD/)
    expect(await env.DB.prepare('SELECT * FROM responses WHERE id=?').bind(r.row.id).first()).toEqual(r.row)
    expect(await env.DB.prepare('SELECT revoked_at FROM oa_sessions WHERE id=?').bind(r.request.sessionId).first()).toEqual({revoked_at:null})
  }finally{await env.DB.prepare('DROP TRIGGER ordinary_late_cleanup').run()}
})
