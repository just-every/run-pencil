import { applyD1Migrations, env, SELF, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { createPencilServices } from '../../src/core/app/services'
import { createPencilPlatform } from '../../src/core/platform/runtime'
import { foundationFixture } from './foundation-fixture'
import { predecessorAdvance } from './transition-predecessor'

declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
const progressMigrations = __PENCIL_CORE_MIGRATIONS__.filter(migration => migration.name.startsWith('0011_'))
beforeAll(() => applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__.filter(migration => !progressMigrations.includes(migration))))

async function fixture(slug: string) {
  const f = await foundationFixture(slug)
  await f.add({ kind: 'welcome', questionType: null, prompt: 'Welcome' })
  await f.add({ kind: 'question', questionType: 'short_text', prompt: 'First answer' })
  await f.add({ kind: 'question', questionType: 'short_text', prompt: 'Second answer' })
  await f.add({ kind: 'completion', questionType: null, prompt: 'Complete' })
  await f.publish()
  return f
}
async function progress(revisionId: string) {
  return Promise.all(['respondent_sessions', 'respondent_session_step_events', 'revision_step_metric_counters'].map(async table =>
    (await env.DB.prepare(`SELECT * FROM ${table} WHERE revision_id = ? ORDER BY id`).bind(revisionId).all()).results))
}

contract(['RESP-013', 'RESP-019', 'BASE-OPS-002'], 'adds atomic progress without recounting retained visits and admits both new and repeated visits', async () => {
  const f = await fixture('atomic-progress-upgrade')
  const session = await f.start()
  const before = await progress(session.revisionId)
  expect(progressMigrations).toHaveLength(1)
  await applyD1Migrations(env.DB, progressMigrations)
  expect(await progress(session.revisionId)).toEqual(before)
  const [welcome, first, second] = session.flow.steps
  for (let visit = 0; visit < 2; visit++) {
    const legacy = await predecessorAdvance(env.DB, { slug: f.slug, ...session, stepId: first.id })
    expect(legacy[0].meta.changes).toBe(1)
    expect(legacy[1].meta.changes).toBe(visit ? 0 : 1)
    expect(legacy[2].meta.changes).toBe(visit ? 0 : 1)
  }

  const executions: Array<{ rowsRead: number; rowsWritten: number; admittedRows: number }> = []
  const binding = new Proxy(env.DB, { get(target, property) {
    if (property === 'prepare') return (sql: string) => {
      const wrap = (statement: D1PreparedStatement): D1PreparedStatement => new Proxy(statement, { get(prepared, method) {
        if (method === 'bind') return (...values: unknown[]) => wrap(prepared.bind(...values))
        if (method === 'all') return async () => {
          const result = await prepared.all()
          executions.push({ rowsRead: result.meta.rows_read, rowsWritten: result.meta.rows_written, admittedRows: result.results.length })
          return result
        }
        const member = Reflect.get(prepared, method)
        return typeof member === 'function' ? member.bind(prepared) : member
      } })
      return wrap(target.prepare(sql))
    }
    const member = Reflect.get(target, property)
    return typeof member === 'function' ? member.bind(target) : member
  } })
  const services = createPencilServices(createPencilPlatform('http://localhost', { ...env, DB: binding }))
  for (const step of [second, second, first, welcome]) {
    await services.responses.advancePublicSession({ slug: f.slug, ...session, stepId: step.id })
  }
  console.info(`PENCIL_ATOMIC_PROGRESS_SQL ${JSON.stringify({ visits: 4, executions })}`)
  expect(executions.map(result => result.admittedRows)).toEqual([1, 1, 1, 1])
  const oldAfterNew = await predecessorAdvance(env.DB, { slug: f.slug, ...session, stepId: second.id })
  expect(oldAfterNew.map(result => result.meta.changes)).toEqual([1, 0, 0])
  await services.responses.advancePublicSession({ slug: f.slug, ...session, stepId: welcome.id })
  const [sessions, events, metrics] = await progress(session.revisionId)
  expect(sessions).toHaveLength(1)
  expect(sessions[0]).toMatchObject({ furthest_step_id: welcome.id })
  expect(events).toHaveLength(3)
  expect(metrics.map(row => row.reached)).toEqual([1, 1, 1])
  expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
})

