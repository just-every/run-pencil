import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, beforeEach, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { runScheduledMaintenance } from '../../src/core/app/maintenance'
import type { WorkerBindings } from '../../src/core/app/environment'
import { ai, aiBindings, analysisHttp, answer, recommend, theme } from './analysis-fixture'
declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(() => applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__))
beforeEach(() => ai.reset())

const evidenceOf = async (runId: string) => (await env.DB.prepare('SELECT response_id AS id FROM analysis_evidence WHERE run_id = ? ORDER BY position').bind(runId).all<{ id: string }>()).results.map(row => row.id)
const tick = (at: number, bindings: Partial<WorkerBindings> = aiBindings) => runScheduledMaintenance({ scheduledTime: at, cron: '* * * * *', noRetry() {} } as ScheduledController, { ...env, ...bindings, APP_ORIGIN: 'http://localhost' } as WorkerBindings)

contract(['ANLY-001', 'ANLY-002', 'ANLY-007', 'ANLY-015'], 'a requested run fixes the released responses it read and its policies, completes without a cron tick, and later evidence or policy only marks or changes new runs', async () => {
  const f = await analysisHttp()
  const released = []
  for (let i = 0; i < 5; i++) released.push(await f.respond(`The queue was slow on visit ${i}`))
  const held = await f.respond('A suspected answer', { quarantine: true })
  await ai.script(answer({ outcome: 'findings', reason: '', themes: [theme('Slow queue', released, [{ responseId: released[0], questionId: f.questions.improve, start: 4, end: 9, text: 'queue' }])], recommendations: [recommend('Add a second till', [0])] }))
  const run = await f.request()
  expect(run).toMatchObject({ state: 'completed', revisionId: f.revisionId, evidenceCount: 5, staleResponses: 0, policy: { disclosure: { policy: 'analysis.disclosure.v1', threshold: 5 }, selection: { policy: 'recommendation.selection.v1', rule: 'highest-impact' } } })
  expect(new Set(await evidenceOf(run.id))).toEqual(new Set(released))
  const [sent] = await ai.requests()
  expect(sent.body).not.toContain(held)
  for (const id of released) expect(sent.body).toContain(id)
  // ANLY-002 / ANLY-007: a response released later is outside the fixed set; the run stays readable and is marked stale.
  await f.respond('A later answer about parking')
  const later = await f.detail(run.id)
  expect(later.staleResponses).toBe(1)
  expect(later.themes).toEqual(run.themes)
  expect(new Set(await evidenceOf(run.id))).toEqual(new Set(released))
  // ANLY-015: a later policy applies only to a new run; the old run keeps its snapshot and presentation.
  expect((await f.call('/api/app/analysis/policies', { autorunEnabled: true, autorunMinimum: 5, disclosureThreshold: 7, selection: 'highest-impact' }, 'PUT')).status).toBe(200)
  const kept = await f.detail(run.id)
  expect(kept.policy.disclosure.threshold).toBe(5)
  expect(kept.themes[0]).toMatchObject({ withheld: false, count: 5 })
  const next = await f.request()
  expect(next.policy.disclosure.threshold).toBe(7)
  expect(next.state).toBe('insufficient_evidence')
  expect((await f.call('/api/app/analysis')).status).toBe(200)
})

contract(['ANLY-013'], 'too little evidence completes as insufficient-evidence with its cutoff and reason, sends nothing and emits no theme, quote or recommendation', async () => {
  const f = await analysisHttp()
  for (let i = 0; i < 4; i++) await f.respond(`Answer ${i}`)
  const small = await f.request()
  expect(small).toMatchObject({ state: 'insufficient_evidence', evidenceCount: 4, themes: [], recommendation: null })
  expect(small.insufficientReason).toMatch(/4/)
  expect(small.evidenceCutoff).toMatch(/^\d{4}-/)
  expect(await ai.requests()).toEqual([])
  // The provider may also find the evidence insufficient; nothing is stored but the reason.
  await f.respond('Answer 5')
  await ai.script(answer({ outcome: 'insufficient_evidence', reason: 'The answers do not share a subject.', themes: [], recommendations: [] }))
  const judged = await f.request()
  expect(judged).toMatchObject({ state: 'insufficient_evidence', themes: [], recommendation: null })
  for (const table of ['analysis_themes', 'analysis_quotes', 'analysis_recommendations']) expect(await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE run_id = ?`).bind(judged.id).first()).toEqual({ n: 0 })
})

contract(['ANLY-001'], 'analysis.autorun.v1 analyses a revision once when its flow closes with at least five completed responses, only while a provider is configured', async () => {
  const f = await analysisHttp()
  const released = []
  for (let i = 0; i < 5; i++) released.push(await f.respond(`Closing answer ${i}`))
  expect((await f.call(`/api/app/flows/${f.flowId}/close`, undefined, 'POST')).status).toBeLessThan(300)
  const autorun = () => env.DB.prepare("SELECT id, state FROM analysis_runs WHERE revision_id = ? AND trigger = 'autorun'").bind(f.revisionId).all<{ id: string; state: string }>().then(result => result.results)
  await tick(Date.now(), { AI_ENABLED: 'false' })
  expect(await autorun()).toEqual([])
  expect(await ai.requests()).toEqual([])
  await ai.script(answer({ outcome: 'findings', reason: '', themes: [theme('Closing feedback', released)], recommendations: [] }))
  await tick(Date.now())
  expect(await autorun()).toEqual([expect.objectContaining({ state: 'completed' })])
  await tick(Date.now() + 60_000)
  expect(await autorun()).toHaveLength(1)
  expect(await ai.requests()).toHaveLength(1)
})
