import { applyD1Migrations, env, SELF, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { createPencilServices } from '../../src/core/app/services'
import { createWorkerApp } from '../../src/core/app/worker'
import { createPencilPlatform } from '../../src/core/platform/runtime'
import { foundationFixture } from './foundation-fixture'

// These are actual Worker/D1 requests. Instrumentation forwards every query and
// result unchanged; it records the transaction's native rows-read/write metadata.
declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(() => applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__))
async function fixture(slug: string) {
  const f = await foundationFixture(slug)
  await f.add({ kind: 'welcome', questionType: null, prompt: 'Welcome' })
  await f.add({ kind: 'question', questionType: 'short_text', prompt: 'Answer', required: true })
  await f.add({ kind: 'completion', questionType: null, prompt: 'Done' })
  await f.publish()
  return f
}
type Session = Awaited<ReturnType<Awaited<ReturnType<typeof fixture>>['start']>>
function request(slug: string, session: Session, stepId: string) {
  return new Request(`http://localhost/api/public/flows/${slug}/sessions/advance`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': slug },
    body: JSON.stringify({ sessionId: session.sessionId, sessionToken: session.sessionToken, stepId }),
  })
}
const advance = (slug: string, session: Session, stepId: string) => SELF.fetch(request(slug, session, stepId))
const sessionRow = (id: string) => env.DB.prepare('SELECT * FROM respondent_sessions WHERE id = ?').bind(id).first()
async function progress(session: Session) {
  return {
    session: await sessionRow(session.sessionId),
    events: (await env.DB.prepare('SELECT * FROM respondent_session_step_events WHERE session_id = ? ORDER BY step_stable_id').bind(session.sessionId).all()).results,
    metrics: (await env.DB.prepare('SELECT * FROM revision_step_metric_counters WHERE revision_id = ? ORDER BY step_stable_id').bind(session.revisionId).all()).results,
  }
}

contract(['RESP-013', 'RESP-019', 'RSLT-002'], 'profiles native transition SQL and counts concurrent distinct visits once while retaining ordered backtracking', async () => {
  const f = await fixture('transition-profile')
  const session = await f.start()
  const batches: D1Result[][] = []
  const binding = new Proxy(env.DB, { get(target, property) {
    if (property === 'batch') return async (statements: D1PreparedStatement[]) => {
      const results = await target.batch(statements)
      batches.push(results)
      return results
    }
    const member = Reflect.get(target, property)
    return typeof member === 'function' ? member.bind(target) : member
  } })
  const platform = createPencilPlatform('http://localhost', { ...env, DB: binding })
  const app = createWorkerApp(createPencilServices(platform), platform)
  const [welcome, question, completion] = session.flow.steps
  expect((await app.fetch(request(f.slug, session, question.id), env)).status).toBe(204)
  console.info(`PENCIL_TRANSITION_SQL ${JSON.stringify({ calls: batches.length, statements: batches.flat().length, batches: batches.map(batch => batch.map(result => ({ rowsRead: result.meta.rows_read, rowsWritten: result.meta.rows_written }))) })}`)
  const visits = await Promise.all(Array.from({ length: 8 }, () => advance(f.slug, session, question.id)))
  expect(visits.map(r => r.status)).toEqual(Array(8).fill(204))
  expect((await advance(f.slug, session, completion.id)).status).toBe(204)
  expect((await advance(f.slug, session, welcome.id)).status).toBe(204)
  const state = await progress(session)
  expect(state.session).toMatchObject({ furthest_step_id: welcome.id })
  expect(state.events).toHaveLength(3)
  expect(state.metrics.map(row => row.reached)).toEqual([1, 1, 1])
  await env.DB.prepare('UPDATE respondent_sessions SET expires_at = ? WHERE id = ?').bind('2000-01-01T00:00:00.000Z', session.sessionId).run()
  await f.services.responses.expireSessions(new Date().toISOString(), 1000)
  expect(await sessionRow(session.sessionId)).toBeNull()
  expect(await env.DB.prepare('SELECT dropped FROM revision_step_metric_counters WHERE revision_id = ? AND step_stable_id = ?').bind(session.revisionId, welcome.id).first()).toEqual({ dropped: 1 })
})

contract(['BASE-ACCESS-003', 'RESP-013'], 'increments an existing counter once per session across concurrent visits and preserves public rate refusal', async () => {
  const f = await fixture('transition-distinct')
  const sessions = await Promise.all(Array.from({ length: 6 }, () => f.start()))
  const question = sessions[0].flow.steps[1].id
  const results = await Promise.all(sessions.flatMap(session => [advance(f.slug, session, question), advance(f.slug, session, question)]))
  expect(results.map(result => result.status)).toEqual(Array(12).fill(204))
  expect(await env.DB.prepare('SELECT reached FROM revision_step_metric_counters WHERE revision_id = ? AND step_stable_id = ?').bind(sessions[0].revisionId, question).first()).toEqual({ reached: 6 })
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`public-rate:${f.slug}`))
  const addressHash = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('')
  const minute = Math.floor(Date.now() / 60000) * 60000
  for (const at of [minute, minute + 60000]) {
    const began = new Date(at).toISOString()
    await env.DB.prepare(`INSERT INTO public_rate_limit_windows (id, scope, address_hash, window_started_at, count, expires_at, created_at, updated_at)
      VALUES (?, 'request', ?, ?, 120, ?, ?, ?) ON CONFLICT(scope, address_hash, window_started_at) DO UPDATE SET count = 120`)
      .bind(`transition-rate-${at}`, addressHash, began, new Date(at + 60000).toISOString(), began, began).run()
  }
  const before = await progress(sessions[0])
  const refused = await advance(f.slug, sessions[0], sessions[0].flow.steps[2].id)
  expect(refused.status).toBe(429)
  expect(await refused.json()).toMatchObject({ error: 'RATE_LIMITED' })
  expect(await progress(sessions[0])).toEqual(before)
})