contract(['RESP-019', 'BASE-ACCESS-003'], 'rolls back either telemetry failure while retaining the separately committed request charge', async () => {
  const f = await fixture('atomic-progress-rollback')
  const session = await f.start()
  await applyD1Migrations(env.DB, progressMigrations)
  const stepId = session.flow.steps[1].id
  const advance = (address: string) => SELF.fetch(`http://localhost/api/public/flows/${f.slug}/sessions/advance`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': address },
    body: JSON.stringify({ sessionId: session.sessionId, sessionToken: session.sessionToken, stepId }),
  })
  for (const table of ['revision_step_metric_counters', 'respondent_session_step_events']) {
    const before = await progress(session.revisionId)
    // Each failure uses a fresh address so a minute rollover cannot erase an
    // earlier window while this assertion measures the new durable charge.
    const address = `atomic-progress-charge-${table}`
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`public-rate:${address}`))
    const addressHash = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('')
    const charge = async () => (await env.DB.prepare("SELECT COALESCE(SUM(count), 0) AS count FROM public_rate_limit_windows WHERE scope = 'request' AND address_hash = ?").bind(addressHash).first<{ count: number }>())!.count
    expect(await charge()).toBe(0)
    await env.DB.exec(`CREATE TRIGGER atomic_progress_test_abort BEFORE INSERT ON ${table} WHEN NEW.revision_id = '${session.revisionId}' BEGIN SELECT RAISE(ABORT, 'synthetic telemetry failure'); END`)
    try {
      const response = await advance(address)
      expect(response.status).toBe(500)
      expect(await response.json()).toMatchObject({ error: 'INTERNAL_ERROR' })
      expect(await progress(session.revisionId)).toEqual(before)
      expect(await charge()).toBe(1)
    } finally { await env.DB.exec('DROP TRIGGER atomic_progress_test_abort') }
  }
  expect((await advance('atomic-progress-success')).status).toBe(204)
  expect((await advance('atomic-progress-success')).status).toBe(204)
  expect(await env.DB.prepare('SELECT reached FROM revision_step_metric_counters WHERE revision_id = ? AND step_stable_id = ?').bind(session.revisionId, stepId).first()).toEqual({ reached: 1 })
  expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM respondent_session_step_events WHERE session_id = ? AND step_stable_id = ?').bind(session.sessionId, stepId).first()).toEqual({ count: 1 })
})

contract('RESP-019', 'rolls back a counter conflict update or the base session update across both view triggers', async () => {
  const f = await fixture('atomic-progress-conflict-rollback')
  const [earlier, session] = await Promise.all([f.start(), f.start()])
  await applyD1Migrations(env.DB, progressMigrations)
  const stepId = session.flow.steps[1].id
  await f.services.responses.advancePublicSession({ slug: f.slug, ...earlier, stepId })
  for (const [table, predicate] of [
    ['revision_step_metric_counters', `NEW.revision_id = '${session.revisionId}'`],
    ['respondent_sessions', `NEW.id = '${session.sessionId}'`],
  ]) {
    const before = await progress(session.revisionId)
    await env.DB.exec(`CREATE TRIGGER atomic_progress_test_update_abort BEFORE UPDATE ON ${table} WHEN ${predicate} BEGIN SELECT RAISE(ABORT, 'synthetic update failure'); END`)
    try {
      await expect(f.services.responses.advancePublicSession({ slug: f.slug, ...session, stepId })).rejects.toThrow()
      expect(await progress(session.revisionId)).toEqual(before)
    } finally { await env.DB.exec('DROP TRIGGER atomic_progress_test_update_abort') }
  }
  await f.services.responses.advancePublicSession({ slug: f.slug, ...session, stepId })
  expect(await env.DB.prepare('SELECT reached FROM revision_step_metric_counters WHERE revision_id = ? AND step_stable_id = ?').bind(session.revisionId, stepId).first()).toEqual({ reached: 2 })
  const beforeRefusal = await progress(session.revisionId)
  const refused = await env.DB.prepare('UPDATE respondent_session_progress SET furthest_step_id = ?, updated_at = ? WHERE id = ? AND session_token_hash = ? RETURNING id')
    .bind(session.flow.steps[2].id, new Date().toISOString(), session.sessionId, 'incorrect-hash').all()
  expect(refused.results).toEqual([])
  expect(await progress(session.revisionId)).toEqual(beforeRefusal)
})
