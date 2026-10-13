import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, beforeEach, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { ai, analysisHttp, answer, recommend, theme } from './analysis-fixture'
declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(() => applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__))
beforeEach(() => ai.reset())

const stored = async (runId: string) => Object.fromEntries(await Promise.all(['analysis_themes', 'analysis_theme_members', 'analysis_quotes', 'analysis_recommendations'].map(async table => [table, (await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE run_id = ?`).bind(runId).first<{ n: number }>())!.n])))

async function nineResponses() {
  const f = await analysisHttp(), queue: string[] = [], prices: string[] = []
  for (let i = 0; i < 5; i++) queue.push(await f.respond(`The queue at lunch was far too long, visit ${i}.`))
  for (let i = 0; i < 4; i++) prices.push(await f.respond(`Coffee prices went up again, visit ${i}.`))
  return { f, queue, prices }
}

contract(['ANLY-003', 'ANLY-004', 'ANLY-005', 'ANLY-011', 'ANLY-012'], 'findings rank themes by recomputed support, quote exact stored excerpts, link every figure to its responses and withhold a theme below the disclosure threshold', async () => {
  const { f, queue, prices } = await nineResponses()
  const excerpt = { responseId: queue[2], questionId: f.questions.improve, start: 4, end: 9, text: 'queue' }
  // The provider lists the smaller theme first; Pencil ranks by the responses each theme cites.
  await ai.script(answer({ outcome: 'findings', reason: '', themes: [theme('Prices', prices, [{ responseId: prices[0], questionId: f.questions.improve, start: 0, end: 6, text: 'Coffee' }]), theme('Lunch queue', queue, [excerpt])], recommendations: [recommend('Raise prices again', [0]), recommend('Open a second till at lunch', [1])] }))
  const run = await f.request()
  expect(run.state).toBe('completed')
  const [first, second] = run.themes
  expect(first).toMatchObject({ rank: 1, withheld: false, primary: true, title: 'Lunch queue', count: 5, percentage: 55.6, quotes: [expect.objectContaining({ responseId: queue[2], excerpt: 'queue', questionPrompt: 'What could we improve?' })] })
  expect(new Set(first.responseIds)).toEqual(new Set(queue))
  // ANLY-005: four responses are below the threshold of five; nothing of that theme is shown or reachable.
  expect(second).toEqual({ id: second.id, rank: 2, withheld: true, primary: false })
  expect(JSON.stringify(run)).not.toMatch(/Prices|Coffee prices/)
  expect((await f.call(`/api/app/analysis/${run.id}/themes/${second.id}/responses`)).status).toBe(404)
  // recommendation.selection.v1: the action supported by the highest-impact finding that may be shown.
  expect(run.recommendation).toMatchObject({ title: 'Open a second till at lunch', themes: [1], confidence: 'medium', expectedImpact: 'high', effort: 'low' })
  expect(new Set(run.recommendation.responseIds)).toEqual(new Set(queue))
  // ANLY-011: an excerpt's response is reachable with its retained answer.
  const behind = await (await f.call(`/api/app/analysis/${run.id}/themes/${first.id}/responses`)).json() as any
  expect(behind.responses.map((response: any) => response.id).sort()).toEqual([...queue].sort())
  expect(behind.responses.find((response: any) => response.id === queue[2]).answers[0].text.slice(4, 9)).toBe('queue')
  // The ledger and operator export are not suppressed.
  const ledger = await (await f.call(`/api/app/flows/${f.flowId}/ledger`)).json() as any
  expect(ledger.total).toBe(9)
  // ANLY-005: exactly the threshold shows.
  await f.call('/api/app/analysis/policies', { autorunEnabled: true, autorunMinimum: 5, disclosureThreshold: 4, selection: 'highest-impact' }, 'PUT')
  await ai.script(answer({ outcome: 'findings', reason: '', themes: [theme('Lunch queue', queue), theme('Prices', prices)], recommendations: [] }))
  const lower = await f.request()
  expect(lower.themes[1]).toMatchObject({ withheld: false, title: 'Prices', count: 4 })
})

contract(['ANLY-012'], 'a schema-invalid answer, an unknown response, a mismatched quote or a wrong count fails the run with nothing shown', async () => {
  const { f, queue } = await nineResponses()
  const outsider = (await analysisHttp()).flowId
  const cases: Array<[string, unknown]> = [
    ['schema_invalid', { outcome: 'findings', themes: 'not a list' }],
    ['schema_invalid', 'This is not JSON at all'],
    ['unknown_response', { outcome: 'findings', reason: '', themes: [theme('Lunch queue', [...queue.slice(0, 4), outsider])], recommendations: [] }],
    ['quote_mismatch', { outcome: 'findings', reason: '', themes: [theme('Lunch queue', queue, [{ responseId: queue[0], questionId: f.questions.improve, start: 4, end: 9, text: 'Queue' }])], recommendations: [] }],
    ['quote_mismatch', { outcome: 'findings', reason: '', themes: [theme('Lunch queue', queue, [{ responseId: queue[0], questionId: f.questions.name, start: 0, end: 3, text: 'The' }])], recommendations: [] }],
    ['count_mismatch', { outcome: 'findings', reason: '', themes: [{ ...theme('Lunch queue', queue), count: 6 }], recommendations: [] }],
  ]
  for (const [code, output] of cases) {
    await ai.script(answer(output))
    const run = await f.request()
    expect(run, code).toMatchObject({ state: 'failed', errorCode: code, themes: [], recommendation: null })
    expect(await stored(run.id)).toEqual({ analysis_themes: 0, analysis_theme_members: 0, analysis_quotes: 0, analysis_recommendations: 0 })
  }
})

contract(['ANLY-006'], 'a sufficient run proposes one primary action, and turning it into an action records the analysis without contacting anyone', async () => {
  const { f, queue } = await nineResponses()
  await ai.script(answer({ outcome: 'findings', reason: '', themes: [theme('Lunch queue', queue)], recommendations: [recommend('Open a second till at lunch', [0])] }))
  const run = await f.request()
  expect(run.recommendation).toMatchObject({ title: 'Open a second till at lunch', themes: [1] })
  const before = await env.DB.prepare("SELECT (SELECT COUNT(*) FROM local_mail_outbox) + (SELECT COUNT(*) FROM rer_mail_development_outbox) + (SELECT COUNT(*) FROM mail_deliveries) + (SELECT COUNT(*) FROM action_task_attempts) AS n").first()
  const created = await f.call('/api/app/actions', { title: run.recommendation.title, rationale: 'From the analysis of revision 1.', ownerOperatorId: f.operatorId, reviewDate: '2026-12-01', analysisId: run.id,
    metric: { name: 'Visitors mentioning the queue', unit: 'responses', direction: 'decrease', baselineValue: 5, baselineSource: 'Analysis of revision 1', baselineObservedAt: '2026-10-12T09:00:00.000Z' },
    evidence: { flowId: f.flowId, revisionId: f.revisionId } })
  expect(created.status, await created.clone().text()).toBe(201)
  const action = await created.json() as any
  expect(action).toMatchObject({ source: 'analysis', analysisId: run.id, state: 'planned', verdict: null })
  expect((await f.detail(run.id)).recommendation.actionIds).toEqual([action.id])
  expect(await env.DB.prepare("SELECT (SELECT COUNT(*) FROM local_mail_outbox) + (SELECT COUNT(*) FROM rer_mail_development_outbox) + (SELECT COUNT(*) FROM mail_deliveries) + (SELECT COUNT(*) FROM action_task_attempts) AS n").first()).toEqual(before)
  // An analysis id only stands for an analysis of the same revision that shows a recommendation.
  await ai.script(answer({ outcome: 'insufficient_evidence', reason: 'No common subject.', themes: [], recommendations: [] }))
  const none = await f.request()
  expect((await f.call('/api/app/actions', { title: 'Unsupported', rationale: 'None', ownerOperatorId: f.operatorId, reviewDate: '2026-12-01', analysisId: none.id,
    metric: { name: 'x', unit: 'y', direction: 'increase', baselineValue: 1, baselineSource: 'z', baselineObservedAt: '2026-10-12T09:00:00.000Z' }, evidence: { flowId: f.flowId, revisionId: f.revisionId } })).status).toBe(400)
})
