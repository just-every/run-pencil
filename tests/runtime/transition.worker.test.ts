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

contract(['RESP-013', 'RESP-019', 'RSLT-002', 'RESP-015'], "counts native concurrent visits once and preserves progress across backtracking, credential refusals and expiry", async () => {
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

  const activeExpiry = (await sessionRow(session.sessionId))!.expires_at
  // Refusals cannot alter the same session whose visit counts were just proved.
  {
    const foreign = await fixture('transition-foreign')
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
  }
  // Restore the fixture's original validity before backtracking and expiring it.
  await env.DB.prepare('UPDATE respondent_sessions SET expires_at = ? WHERE id = ?').bind(activeExpiry, session.sessionId).run()
  expect((await advance(f.slug, session, welcome.id)).status).toBe(204)
  await env.DB.prepare('UPDATE respondent_sessions SET expires_at = ? WHERE id = ?').bind('2000-01-01T00:00:00.000Z', session.sessionId).run()
  await f.services.responses.expireSessions(new Date().toISOString(), 1000)
  expect(await sessionRow(session.sessionId)).toBeNull()
  expect(await env.DB.prepare('SELECT dropped FROM revision_step_metric_counters WHERE revision_id = ? AND step_stable_id = ?').bind(session.revisionId, welcome.id).first()).toEqual({ dropped: 1 })
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
