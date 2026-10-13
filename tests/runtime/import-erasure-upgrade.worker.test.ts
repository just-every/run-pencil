import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { d1ErasureSchema, planD1Import, createD1ImportJob, resumeD1Import } from '../../src/base/import-kit/src/d1/index'
import { prepareImport } from '../../src/core/features/importing/prepare'
import { importContext } from '../../src/core/features/importing/service'
import { importPrivacyFixture, allStoredData } from './import-privacy-fixture'
declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(() => applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__))

for (const partial of [false, true]) contract(['DATA-002', 'IMPORT-004', 'BASE-OPS-002', 'BASE-ACCESS-004'], `prior ${partial ? 'partial chunked' : 'completed'} import custody requires a guarded additive erasure upgrade`, async () => {
  const f = await importPrivacyFixture()
  const input = { definition: JSON.stringify({ title: 'Existing import', fields: [{ ref: 'notes', title: 'Notes', type: 'long_text' }] }), plannedAt: '2026-10-08T00:00:00.000Z', csv: ['Notes,Submit Date', ...Array.from({ length: partial ? 27 : 3 }, (_, n) => `prior-private-${n}${partial ? 'x'.repeat(1800) : ''},2026-09-12 10:03:00`)].join('\n') }
  const review = await f.imports.review(input)
  const prepared = prepareImport(input, f.actor.workspaceId), context = importContext(env.DB, f.actor, prepared.namespace)
  const legacy = await planD1Import(prepared.source, prepared.mapping, context)
  expect(legacy.fingerprint).toBe(review.fingerprint)
  let job = await createD1ImportJob(legacy, { ...context, reviewedFingerprint: legacy.fingerprint, operationKey: prepared.namespace })
  job = await resumeD1Import(job.id, context)
  if (!partial) while (job.state !== 'completed') job = await f.imports.resume(job.id)
  expect(await env.DB.prepare('SELECT COUNT(*) n FROM ik_d1_streams').first()).toEqual({ n: 0 })
  const original = await env.DB.prepare('SELECT plan_json,fingerprint FROM ik_jobs WHERE id=?').bind(job.id).first()
  const victim = (await env.DB.prepare('SELECT r.id FROM responses r JOIN response_answers a ON a.response_id=r.id WHERE r.flow_id=? AND a.value_json LIKE ?').bind(review.flowId, '%prior-private-0%').first<{ id: string }>())!.id
  // Keep all prior native and importer rows and remove only the new schema.
  await env.DB.batch(['ik_d1_plan_index', 'ik_d1_indexed_jobs', 'ik_d1_erased_sources', 'ik_d1_erased_targets'].map(table => env.DB.prepare(`DROP TABLE ${table}`)))
  await env.DB.batch(d1ErasureSchema.map(sql => env.DB.prepare(sql)))
  const before = await allStoredData()
  await expect(f.services.responses.eraseReleasedResponse({ workspaceId: f.actor.workspaceId, operatorId: f.actor.operatorId, sessionId: f.actor.id, responseId: victim })).rejects.toThrow('IMPORT_ERASURE_INDEX_UPGRADE_REQUIRED')
  expect(await allStoredData()).toBe(before)
  await env.DB.prepare('UPDATE oa_sessions SET revoked_at=? WHERE id=?').bind(Date.now(), f.actor.id).run()
  await expect(f.imports.upgradeErasureIndex()).rejects.toThrow()
  expect(await env.DB.prepare('SELECT COUNT(*) n FROM ik_d1_indexed_jobs').first()).toEqual({ n: 0 })
  await env.DB.prepare('UPDATE oa_sessions SET revoked_at=NULL WHERE id=?').bind(f.actor.id).run()
  expect(await f.imports.upgradeErasureIndex()).toEqual({ indexed: 1, complete: true })
  expect(await env.DB.prepare('SELECT plan_json,fingerprint FROM ik_jobs WHERE id=?').bind(job.id).first()).toEqual(original)
  expect(await f.imports.upgradeErasureIndex()).toEqual({ indexed: 0, complete: true })
  expect((await f.erase(victim)).status).toBe(204)
  expect(await allStoredData()).not.toContain('prior-private-0')
  while (job.state !== 'completed') job = await f.imports.resume(job.id)
  expect((await f.imports.commit(input, (await f.imports.review(input)).fingerprint, true)).id).toBe(job.id)
  expect(await allStoredData()).not.toContain('prior-private-0')
  expect(await allStoredData()).toContain('prior-private-1')
}, 90_000)
