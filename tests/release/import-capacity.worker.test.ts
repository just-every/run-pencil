import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect, test } from 'vitest'
import { importPrivacyFixture } from '../runtime/import-privacy-fixture'
import { FormImports } from '../../src/core/features/importing/service'
import { prepareImport } from '../../src/core/features/importing/prepare'
import { importTargets } from '../../src/core/features/importing/native'
declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(() => applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__))

test('accepted large choice forms publish and undo atomically with byte-bounded exact native guards', async () => {
  const f = await importPrivacyFixture()
  const fields = Array.from({ length: 49 }, (_, q) => ({ ref: `question-${q}`, title: `Question ${q}`, type: 'dropdown', properties: { choices: Array.from({ length: 100 }, (_, c) => ({ ref: `choice-${q}-${c}`, label: `${q}:${c}:` + 'distinct option '.repeat(18) })) } }))
  const input = { definition: JSON.stringify({ title: 'Large choice form', fields }), csv: '', plannedAt: '2026-10-08T00:00:00.000Z' }
  const prepared = prepareImport(input, f.actor.workspaceId), form = [...prepared.effects.values()][0]
  expect(prepared.rowErrors).toEqual([])
  expect(JSON.stringify(form.value).length).toBeGreaterThan(2_000_000)
  for (const statement of importTargets.write({ destination: f.actor.workspaceId, targetKind: form.targetKind, targetId: form.targetId, revision: 'review', value: form.value })) for (const value of statement.params ?? []) if (typeof value === 'string') expect(new TextEncoder().encode(value).byteLength).toBeLessThan(1_900_000)
  const review = await f.imports.review(input)
  let job = await f.imports.commit(input, review.fingerprint, true)
  while (job.state !== 'completed') job = await new FormImports(env.DB, f.actor).resume(job.id)
  expect(await env.DB.prepare('SELECT COUNT(*) n FROM choice_options WHERE step_id IN (SELECT s.id FROM flow_steps s JOIN flow_revisions r ON r.id=s.revision_id WHERE r.flow_id=?)').bind(review.flowId).first()).toEqual({ n: 9800 })
  const choice = (await env.DB.prepare('SELECT c.id,c.label FROM choice_options c JOIN flow_steps s ON s.id=c.step_id JOIN flow_revisions r ON r.id=s.revision_id WHERE r.flow_id=? LIMIT 1').bind(review.flowId).first<{ id: string; label: string }>())!
  await env.DB.prepare("UPDATE choice_options SET label='Edited choice' WHERE id=?").bind(choice.id).run()
  await expect(f.imports.undo(job.id)).rejects.toThrow('NATIVE_EDIT_CONFLICT')
  expect(await env.DB.prepare('SELECT label FROM choice_options WHERE id=?').bind(choice.id).first()).toEqual({ label: 'Edited choice' })
  await env.DB.prepare('UPDATE choice_options SET label=? WHERE id=?').bind(choice.label, choice.id).run()
  job = await f.imports.undo(job.id)
  while (job.state !== 'undone') job = await new FormImports(env.DB, f.actor).undo(job.id)
  expect(await env.DB.prepare('SELECT id FROM flows WHERE id=?').bind(review.flowId).first()).toBeNull()
}, 180_000)

for (const width of [1, 31]) test(`the declared response limit with ${width} answers prepares and persists bounded pages and resumes erased custody without uploaded files`, async () => {
  const f = await importPrivacyFixture(), count = 100_000
  const input = { definition: JSON.stringify({ title: 'Response capacity', fields: width === 1 ? [{ ref: 'answer', title: 'Answer', type: 'short_text' }] : Array.from({ length: width }, (_, q) => ({ ref: `answer-${q}`, title: `Answer ${q}`, type: 'short_text' })) }), plannedAt: '2026-10-08T00:00:00.000Z', csv: (width === 1 ? 'Answer,Submit Date\n' : Array.from({ length: width }, (_, q) => `Answer ${q}`).join(',') + ',Submit Date\n') + Array.from({ length: count }, (_, i) => (width === 1 ? [`response-${i}`] : Array(width).fill('x')).join(',') + ',2026-09-12 10:03:00').join('\n') }
  const review = await f.imports.review(input)
  expect(review.responseCount).toBe(count)
  expect(review.rowErrors).toEqual([])
  let job = await f.imports.commit(input, review.fingerprint, true)
  expect(job.total).toBe(count + 1)
  expect(job.state).toBe('preparing')
  expect(job.checkpoint).toBe(0)
  job = await new FormImports(env.DB, f.actor).resume(job.id)
  expect(job.checkpoint).toBeGreaterThan(1)
  const pages = (await env.DB.prepare('SELECT COUNT(*) n FROM ik_d1_stream_pages WHERE stream_id=?').bind(job.id).first<{ n: number }>())!.n
  if (width === 1) expect(await env.DB.prepare('SELECT COUNT(*) n FROM ik_d1_stream_pages WHERE stream_id=?').bind(job.id).first()).toEqual({ n: 1001 })
  else expect(pages).toBeGreaterThan(1001)
  const victim = (await env.DB.prepare('SELECT r.id FROM responses r JOIN response_answers a ON a.response_id=r.id WHERE r.flow_id=? AND a.value_json=?').bind(review.flowId, JSON.stringify(width === 1 ? 'response-0' : 'x')).first<{ id: string }>())!.id
  expect((await f.erase(victim)).status).toBe(204)
  job = await new FormImports(env.DB, f.actor).resume(job.id)
  expect(job.erasedRecords).toBe(1)
  expect(await env.DB.prepare('SELECT id FROM responses WHERE id=?').bind(victim).first()).toBeNull()
  expect((await f.imports.commit(input, review.fingerprint, true)).id).toBe(job.id)
  expect(await env.DB.prepare('SELECT COUNT(*) n FROM ik_jobs j LEFT JOIN ik_d1_indexed_jobs x ON x.job_id=j.id AND x.fingerprint=j.fingerprint WHERE j.destination=? AND x.job_id IS NULL').bind(f.actor.workspaceId).first()).toEqual({ n: 0 })
}, 900_000)
