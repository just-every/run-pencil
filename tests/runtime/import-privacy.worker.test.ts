import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { importPrivacyFixture, allStoredData } from './import-privacy-fixture'
import { readD1PersistedImport } from '../../src/base/import-kit/src/d1/index'
import { importContext } from '../../src/core/features/importing/service'
import { prepareImport } from '../../src/core/features/importing/prepare'
declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(() => applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__))

const definition = JSON.stringify({ title: 'Privacy import', fields: [{ ref: 'email', type: 'email', title: 'Email' }, { ref: 'notes', type: 'long_text', title: 'Notes' }] })
const makeInput = (large: boolean) => ({ definition, plannedAt: '2026-10-08T00:00:00.000Z', csv: ['Email,Notes,Submit Date', ...Array.from({ length: large ? 27 : 3 }, (_, i) => `personal-${i}@example.test,${i === 0 ? 'erasure-private-answer' : 'retained-answer-' + i}${large ? 'x'.repeat(1800) : ''},2026-09-12 10:03:00`)].join('\n') })

for (const partial of [false, true]) contract(['DATA-002', 'BASE-DATA-003', 'IMPORT-003', 'IMPORT-004'], `HTTP erasure reconciles ${partial ? 'partial chunked' : 'completed'} import custody with safe resume, repeat and undo`, async () => {
  const f = await importPrivacyFixture(), input = makeInput(partial)
  const review = await f.imports.review(input)
  expect(review.rowErrors).toEqual([])
  let job = await f.imports.commit(input, review.fingerprint, true)
  expect(job.state).toBe('preparing')
  expect(job.checkpoint).toBe(0)
  job = await f.imports.resume(job.id)
  if (!partial) while (job.state !== 'completed') job = await f.imports.resume(job.id)
  expect(job.state).toBe(partial ? 'applying' : 'completed')
  if (partial) expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM ik_d1_plan_chunks WHERE job_id=?').bind(job.id).first<{ n: number }>())!.n).toBeGreaterThan(0)
  const victim = (await env.DB.prepare("SELECT r.id FROM responses r JOIN response_answers a ON a.response_id=r.id WHERE r.flow_id=? AND a.value_json=?").bind(review.flowId, JSON.stringify('personal-0@example.test')).first<{ id: string }>())!.id
  const before = await allStoredData()
  expect(before).toContain('personal-0@example.test')
  await expect(f.services.responses.eraseReleasedResponse({ workspaceId: f.actor.workspaceId, operatorId: f.actor.operatorId, responseId: victim })).rejects.toThrow('current operator session')
  expect(await allStoredData()).toBe(before)
  expect((await f.erase(victim)).status).toBe(204)
  expect(await allStoredData()).not.toMatch(/personal-0@example\.test|erasure-private-answer/)
  expect(await env.DB.prepare('SELECT target_id FROM form_import_targets WHERE target_id=?').bind(victim).first()).toBeNull()
  while (job.state !== 'completed') job = await f.imports.resume(job.id)
  const rows = partial ? 26 : 2
  expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM responses WHERE flow_id=?').bind(review.flowId).first()).toEqual({ n: rows })
  expect((await readD1PersistedImport(importContext(env.DB, f.actor, prepareImport(input, f.actor.workspaceId).namespace))).provenance).toHaveLength(rows + 1)
  const repeated = await f.imports.review(input)
  expect((await f.imports.commit(input, repeated.fingerprint, true)).id).toBe(job.id)
  expect((await f.imports.resume(job.id)).state).toBe('completed')
  expect(await allStoredData()).not.toMatch(/personal-0@example\.test|erasure-private-answer/)
  expect(await allStoredData()).toContain('personal-1@example.test')
  let undone = await f.imports.undo(job.id)
  while (undone.state !== 'undone') undone = await f.imports.resume(job.id)
  expect((await f.imports.undo(job.id)).state).toBe('undone')
  expect((await f.imports.commit(input, (await f.imports.review(input)).fingerprint, true)).id).toBe(job.id)
  expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM responses WHERE flow_id=?').bind(review.flowId).first()).toEqual({ n: 0 })
  expect(await allStoredData()).not.toMatch(/personal-0@example\.test|erasure-private-answer/)
}, 90_000)

contract(['DATA-002', 'IMPORT-004', 'BASE-ACCESS-004'], 'erasure respects fresh session authority and preserves unrelated later edits during undo', async () => {
  const f = await importPrivacyFixture(), input = makeInput(false), review = await f.imports.review(input)
  let job = await f.imports.commit(input, review.fingerprint, true)
  while (job.state !== 'completed') job = await f.imports.resume(job.id)
  const rows = (await env.DB.prepare('SELECT id FROM responses WHERE flow_id=? ORDER BY id').bind(review.flowId).all<{ id: string }>()).results
  await env.DB.prepare('UPDATE oa_sessions SET revoked_at=? WHERE id=?').bind(Date.now(), f.actor.id).run()
  const before = await allStoredData()
  expect((await f.erase(rows[0].id)).status).toBe(401)
  expect(await allStoredData()).toBe(before)
  await env.DB.prepare('UPDATE oa_sessions SET revoked_at=NULL WHERE id=?').bind(f.actor.id).run()
  await env.DB.prepare("UPDATE flow_steps SET prompt='Preserve this later edit' WHERE revision_id=(SELECT id FROM flow_revisions WHERE flow_id=? AND state='draft') AND question_type='email'").bind(review.flowId).run()
  expect((await f.erase(rows[0].id)).status).toBe(204)
  await expect(f.imports.undo(job.id)).rejects.toThrow('NATIVE_EDIT_CONFLICT')
  expect(await env.DB.prepare("SELECT prompt FROM flow_steps WHERE revision_id=(SELECT id FROM flow_revisions WHERE flow_id=? AND state='draft') AND question_type='email'").bind(review.flowId).first()).toEqual({ prompt: 'Preserve this later edit' })
})
