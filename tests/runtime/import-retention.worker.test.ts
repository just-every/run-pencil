import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { importPrivacyFixture, allStoredData } from './import-privacy-fixture'
import { FormImports } from '../../src/core/features/importing/service'
import { loadPlans } from '../../src/base/import-kit/src/d1/plans'
import { importTargets } from '../../src/core/features/importing/native'

declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(() => applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__))

for (const length of [255, 256, 257]) contract(['IMPORT-001', 'IMPORT-002', 'IMPORT-003', 'IMPORT-004', 'DATA-002'], `complete custody and reversal retain mixed ${length}-unit consent without multiplying retained dictionaries`, async () => {
  const f = await importPrivacyFixture(), count = 100, width = 49
  const inertTables = ['respondent_sessions', 'response_outbox', 'revision_metric_counters', 'notification_deliveries', 'notification_attempts', 'mail_deliveries', 'local_mail_outbox']
  const inertBefore = new Map<string, unknown>()
  for (const table of inertTables) inertBefore.set(table, await env.DB.prepare(`SELECT COUNT(*) n FROM ${table}`).first())
  const statements = Array.from({ length: width }, (_, q) => {
    let seed = q + 1
    return Array.from({ length }, () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return String.fromCharCode(0x4e00 + seed % 20000) }).join('')
  })
  const input = { definition: JSON.stringify({ title: 'Immutable statements', fields: statements.map((title, q) => ({ ref: `q${q}`, title, type: 'legal' })) }), plannedAt: '2026-10-08T00:00:00.000Z', csv: [Array.from({ length: width }, (_, q) => `q${q}`).join(',') + ',Submit Date,Skipped,IP', ...Array.from({ length: count }, (_, row) => Array.from({ length: width }, (_, q) => (row + q) % 2).join(',') + ',2026-09-12 10:00:00,excluded-private-marker,198.51.100.1')].join('\n') }
  const review = await f.imports.review(input)
  expect(review.rowErrors).toEqual([])
  expect(review.responseCount).toBe(count)
  expect(await env.DB.prepare('SELECT COUNT(*) n FROM ik_jobs WHERE destination=?').bind(f.actor.workspaceId).first()).toEqual({ n: 0 })
  await expect(f.imports.commit(input, review.fingerprint, false)).rejects.toThrow('Acknowledge')
  expect(await env.DB.prepare('SELECT COUNT(*) n FROM ik_jobs WHERE destination=?').bind(f.actor.workspaceId).first()).toEqual({ n: 0 })
  let job = await f.imports.commit(input, review.fingerprint, true)
  expect(job.state).toBe('preparing')
  expect(job.checkpoint).toBe(0)
  job = await new FormImports(env.DB, f.actor).resume(job.id)
  const retained = await env.DB.prepare('SELECT (SELECT coalesce(sum(length(CAST(plan_json AS BLOB))),0) FROM ik_jobs WHERE destination=?) + (SELECT coalesce(sum(length(CAST(c.body AS BLOB))),0) FROM ik_d1_plan_chunks c JOIN ik_jobs j ON j.id=c.job_id WHERE j.destination=?) bytes').bind(f.actor.workspaceId, f.actor.workspaceId).first<{ bytes: number }>()
  console.info({ normalizedCustody: { responses: count, questions: width, statementLength: length, retainedBytes: retained!.bytes } })
  expect(retained!.bytes).toBeLessThan(512 * 1024)
  let responses = 0
  for (const page of (await env.DB.prepare('SELECT id,plan_json FROM ik_jobs WHERE destination=? ORDER BY id').bind(f.actor.workspaceId).all<{ id: string; plan_json: string }>()).results) {
    const plan = (await loadPlans([page], env.DB, importTargets.planCodec)).get(page.id)!
    for (const entry of plan.entries.filter(entry => entry.source.kind === 'response')) {
      const source = entry.source.payload as any
      for (const [q, statement] of statements.entries()) expect(source.answers[review.questions[q].id]).toEqual({ accepted: (source.row - 2 + q) % 2 === 1, statement })
      responses++
    }
  }
  expect(responses).toBe(count)
  while (job.state !== 'completed') job = await new FormImports(env.DB, f.actor).resume(job.id)
  expect(await env.DB.prepare('SELECT COUNT(*) n FROM responses WHERE flow_id=?').bind(review.flowId).first()).toEqual({ n: count })
  expect(await env.DB.prepare('SELECT COUNT(*) n FROM response_answers a JOIN responses r ON r.id=a.response_id WHERE r.flow_id=?').bind(review.flowId).first()).toEqual({ n: count * width })
  for (const table of inertTables) expect(await env.DB.prepare(`SELECT COUNT(*) n FROM ${table}`).first(), table).toEqual(inertBefore.get(table))
  const last = (await env.DB.prepare('SELECT id FROM responses WHERE flow_id=? ORDER BY id LIMIT 1').bind(review.flowId).first<{ id: string }>())!.id
  await f.services.responses.eraseReleasedResponse({ workspaceId: f.actor.workspaceId, operatorId: f.actor.operatorId, sessionId: f.actor.id, responseId: last })
  expect(await env.DB.prepare('SELECT id FROM responses WHERE id=?').bind(last).first()).toBeNull()
  expect((await f.imports.commit(input, review.fingerprint, true)).id).toBe(job.id)
  job = await f.imports.undo(job.id)
  while (job.state !== 'undone') job = await new FormImports(env.DB, f.actor).resume(job.id)
  expect((await f.imports.undo(job.id)).state).toBe('undone')
  expect(await env.DB.prepare('SELECT id FROM flows WHERE id=?').bind(review.flowId).first()).toBeNull()
  expect((await f.imports.commit(input, review.fingerprint, true)).id).toBe(job.id)
  expect(await env.DB.prepare('SELECT id FROM responses WHERE id=?').bind(last).first()).toBeNull()
  expect(await allStoredData()).not.toMatch(/excluded-private-marker|198\.51\.100\.1/)
}, 180_000)