contract(['RESP-013', 'RESP-015'], 'refuses invalid credentials, foreign screens and expired sessions with no progress mutation', async () => {
  const f = await fixture('transition-refusal')
  const foreign = await fixture('transition-foreign')
  const session = await f.start()
  const other = await foreign.start()
  expect((await advance(f.slug, session, session.flow.steps[1].id)).status).toBe(204)
  for (const [slug, input, stepId, code] of [
    [f.slug, { ...session, sessionToken: 'x'.repeat(64) }, session.flow.steps[1].id, 'SESSION_UNAVAILABLE'],
    [f.slug, { ...session, sessionId: 'missing-session' }, session.flow.steps[1].id, 'SESSION_UNAVAILABLE'],
    [foreign.slug, session, session.flow.steps[1].id, 'VALIDATION_ERROR'],
    [f.slug, session, other.flow.steps[1].id, 'VALIDATION_ERROR'],
    [f.slug, session, 'missing-step', 'VALIDATION_ERROR'],
  ] as const) {
    const before = await progress(session)
    const response = await advance(slug, input, stepId)
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: code })
    expect(await progress(session)).toEqual(before)
  }
  await env.DB.prepare('UPDATE respondent_sessions SET completed_at = ? WHERE id = ?').bind(new Date().toISOString(), session.sessionId).run()
  const completed = await progress(session)
  expect(await (await advance(f.slug, session, session.flow.steps[2].id)).json()).toMatchObject({ error: 'SESSION_UNAVAILABLE' })
  expect(await progress(session)).toEqual(completed)
  await env.DB.prepare('UPDATE respondent_sessions SET completed_at = NULL, expires_at = ? WHERE id = ?').bind('2000-01-01T00:00:00.000Z', session.sessionId).run()
  const before = await progress(session)
  expect(await (await advance(f.slug, session, session.flow.steps[1].id)).json()).toMatchObject({ error: 'SESSION_UNAVAILABLE' })
  expect(await progress(session)).toEqual(before)
})

contract('RESP-019', 'rolls session progress and reach counts back when event persistence fails', async () => {
  const f = await fixture('transition-rollback')
  const session = await f.start()
  const step = session.flow.steps[1].id
  const before = await progress(session)
  // A real SQLite constraint failure in the last transaction statement.
  await env.DB.exec(`CREATE TRIGGER transition_test_abort BEFORE INSERT ON respondent_session_step_events WHEN NEW.session_id = '${session.sessionId}' BEGIN SELECT RAISE(ABORT, 'synthetic event failure'); END`)
  try {
    expect((await advance(f.slug, session, step)).status).toBe(500)
    expect(await progress(session)).toEqual(before)
  } finally { await env.DB.exec('DROP TRIGGER transition_test_abort') }
  expect((await advance(f.slug, session, step)).status).toBe(204)
  expect(await env.DB.prepare('SELECT reached FROM revision_step_metric_counters WHERE revision_id = ? AND step_stable_id = ?').bind(session.revisionId, step).first()).toEqual({ reached: 1 })
})

contract(['FLOW-009', 'RESP-019'], 'keeps old-session telemetry pinned through publication, closure and archive without admitting a final', async () => {
  const f = await fixture('transition-pinned')
  const session = await f.start()
  await f.publish()
  expect((await f.start()).revisionId).not.toBe(session.revisionId)
  const question = session.flow.steps[1].id
  expect((await advance(f.slug, session, question)).status).toBe(204)
  await f.services.flows.closeFlow(f.scope.workspaceId, f.flow.flowId, f.operatorId)
  expect((await advance(f.slug, session, question)).status).toBe(204)
  await expect(f.final(session, [{ stepId: question, value: 'Closed answer' }])).rejects.toMatchObject({ code: 'FLOW_CLOSED' })
  await f.services.flows.archiveFlow(f.scope.workspaceId, f.flow.flowId, f.operatorId)
  expect((await advance(f.slug, session, question)).status).toBe(204)
  expect(await env.DB.prepare('SELECT reached FROM revision_step_metric_counters WHERE revision_id = ? AND step_stable_id = ?').bind(session.revisionId, question).first()).toEqual({ reached: 1 })
})

contract(['RESP-012', 'DATA-002'], 'cannot resurrect progress after concurrent final admission or erasure, and keeps the original receipt', async () => {
  const f = await fixture('transition-final-race')
  const session = await f.start()
  await f.mature(session.sessionId)
  const question = session.flow.steps[1].id
  const [transition, receipt] = await Promise.all([
    advance(f.slug, session, question), f.final(session, [{ stepId: question, value: 'Original answer' }]),
  ])
  expect([204, 400]).toContain(transition.status)
  expect(receipt).toMatchObject({ disposition: 'released', idempotent: false })
  expect(await sessionRow(session.sessionId)).toBeNull()
  const before = await progress(session)
  expect(await (await advance(f.slug, session, question)).json()).toMatchObject({ error: 'SESSION_UNAVAILABLE' })
  expect(await progress(session)).toEqual(before)
  expect(await f.final(session, [{ stepId: question, value: 'Changed answer' }])).toMatchObject({ responseId: receipt.responseId, idempotent: true })
  await f.services.responses.eraseReleasedResponse({ ...f.scope, responseId: receipt.responseId!, operatorId: f.operatorId })
  expect(await (await advance(f.slug, session, question)).json()).toMatchObject({ error: 'SESSION_UNAVAILABLE' })
  expect(await progress(session)).toEqual(before)
})
