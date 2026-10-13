import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { FormImports } from '../../src/core/features/importing/service'
import { importPrivacyFixture } from './import-privacy-fixture'
import { importTransportObserver } from './import-transport-observer'

declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(() => applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__))

contract(['IMPORT-002', 'IMPORT-003', 'IMPORT-004'], 'large escaped answers stage bounded batches and cold-publish complete values before guarded undo', async () => {
  const f = await importPrivacyFixture(), meter = importTransportObserver(env.DB)
  const service = () => new FormImports(meter.database, f.actor)
  // Distinct low-compression values exercise the whole serialized wire body,
  // including escaping, rather than benefiting from one repeated dictionary.
  let seed = 93
  const text = () => Array.from({ length: 1600 }, () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return String.fromCharCode(32 + (seed >>> 16) % 95)
  }).join('')
  const answers = Array.from({ length: 301 }, () => Array.from({ length: 4 }, text))
  const input = {
    plannedAt: '2026-10-08T00:00:00.000Z',
    definition: JSON.stringify({ title: 'Bounded custody', fields: Array.from({ length: 4 }, (_, q) => ({ ref: `q${q}`, title: `Q${q}`, type: 'long_text' })) }),
    csv: 'q0,q1,q2,q3,Submit Date\n' + answers.map(row => row.map(value => `"${value.replaceAll('"', '""')}"`).join(',') + ',2026-09-12 10:00:00').join('\n'),
  }
  const review = await service().review(input)
  expect(review.rowErrors).toEqual([])
  meter.reset()
  let job = await service().commit(input, review.fingerprint, true)
  expect(job.state).toBe('preparing')
  expect(meter.stats.totalBatchBytes).toBeGreaterThan(2 * 1024 * 1024)
  expect(meter.stats.maxBatchBytes).toBeLessThanOrEqual(2 * 1024 * 1024)
  expect(meter.stats.queries).toBeLessThanOrEqual(1000)
  expect(await env.DB.prepare('SELECT id FROM flows WHERE id=?').bind(review.flowId).first()).toBeNull()
  while (job.state !== 'completed') {
    meter.reset()
    job = await service().resume(job.id)
    expect(meter.stats.maxBatchBytes).toBeLessThanOrEqual(2 * 1024 * 1024)
    expect(meter.stats.queries).toBeLessThanOrEqual(1000)
  }
  const stored = (await env.DB.prepare('SELECT value_json FROM response_answers a JOIN responses r ON r.id=a.response_id WHERE r.flow_id=?').bind(review.flowId).all<{ value_json: string }>()).results.map(row => JSON.parse(row.value_json)).sort()
  expect(stored).toEqual(answers.flat().sort())
  while (job.state !== 'undone') {
    meter.reset()
    job = await service().undo(job.id)
    expect(meter.stats.maxBatchBytes).toBeLessThanOrEqual(2 * 1024 * 1024)
    expect(meter.stats.queries).toBeLessThanOrEqual(1000)
  }
  expect(await env.DB.prepare('SELECT id FROM flows WHERE id=?').bind(review.flowId).first()).toBeNull()
}, 180_000)
