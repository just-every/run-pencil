import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect, test } from 'vitest'
import { importPrivacyFixture } from '../runtime/import-privacy-fixture'
import { FormImports } from '../../src/core/features/importing/service'
import { loadPlans } from '../../src/base/import-kit/src/d1/plans'
import { importTargets } from '../../src/core/features/importing/native'

declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(() => applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__))
const plannedAt = '2026-10-08T00:00:00.000Z'

test('one million distinct admitted answers retain complete cold-start custody without a global answer dictionary', async () => {
  const f = await importPrivacyFixture(), count = 100_000, width = 10
  const input = { plannedAt, definition: JSON.stringify({ title: 'Distinct response capacity', fields: Array.from({ length: width }, (_, q) => ({ ref: `q${q}`, title: `Q${q}`, type: 'short_text' })) }), csv: Array.from({ length: width }, (_, q) => `Q${q}`).join(',') + ',Submit Date\n' + Array.from({ length: count }, (_, row) => Array.from({ length: width }, (_, q) => (row * width + q).toString(36).padStart(5, '0')).join(',') + ',2026-09-12 10:00:00').join('\n') }
  expect(new TextEncoder().encode(input.definition + input.csv).byteLength).toBeLessThan(8 * 1024 * 1024)
  const review = await f.imports.review(input)
  expect(review.responseCount).toBe(count)
  expect(review.rowErrors).toEqual([])
  let job = await f.imports.commit(input, review.fingerprint, true)
  expect(job.total).toBe(count + 1)
  job = await new FormImports(env.DB, f.actor).resume(job.id)
  expect(job.checkpoint).toBeGreaterThan(1)
  const last = await env.DB.prepare('SELECT j.id,j.plan_json FROM ik_jobs j JOIN ik_d1_stream_pages p ON p.job_id=j.id WHERE p.stream_id=? ORDER BY p.ordinal DESC LIMIT 1').bind(job.id).first<{ id: string; plan_json: string }>()
  const plan = (await loadPlans([last!], env.DB, importTargets.planCodec)).get(last!.id)!
  const answers = (plan.entries.at(-1)!.source.payload as any).answers
  expect(Object.values(answers).sort()).toEqual(Array.from({ length: width }, (_, q) => ((count - 1) * width + q).toString(36).padStart(5, '0')).sort())
  expect(await env.DB.prepare('SELECT COUNT(*) n FROM ik_jobs j LEFT JOIN ik_d1_indexed_jobs i ON i.job_id=j.id AND i.fingerprint=j.fingerprint WHERE j.destination=? AND i.job_id IS NULL').bind(f.actor.workspaceId).first()).toEqual({ n: 0 })
}, 900_000)

test('repeated full-size consent statements remain immutable through complete native import and undo', async () => {
  const f = await importPrivacyFixture(), count = 1000, width = 49
  const statements = Array.from({ length: width }, (_, q) => { let seed = Math.imul(q + 1, 2654435761); return Array.from({ length: 1000 }, () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return String.fromCharCode(0x4e00 + seed % 20000) }).join('') })
  const input = { plannedAt, definition: JSON.stringify({ title: 'Immutable consent', fields: statements.map((title, q) => ({ ref: `q${q}`, title, type: 'legal' })) }), csv: Array.from({ length: width }, (_, q) => `q${q}`).join(',') + ',Submit Date\n' + Array.from({ length: count }, () => Array(width).fill('1').join(',') + ',2026-09-12 10:00:00').join('\n') }
  const review = await f.imports.review(input)
  expect(review.rowErrors).toEqual([])
  expect(review.responseCount).toBe(count)
  let job = await f.imports.commit(input, review.fingerprint, true)
  while (job.state !== 'completed') job = await new FormImports(env.DB, f.actor).resume(job.id)
  expect(await env.DB.prepare('SELECT COUNT(*) n FROM response_answers a JOIN responses r ON r.id=a.response_id WHERE r.flow_id=?').bind(review.flowId).first()).toEqual({ n: count * width })
  const last = await env.DB.prepare('SELECT j.id,j.plan_json FROM ik_jobs j JOIN ik_d1_stream_pages p ON p.job_id=j.id WHERE p.stream_id=? ORDER BY p.ordinal DESC LIMIT 1').bind(job.id).first<{ id: string; plan_json: string }>()
  const plan = (await loadPlans([last!], env.DB, importTargets.planCodec)).get(last!.id)!
  const finalResponse = plan.entries.at(-1)!.effects[0].targetId
  const first = await env.DB.prepare('SELECT id,value_json FROM response_answers WHERE response_id=? LIMIT 1').bind(finalResponse).first<{ id: string; value_json: string }>()
  const value = JSON.parse(first!.value_json)
  expect(value.accepted).toBe(true)
  expect(statements).toContain(value.statement)
  await env.DB.prepare("UPDATE response_answers SET value_json='false' WHERE id=?").bind(first!.id).run()
  await expect(f.imports.undo(job.id)).rejects.toThrow('NATIVE_EDIT_CONFLICT')
  expect((await env.DB.prepare('SELECT value_json FROM response_answers WHERE id=?').bind(first!.id).first<{ value_json: string }>())!.value_json).toBe('false')
  await env.DB.prepare('UPDATE response_answers SET value_json=? WHERE id=?').bind(first!.value_json, first!.id).run()
  job = await f.imports.undo(job.id)
  while (job.state !== 'undone') job = await new FormImports(env.DB, f.actor).undo(job.id)
  expect(await env.DB.prepare('SELECT id FROM flows WHERE id=?').bind(review.flowId).first()).toBeNull()
}, 900_000)
