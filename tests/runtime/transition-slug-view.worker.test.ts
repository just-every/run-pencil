import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { foundationFixture } from './foundation-fixture'

declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
const progressMigration = __PENCIL_CORE_MIGRATIONS__.filter(value => value.name.startsWith('0011_'))
beforeAll(() => applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__.filter(value => !progressMigration.includes(value))))

contract(['RESP-013', 'BASE-OPS-002'], 'joins the current flow slug without changing retained progress or widening step admission', async () => {
  const f = await foundationFixture('progress-slug-view')
  await f.add({ kind: 'welcome', questionType: null, prompt: 'Welcome' })
  await f.add({ kind: 'question', questionType: 'short_text', prompt: 'Question' })
  await f.add({ kind: 'completion', questionType: null, prompt: 'Done' })
  await f.publish()
  const session = await f.start()
  const retained = async () => Promise.all(['respondent_sessions', 'respondent_session_step_events', 'revision_step_metric_counters'].map(async table =>
    (await env.DB.prepare(`SELECT * FROM ${table} WHERE revision_id = ? ORDER BY id`).bind(session.revisionId).all()).results))
  const before = await retained()
  expect(progressMigration).toHaveLength(1)
  await applyD1Migrations(env.DB, progressMigration)
  expect(await retained()).toEqual(before)
  expect((await env.DB.prepare('SELECT id, flow_slug FROM respondent_session_progress WHERE id = ?').bind(session.sessionId).all()).results)
    .toEqual([{ id: session.sessionId, flow_slug: f.slug }])

  const nextSlug = 'progress-slug-renamed'
  await env.DB.prepare('UPDATE flows SET slug = ? WHERE id = ?').bind(nextSlug, f.flow.flowId).run()
  expect((await env.DB.prepare('SELECT id, flow_slug FROM respondent_session_progress WHERE id = ?').bind(session.sessionId).all()).results)
    .toEqual([{ id: session.sessionId, flow_slug: nextSlug }])
  const request = { sessionId: session.sessionId, sessionToken: session.sessionToken, stepId: session.flow.steps[1].id }
  await expect(f.services.responses.advancePublicSession({ slug: f.slug, ...request })).rejects.toThrow('This screen is not part of your response session.')
  await expect(f.services.responses.advancePublicSession({ slug: nextSlug, ...request, stepId: 'absent-step' })).rejects.toThrow('This screen is not part of your response session.')
  expect(await retained()).toEqual(before)
  await f.services.responses.advancePublicSession({ slug: nextSlug, ...request })
  await f.services.responses.advancePublicSession({ slug: nextSlug, ...request })
  expect(await env.DB.prepare('SELECT furthest_step_id FROM respondent_sessions WHERE id = ?').bind(session.sessionId).first())
    .toEqual({ furthest_step_id: request.stepId })
  expect(await env.DB.prepare('SELECT reached FROM revision_step_metric_counters WHERE revision_id = ? AND step_stable_id = ?').bind(session.revisionId, request.stepId).first())
    .toEqual({ reached: 1 })
  expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM respondent_session_step_events WHERE session_id = ? AND step_stable_id = ?').bind(session.sessionId, request.stepId).first())
    .toEqual({ count: 1 })
  expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
})
