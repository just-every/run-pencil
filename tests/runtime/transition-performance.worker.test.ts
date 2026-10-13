import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect, it } from 'vitest'
import { foundationFixture } from './foundation-fixture'
import { predecessorAdvance } from './transition-predecessor'

declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(() => applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__))

async function fixture(slug: string) {
  const f = await foundationFixture(slug)
  await f.add({ kind: 'welcome', questionType: null, prompt: 'Welcome' })
  await f.add({ kind: 'question', questionType: 'short_text', prompt: 'First' })
  await f.add({ kind: 'question', questionType: 'short_text', prompt: 'Second' })
  await f.add({ kind: 'completion', questionType: null, prompt: 'Complete' })
  await f.publish()
  return f
}

// A diagnostic alongside the unchanged SELF load gate: each implementation gets
// two unrelated flows, twelve sessions and the same new/repeat/backtrack visits.
// The predecessor executes its real D1 batch; no binding or data is simulated.
it('measures both storage protocols on distinct visits, repeats and backtracking', async () => {
  const measurements = []
  for (const protocol of ['predecessor', 'atomic'] as const) {
    const flows = [await fixture(`progress-measured-${protocol}-a`), await fixture(`progress-measured-${protocol}-b`)]
    const cases = (await Promise.all(flows.map(async f => (await Promise.all(Array.from({ length: 6 }, () => f.start()))).map(session => ({ f, session }))))).flat()
    const times: number[] = []
    const phases = []
    for (const stepIndex of [1, 1, 2, 0]) {
      const samples = await Promise.all(cases.map(async ({ f, session }) => {
        const input = { slug: f.slug, ...session, stepId: session.flow.steps[stepIndex].id }
        const start = performance.now()
        let admitted = true
        if (protocol === 'predecessor') {
          const results = await predecessorAdvance(env.DB, input)
          admitted = results[0].meta.changes === 1
        } else {
          await f.services.responses.advancePublicSession(input)
        }
        const milliseconds = performance.now() - start
        expect(admitted).toBe(true)
        return milliseconds
      }))
      times.push(...samples)
      phases.push({ stepIndex, milliseconds: samples })
    }
    for (const f of flows) {
      const revisionId = cases.find(candidate => candidate.f === f)!.session.revisionId
      expect((await env.DB.prepare('SELECT reached FROM revision_step_metric_counters WHERE revision_id = ?').bind(revisionId).all()).results.map(row => row.reached)).toEqual([6, 6, 6])
      expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM respondent_session_step_events WHERE revision_id = ?').bind(revisionId).first()).toEqual({ count: 18 })
    }
    const sorted = [...times].sort((a, b) => a - b)
    measurements.push({ protocol, flows: 2, sessions: 12, visits: times.length, concurrency: 12,
      p95Milliseconds: sorted[Math.ceil(sorted.length * .95) - 1], totalMilliseconds: times.reduce((sum, value) => sum + value, 0), phases })
  }
  console.info(`PENCIL_MIXED_PROGRESS_PROFILE ${JSON.stringify({ diagnosticOnly: true, environment: 'Worker with native D1', measurements })}`)
})
