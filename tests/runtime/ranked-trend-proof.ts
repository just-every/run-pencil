import { expect } from 'vitest'
import type { BuilderDraft } from '../../src/core/app/api'
import type { TrendReport } from '../../src/core/features/reporting'
import type { CollectorService } from '../../src/core/features/collectors'
import type { ScenarioCall } from '../results-scenario'
import { csvRows } from '../e2e/export-helpers'
import { matureLoad } from './load-time-fixture'

type Collector = Awaited<ReturnType<CollectorService['create']>>
type Request = (path: string, data?: unknown, method?: string) => Promise<Response>
type Session = { sessionId: string; sessionToken: string; loadTime: string; revisionId: string }

/** Complete rankings use the same first-choice meaning as the answer summary. */
export async function proveRankedTrends(call: ScenarioCall, request: Request, db: D1Database) {
  const slug = 'synthetic-pencil-ranked-trends'
  const flow = await call<{ id: string }>('/api/app/flows', { title: 'Service priorities', slug })
  const root = `/api/app/flows/${flow.id}`
  const draft = () => call<BuilderDraft>(root + '/draft')
  let current = await draft()
  await call(root + '/draft/steps', { expectedVersion: current.flow.draftVersion, step: {
    kind: 'question', questionType: 'priority', required: false, prompt: 'Rank service priorities',
    choices: [{ value: 'speed', label: 'Speed' }, { value: 'care', label: 'Care' }, { value: 'price', label: 'Price' }],
  } })
  current = await draft()
  const stepId = current.steps[0].id
  const options = current.choices.filter(choice => choice.stepId === stepId)
  const ids = options.map(choice => choice.id)
  await call(root + '/draft/steps', { expectedVersion: current.flow.draftVersion, step: { kind: 'completion', questionType: null, prompt: 'Thank you.' } })
  current = await draft()
  const first = await call<{ revision: { id: string } }>(root + '/publish', { expectedVersion: current.flow.draftVersion })
  const mail = await call<Collector>(root + '/collectors', { name: 'Customer mailing', channel: 'email' })
  const web = await call<Collector>(root + '/collectors', { name: 'Service page', channel: 'web' })
  const collect = async (month: number, order: number[] | null, collector: Collector) => {
    const session = await call<Session>(`/api/public/flows/${slug}/sessions`, { deviceClass: 'desktop', source: 'direct', collectorKey: collector.publicKey })
    await matureLoad(session)
    const submission = {
      ...session, idempotencyKey: 'ranking-' + session.sessionId,
      answers: order === null ? [] : [{ stepId, value: order.map(index => ids[index]) }],
    }
    const receipt = await call<{ responseId: string; disposition: string }>(`/api/public/flows/${slug}/responses`, submission)
    expect(receipt.disposition).toBe('released')
    const instant = `2026-${String(month).padStart(2, '0')}-06T16:00:00.000Z`
    await db.prepare('UPDATE responses SET started_at=?,completed_at=?,released_at=?,created_at=?,updated_at=? WHERE id=?')
      .bind(instant, instant, instant, instant, instant, receipt.responseId).run()
    return { id: receipt.responseId, submission }
  }
  // Fixed independently: July 2 of 3, August 1 of 2, September 0 of 1.
  const retained = await collect(7, [0, 1, 2], mail)
  await collect(7, [1, 0, 2], mail)
  await collect(7, [0, 2, 1], web)
  await collect(7, null, web)
  current = await draft()
  await call(root + '/draft', { expectedVersion: current.flow.draftVersion, stepId, prompt: 'Rank updated service priorities', required: false }, 'PUT')
  current = await draft()
  const second = await call<{ revision: { id: string } }>(root + '/publish', { expectedVersion: current.flow.draftVersion })
  await collect(8, [0, 1, 2], mail)
  await collect(8, [2, 0, 1], web)
  await collect(8, null, mail)
  await collect(9, [1, 2, 0], web)
  await collect(9, null, web)
  for (const [revision, instant] of [[first.revision.id, '2026-07-01T04:00:00.000Z'], [second.revision.id, '2026-08-01T04:00:00.000Z']]) {
    await db.prepare('UPDATE flow_revisions SET published_at=? WHERE id=?').bind(instant, revision).run()
  }
  const query = (extra: Record<string, string> = {}) => root + '/trends?' + new URLSearchParams({
    stepId, metric: 'share', shareValue: JSON.stringify(ids[0]), unit: 'month', minimum: '1', from: '2026-07-01', to: '2026-10-01', ...extra,
  })
  const full = await call<TrendReport>(query())
  expect(full.questionType).toBe('priority')
  expect(full.periods.map(point => [point.numerator, point.denominator])).toEqual([[2, 3], [1, 2], [0, 1]])
  expect(full.periods[0].value).toBeCloseTo(200 / 3)
  expect(full.periods.slice(1).map(point => point.value)).toEqual([50, 0])
  expect(full.periods[0].startAt).toBe('2026-07-01T04:00:00.000Z')
  expect(full.periods[1].revisions).toContainEqual(expect.objectContaining({ revisionId: second.revision.id, revisionNumber: 2, prompt: 'Rank updated service priorities', shareLabel: 'Speed' }))
  const guarded = await call<TrendReport>(query({ minimum: '2' }))
  expect(guarded.periods.map(point => [point.denominator, point.suppressed])).toEqual([[3, false], [2, false], [1, true]])
  expect(guarded.periods[2]).toMatchObject({ value: null, numerator: null })
  const cohort = await call<TrendReport>(query({ collectorId: mail.id }))
  expect(cohort.collector).toEqual({ id: mail.id, name: mail.name })
  expect(cohort.periods.map(point => [point.numerator, point.denominator, point.value])).toEqual([[1, 2, 50], [1, 1, 100], [null, 0, null]])
  const revision = await call<TrendReport>(query({ revisionId: second.revision.id }))
  expect(revision.filter.revisionId).toBe(second.revision.id)
  expect(revision.revisions.map(item => item.revisionId)).toEqual([second.revision.id])
  expect(revision.periods.map(point => [point.numerator, point.denominator])).toEqual([[null, 0], [1, 2], [0, 1]])
  const both = await call<TrendReport>(query({ collectorId: web.id, revisionId: second.revision.id }))
  expect(both.periods.map(point => [point.numerator, point.denominator])).toEqual([[null, 0], [0, 1], [0, 1]])

  // Open the ordinary response CSV and independently count exported first choices.
  let { token } = await call<{ token: string }>(root + '/responses/export/start?format=csv')
  let output = ''
  while (token) {
    const response = await request(root + '/responses/export', { token })
    expect(response.status).toBe(200)
    output += await response.text()
    token = response.headers.get('x-export-next') ?? ''
  }
  const [head, ...rows] = csvRows(output)
  expect(rows).toHaveLength(9)
  const observed = [7, 8, 9].map(month => {
    const answers = rows.filter(row => Number(row[head.indexOf('completed_at')].slice(5, 7)) === month)
      .flatMap(row => (JSON.parse(row[head.indexOf('answers_json')]) as Array<{ stepId: string; value: string[] }>).filter(answer => answer.stepId === stepId))
    return [answers.filter(answer => answer.value[0] === 'speed').length, answers.length]
  })
  expect(observed).toEqual([[2, 3], [1, 2], [0, 1]])
  expect(observed).toEqual(full.periods.map(point => [point.numerator, point.denominator]))

  for (const invalid of [ids[0], [ids[0], ids[0], ids[2]], ids.slice(0, 2), [...ids, 'synthetic-pencil-unknown'], [ids[0], ids[1], 'synthetic-pencil-unknown'], [ids[0], ids[1], 7]]) {
    await db.prepare('UPDATE response_answers SET value_json=? WHERE response_id=? AND step_id=?').bind(JSON.stringify(invalid), retained.id, stepId).run()
    // Even below the minimum, malformed retained evidence must refuse the report.
    const response = await request(query({ minimum: '10' }))
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: 'VALIDATION_ERROR', message: expect.stringContaining('Invalid retained answer') })
  }
  await db.prepare('UPDATE response_answers SET value_json=? WHERE response_id=? AND step_id=?').bind(JSON.stringify(ids), retained.id, stepId).run()
  expect((await call<TrendReport>(query())).periods[0].numerator).toBe(2)
  for (const extra of [{ shareValue: JSON.stringify('synthetic-pencil-unknown') }, { metric: 'score' }]) {
    expect((await request(query(extra))).status).toBe(400)
  }
  const missing = new URL(query(), 'http://localhost')
  missing.searchParams.delete('shareValue')
  expect((await request(missing.pathname + missing.search)).status).toBe(400)

  // A published revision that drops the chosen stable option cannot silently redefine its share.
  current = await draft()
  await call(root + '/draft', { expectedVersion: current.flow.draftVersion, stepId, prompt: 'Rank updated service priorities', required: false,
    choices: options.slice(1).map(({ id, value, label }) => ({ id, value, label })) }, 'PUT')
  current = await draft()
  await call(root + '/publish', { expectedVersion: current.flow.draftVersion })
  const absent = await request(query())
  expect(absent.status).toBe(400)
  expect(await absent.json()).toMatchObject({ error: 'VALIDATION_ERROR', message: expect.stringContaining('not present in every selected question revision') })
  expect((await call<TrendReport>(query({ revisionId: first.revision.id }))).periods[0]).toMatchObject({ numerator: 2, denominator: 3 })

  // Erasure changes the released trend, and the original capture cannot restore it.
  await call(`/api/app/responses/${retained.id}`, undefined, 'DELETE')
  expect((await call<TrendReport>(query({ revisionId: first.revision.id }))).periods[0]).toMatchObject({ numerator: 1, denominator: 2, value: 50 })
  expect((await request(`/api/public/flows/${slug}/responses`, retained.submission)).status).toBe(400)
  expect((await call<TrendReport>(query({ revisionId: first.revision.id }))).periods[0]).toMatchObject({ numerator: 1, denominator: 2, value: 50 })
  expect(await db.prepare('SELECT id FROM responses WHERE id=?').bind(retained.id).first()).toBeNull()
}
