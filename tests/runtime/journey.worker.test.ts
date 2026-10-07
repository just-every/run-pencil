import { applyD1Migrations, createScheduledController, env, SELF, type D1Migration } from 'cloudflare:test'
import worker from '../../src/core/app/worker'
import { contract } from '../../src/test/contract'
import { beforeAll, expect, it, vi } from 'vitest'
import type { BuilderDraft, FlowResults, PublicFlow } from '../../src/core/app/api'
import { FlowRepository } from '../../src/core/features/flows/repository'
import { ResponseRepository } from '../../src/core/features/responses/repository'
import { createPencilServices } from '../../src/core/app/services'
import { createPencilPlatform } from '../../src/core/platform/runtime'
import { AuthRepository } from '../../src/core/features/auth/repository'
import { createD1BatchExecutor } from '../../src/core/platform/db/batch'
import manifest from '../../seed.json'
declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
let cookie = ''
let serial = 0
async function req(path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST') {
  const response = await SELF.fetch(`http://localhost${path}`, { method, headers: { Host: 'localhost', cookie, origin: 'http://localhost', 'content-type': 'application/json', 'CF-Connecting-IP': `192.0.2.${++serial}` }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  return response
}
async function ok<T>(path: string, body?: unknown, method?: string): Promise<T> {
  const response = await req(path, body, method)
  const text = await response.text()
  expect(response.status, `${path}: ${text}`).toBeLessThan(300)
  return text ? JSON.parse(text) as T : undefined as T
}
beforeAll(async () => {
  await applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__)
  await ok('/health')
  await ok('/auth/magic-link', { email: 'owner@aurora-coffee.test' })
  const inbox = await ok<{ messages: Array<{ magicLinkToken: string }> }>('/auth/local-inbox?email=owner%40aurora-coffee.test')
  const login = await SELF.fetch('http://localhost/auth/confirm', { method: 'POST', headers: { Host: 'localhost', Origin: 'http://localhost', 'Content-Type': 'application/json' }, body: JSON.stringify({ token: inbox.messages[0].magicLinkToken }), redirect: 'manual' })
  expect(login.status).toBe(303)
  cookie = login.headers.get('set-cookie')!.split(';')[0]
})

contract('RESP-009', 'rechecks manual closure and deadline inside final admission; losers receive a named closed outcome with no saved response', async () => {
  for (const reason of ['manual', 'deadline'] as const) {
    const f = await fixture(`closed-race-${reason}`)
    const session = await f.start()
    const original = ResponseRepository.prototype.createCompletedResponse
    const gate = vi.spyOn(ResponseRepository.prototype, 'createCompletedResponse').mockImplementationOnce(async function (input) {
      if (reason === 'manual') await ok(`${f.path}/close`, {})
      else await env.DB.prepare('UPDATE flow_revisions SET deadline_at = ? WHERE id = ?').bind(new Date(Date.now() - 1000).toISOString(), session.revisionId).run()
      return original.call(this, input)
    })
    try {
      const denied = await f.submit(session, [{ stepId: f.route.id, value: f.skip.id }])
      expect(denied.status).toBe(409)
      expect(await denied.json()).toMatchObject({ error: 'FLOW_CLOSED', closedFlow: { title: `Journey closed-race-${reason}`, slug: `closed-race-${reason}` } })
      expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM responses WHERE revision_id = ?').bind(session.revisionId).first()).toEqual({ n: 0 })
      expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM response_answers a JOIN responses r ON r.id = a.response_id WHERE r.revision_id = ?').bind(session.revisionId).first()).toEqual({ n: 0 })
      expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM response_outbox WHERE response_id IN (SELECT id FROM responses WHERE revision_id = ?)').bind(session.revisionId).first()).toEqual({ n: 0 })
      expect(await ok(`${f.path}/results`)).toMatchObject({ starts: 1, completedResponses: 0 })
      const closed = await req(`/api/public/flows/closed-race-${reason}`)
      expect(closed.status).toBe(409)
      const body = await closed.json()
      expect(Object.keys(body).sort()).toEqual(['closedFlow', 'error', 'message'])
      const blockedStart = await req(`/api/public/flows/closed-race-${reason}/sessions`, { deviceClass: 'desktop', source: 'direct' })
      expect(blockedStart.status).toBe(409)
      expect(await ok(`${f.path}/results`)).toMatchObject({ starts: 1, completedResponses: 0 })
      expect(await env.DB.prepare('SELECT admission_close_reason FROM flow_revisions WHERE id = ?').bind(session.revisionId).first()).toEqual({ admission_close_reason: reason })
    } finally { gate.mockRestore() }
  }
})

contract('RESP-014', 'retries an exact refused final after same-revision reopening and commits only one original-key response', async () => {
  const f = await fixture('closed-final-recovery')
  const session = await f.start()
  const answers = [{ stepId: f.route.id, value: f.more.id }, { stepId: f.detail.id, value: 'Private original closure answer' }]
  const key = 'closed-final-original-key'
  await ok(`${f.path}/close`, {})
  for (let attempt = 0; attempt < 2; attempt++) {
    const denied = await f.submit(session, answers, key)
    expect(denied.status).toBe(409)
    const body = await denied.json()
    expect(body).toMatchObject({ error: 'FLOW_CLOSED', closedFlow: { title: 'Journey closed-final-recovery', slug: 'closed-final-recovery' } })
    for (const secret of [session.sessionToken, session.sessionId, key, answers[1].value]) expect(JSON.stringify(body)).not.toContain(secret)
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM responses WHERE revision_id = ?').bind(session.revisionId).first()).toEqual({ n: 0 })
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM response_outbox WHERE response_id IN (SELECT id FROM responses WHERE revision_id = ?)').bind(session.revisionId).first()).toEqual({ n: 0 })
    expect(await ok(`${f.path}/results`)).toMatchObject({ starts: 1, completedResponses: 0 })
  }
  await ok(`${f.path}/reopen`, {})
  expect((await ok<PublicFlow>('/api/public/flows/closed-final-recovery')).revision.id).toBe(session.revisionId)
  const committed = await f.submit(session, answers, key)
  expect(committed.status).toBe(201)
  const receipt = await committed.json<{ responseId: string }>()
  expect(receipt).toMatchObject({ idempotent: false, disposition: 'released', completionStepId: f.end.id })
  await ok(`${f.path}/close`, {})
  const replay = await f.submit(session, answers, key)
  expect(replay.status).toBe(201)
  expect(await replay.json()).toEqual({ ...receipt, idempotent: true })
  expect(await env.DB.prepare('SELECT id, idempotency_key FROM responses WHERE revision_id = ?').bind(session.revisionId).all()).toMatchObject({ results: [{ id: receipt.responseId, idempotency_key: key }] })
  expect(await env.DB.prepare('SELECT step_id, value_json FROM response_answers WHERE response_id = ? ORDER BY step_id').bind(receipt.responseId).all()).toMatchObject({ results: answers.map(answer => ({ step_id: answer.stepId, value_json: JSON.stringify(answer.value) })).sort((a, b) => a.step_id.localeCompare(b.step_id)) })
  expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM response_outbox WHERE response_id = ?').bind(receipt.responseId).first()).toEqual({ n: 1 })
  expect(await ok(`${f.path}/results`)).toMatchObject({ starts: 1, completedResponses: 1 })
})

contract(['FLOW-010','FLOW-018'], 'closes only the pinned revision when its deadline or target applies; manual close and archive close every revision', async () => {
  for (const reason of ['deadline', 'target'] as const) {
    const slug = `closed-pinned-${reason}`
    const f = await fixture(slug, reason === 'target' ? 1 : undefined)
    const older = await Promise.all([f.start(), f.start()])
    const draft = await f.draft()
    await ok(`${f.path}/publish`, { expectedVersion: draft.flow.draftVersion, targetCompletedResponses: 2 })
    const newer = await f.start()
    if (reason === 'deadline') {
      await env.DB.prepare('UPDATE flow_revisions SET deadline_at = ? WHERE id = ?').bind(new Date(Date.now() - 1000).toISOString(), older[0].revisionId).run()
    } else expect((await f.submit(older[0], [{ stepId: f.route.id, value: f.skip.id }])).status).toBe(201)
    expect((await f.submit(older[1], [{ stepId: f.route.id, value: f.skip.id }])).status).toBe(409)
    expect((await ok<PublicFlow>(`/api/public/flows/${slug}`)).revision.id).toBe(newer.revisionId)
    expect(await ok(`${f.path}/results`)).toMatchObject({ completedResponses: 0, flow: { status: 'open' } })
    expect((await f.submit(newer, [{ stepId: f.route.id, value: f.skip.id }])).status).toBe(201)
    expect(await ok(`${f.path}/results`)).toMatchObject({ completedResponses: 1, flow: { status: 'open' } })
    await ok(`${f.path}/close`, {})
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM flow_revisions WHERE flow_id = ? AND state = 'published' AND admission_closed_at IS NULL").bind(f.flow.id).first()).toEqual({ n: 0 })
    await ok(`${f.path}/reopen`, {})
    expect((await ok<PublicFlow>(`/api/public/flows/${slug}`)).revision.id).toBe(newer.revisionId)
    expect(await env.DB.prepare('SELECT admission_closed_at FROM flow_revisions WHERE id = ?').bind(older[0].revisionId).first()).not.toEqual({ admission_closed_at: null })
    const before = await ok<{ responses: unknown[] }>(`${f.path}/responses/export`)
    await ok(`${f.path}/archive`, {})
    expect((await req(`/api/public/flows/${slug}`)).status).toBe(404)
    expect(await ok(`${f.path}/responses/export`)).toMatchObject({ responses: before.responses })
    expect((await req(`${f.path}/reopen`, {})).status).toBe(400)
  }
}, 60000)

contract(['FLOW-001','FLOW-010','FLOW-018'], 'rejects reopening atomically if release reaches the target after its precheck; erasure permits only explicit reopening', async () => {
  const f = await fixture('closed-reopen-race', 1)
  const fast = await f.start(true)
  const completed = await f.submit(fast, [{ stepId: f.route.id, value: f.skip.id }])
  const { responseId } = await completed.json<{ responseId: string }>()
  await ok(`${f.path}/close`, {})
  const original = FlowRepository.prototype.reopenFlow
  const gate = vi.spyOn(FlowRepository.prototype, 'reopenFlow').mockImplementationOnce(async function (...args) {
    await ok(`/api/app/responses/${responseId}/release`, {})
    return original.apply(this, args)
  })
  try { expect((await req(`${f.path}/reopen`, {})).status).toBe(400) } finally { gate.mockRestore() }
  expect(await ok(`${f.path}/results`)).toMatchObject({ completedResponses: 1, flow: { status: 'closed' } })
  expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM audit_entries WHERE subject_id = ? AND kind = 'flow.reopened'").bind(f.flow.id).first()).toEqual({ n: 0 })
  await ok(`/api/app/responses/${responseId}`, undefined, 'DELETE')
  expect(await ok(`${f.path}/results`)).toMatchObject({ completedResponses: 0, flow: { status: 'closed' } })
  await ok(`${f.path}/reopen`, {})
  expect((await ok<PublicFlow>('/api/public/flows/closed-reopen-race')).revision.id).toBe(f.publicFlow.revision.id)
  expect(await env.DB.prepare("SELECT actor_operator_id FROM audit_entries WHERE subject_id = ? AND kind = 'flow.reopened'").bind(f.flow.id).first()).toMatchObject({ actor_operator_id: expect.any(String) })
  await ok(`${f.path}/close`, {})
  await env.DB.prepare('UPDATE flow_revisions SET deadline_at = ? WHERE id = ?').bind(new Date(Date.now() - 1000).toISOString(), f.publicFlow.revision.id).run()
  expect((await req(`${f.path}/reopen`, {})).status).toBe(400)
  expect(await ok(`${f.path}/results`)).toMatchObject({ flow: { status: 'closed' } })
}, 60000)

contract(['FLOW-018','RESP-018'], 'reports target closure after quarantine release without re-triggering admission flags or creating failed-start/submission effects', async () => {
  const f = await fixture('closed-release-target', 1)
  const pending = await f.start()
  const fast = await f.start(true)
  const { responseId } = await (await f.submit(fast, [{ stepId: f.route.id, value: f.skip.id }])).json<{ responseId: string }>()
  await ok(`/api/app/responses/${responseId}/release`, {})
  const assertFlags = async () => {
    expect(await env.DB.prepare('SELECT status FROM flows WHERE id = ?').bind(f.flow.id).first()).toEqual({ status: 'open' })
    expect(await env.DB.prepare('SELECT admission_closed_at FROM flow_revisions WHERE id = ?').bind(f.publicFlow.revision.id).first()).toEqual({ admission_closed_at: null })
  }
  await assertFlags()
  for (const response of [
    await req('/api/public/flows/closed-release-target'),
    await req('/api/public/flows/closed-release-target/sessions', { deviceClass: 'desktop', source: 'direct' }),
    await f.submit(pending, [{ stepId: f.route.id, value: f.skip.id }]),
  ]) {
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ error: 'FLOW_CLOSED', closedFlow: { title: 'Journey closed-release-target', slug: 'closed-release-target' } })
  }
  await assertFlags()
  expect(await ok(`${f.path}/results`)).toMatchObject({ starts: 2, completedResponses: 1 })
  expect(await ok(`${f.path}/ledger`)).toMatchObject({ total: 1 })
  expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM respondent_sessions WHERE revision_id = ?').bind(pending.revisionId).first()).toEqual({ n: 1 })
  expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM response_outbox WHERE response_id = ?').bind(responseId).first()).toEqual({ n: 1 })
}, 60000)
async function fixture(slug: string, target?: number) {
  const flow = await ok<{ id: string }>('/api/app/flows', { title: `Journey ${slug}`, slug })
  const path = `/api/app/flows/${flow.id}`
  const draft = () => ok<BuilderDraft>(`${path}/draft`)
  const add = async (step: unknown) => {
    const current = await draft()
    await ok(`${path}/draft/steps`, { expectedVersion: current.flow.draftVersion, step })
  }
  await add({ kind: 'question', questionType: 'single_choice', prompt: 'Which route?', required: true, choices: [{ value: 'detail', label: 'Tell us more' }, { value: 'skip', label: 'Finish now' }] })
  await add({ kind: 'question', questionType: 'long_text', prompt: 'Your exact words', required: true })
  await add({ kind: 'completion', questionType: null, prompt: 'Recorded. Thank you.' })
  let current = await draft()
  const [route, detail, end] = current.steps
  expect(route).toMatchObject({ required: true, nextStepId: detail.id })
  expect(detail).toMatchObject({ required: true, nextStepId: end.id })
  const skip = current.choices.find((choice) => choice.value === 'skip')!
  const more = current.choices.find((choice) => choice.value === 'detail')!
  await ok(`${path}/draft/branches`, { expectedVersion: current.flow.draftVersion, rules: [{ sourceStepId: route.id, predicateKind: 'equals', expectedValue: skip.id, destinationStepId: end.id, position: 0 }] }, 'PUT')
  current = await draft()
  const publish = () => ok(`${path}/publish`, { expectedVersion: current.flow.draftVersion, ...(target ? { targetCompletedResponses: target } : {}) })
  await publish()
  const publicFlow = await ok<PublicFlow>(`/api/public/flows/${slug}`)
  const start = async (fast = false, source = 'direct') => {
    const session = await ok<{ sessionId: string; sessionToken: string; revisionId: string; flow: PublicFlow }>(`/api/public/flows/${slug}/sessions`, { deviceClass: 'desktop', source })
    expect(session.flow.revision.id).toBe(session.revisionId)
    if (!fast) await env.DB.prepare('UPDATE respondent_sessions SET created_at = ? WHERE id = ?').bind(new Date(Date.now() - 5000).toISOString(), session.sessionId).run()
    return session
  }
  const submit = (session: { sessionId: string; sessionToken: string }, answers: unknown[], key = 'journey-idempotency-123') => req(`/api/public/flows/${slug}/responses`, { ...session, answers, idempotencyKey: key })
  return { path, flow, draft, current, route, detail, end, skip, more, start, submit, publicFlow }
}

contract(['BASE-DATA-002','RESP-013','RESP-019'], 'scheduled retention folds abandoned sessions once, preserves active auth and every current persistent entity, and logs counts only', async () => {
  const f = await fixture('retention-runtime')
  const expired = await Promise.all([f.start(), f.start()])
  const active = await f.start()
  const completed = await f.start()
  const answers = [{ stepId: f.route.id, value: f.skip.id }]
  const receipt = await (await f.submit(completed, answers)).json<{ responseId: string }>()
  await ok(`/api/public/flows/retention-runtime/sessions/advance`, { ...expired[1], stepId: f.detail.id })
  const cutoff = new Date().toISOString()
  for (const session of expired) await env.DB.prepare('UPDATE respondent_sessions SET expires_at = ? WHERE id = ?').bind('2000-01-01T00:00:00.000Z', session.sessionId).run()
  await env.DB.prepare(`INSERT INTO operator_sessions (id, operator_id, token_hash, expires_at, last_active_at, revoked_at, created_at, updated_at)
    SELECT 'retention-expired-operator', operator_id, 'retention-expired-secret', ?, ?, NULL, ?, ? FROM operator_sessions LIMIT 1`).bind('2000-01-01T00:00:00.000Z', cutoff, cutoff, cutoff).run()
  const protectedTables = ['workspaces', 'operators', 'flows', 'flow_revisions', 'flow_steps', 'choice_options', 'flow_branch_rules', 'responses', 'response_answers', 'response_outbox', 'revision_metric_counters', 'audit_entries', 'auth_magic_links', 'local_dev_inbox', 'local_fixture_initializations']
  const before = await Promise.all(protectedTables.map(table => env.DB.prepare(`SELECT * FROM ${table} ORDER BY id`).all().then(result => result.results)))
  for (const [id, end] of [['retention-expired-rate', '2000-01-01T00:00:00.000Z'], ['retention-active-rate', '2099-01-01T00:00:00.000Z']]) {
    await env.DB.prepare(`INSERT INTO public_rate_limit_windows (id, scope, address_hash, window_started_at, count, expires_at, created_at, updated_at) VALUES (?, 'request', ?, ?, 1, ?, ?, ?)`).bind(id, id, cutoff, end, cutoff, cutoff).run()
  }
  const log = vi.spyOn(console, 'log').mockImplementation(() => {})
  try {
    await Promise.all([worker.scheduled(createScheduledController({ scheduledTime: Date.now(), cron: '15 * * * *' }), env), worker.scheduled(createScheduledController({ scheduledTime: Date.now(), cron: '15 * * * *' }), env)])
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/retention-expired-secret|sessionToken|sessionId|owner@|retention-runtime|responseId|answer/)
    expect(log.mock.calls).toHaveLength(2)
  } finally { log.mockRestore() }
  expect(await Promise.all(protectedTables.map(table => env.DB.prepare(`SELECT * FROM ${table} ORDER BY id`).all().then(result => result.results)))).toEqual(before)
  for (const session of expired) {
    expect(await env.DB.prepare('SELECT id FROM respondent_sessions WHERE id = ?').bind(session.sessionId).first()).toBeNull()
    expect(await env.DB.prepare('SELECT id FROM respondent_session_step_events WHERE session_id = ?').bind(session.sessionId).first()).toBeNull()
  }
  expect(await env.DB.prepare('SELECT id FROM respondent_sessions WHERE id = ?').bind(active.sessionId).first()).toEqual({ id: active.sessionId })
  expect(await env.DB.prepare("SELECT id FROM operator_sessions WHERE id = 'retention-expired-operator'").first()).toBeNull()
  expect(await env.DB.prepare("SELECT id FROM public_rate_limit_windows WHERE id = 'retention-expired-rate'").first()).toBeNull()
  expect(await env.DB.prepare("SELECT id FROM public_rate_limit_windows WHERE id = 'retention-active-rate'").first()).toEqual({ id: 'retention-active-rate' })
  for (const step of [f.route.id, f.detail.id]) expect(await env.DB.prepare('SELECT dropped FROM revision_step_metric_counters WHERE revision_id = ? AND step_stable_id = ?').bind(active.revisionId, step).first()).toEqual({ dropped: 1 })
  expect(await ok(`${f.path}/results`)).toMatchObject({ starts: 4, completedResponses: 1 })
  expect(await f.submit(completed, answers).then(response => response.json())).toMatchObject({ responseId: receipt.responseId, idempotent: true })
  expect((await f.submit(expired[0], answers)).status).toBe(400)
  expect((await req('/__scheduled')).status).toBe(404)
})

it('bounds each expiry transaction and rolls counters and session/event deletion back together on failure', async () => {
  const f = await fixture('retention-transaction')
  const session = await f.start()
  const platform = createPencilPlatform('http://localhost', env)
  const repository = new ResponseRepository(platform.database, env.DB)
  const now = new Date().toISOString()
  await env.DB.prepare('UPDATE respondent_sessions SET expires_at = ? WHERE id = ?').bind('2000-01-01T00:00:00.000Z', session.sessionId).run()
  await env.DB.prepare(`CREATE TRIGGER retention_abort BEFORE DELETE ON respondent_sessions WHEN OLD.id = '${session.sessionId}' BEGIN SELECT RAISE(ABORT, 'synthetic retention failure'); END`).run()
  try { await expect(repository.foldExpiredSessions(now)).rejects.toThrow() } finally { await env.DB.prepare('DROP TRIGGER retention_abort').run() }
  expect(await env.DB.prepare('SELECT dropped FROM revision_step_metric_counters WHERE revision_id = ? AND step_stable_id = ?').bind(session.revisionId, f.route.id).first()).toEqual({ dropped: 0 })
  expect(await env.DB.prepare('SELECT id FROM respondent_sessions WHERE id = ?').bind(session.sessionId).first()).not.toBeNull()
  expect(await env.DB.prepare('SELECT id FROM respondent_session_step_events WHERE session_id = ?').bind(session.sessionId).first()).not.toBeNull()
  expect(await repository.foldExpiredSessions(now)).toBe(1)
  expect(await repository.foldExpiredSessions(now)).toBe(0)

  const active = await f.start()
  await env.DB.prepare(`WITH RECURSIVE numbers(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM numbers WHERE n < 1203)
    INSERT INTO respondent_sessions (id, revision_id, source, device_class, furthest_step_id, session_token_hash, expires_at, created_at, updated_at)
    SELECT 'retention-many-' || n, ?, 'direct', 'desktop', ?, 'retention-hash-' || n, '2000-01-01T00:00:00.000Z', ?, ? FROM numbers`).bind(active.revisionId, f.route.id, now, now).run()
  await env.DB.prepare('UPDATE revision_metric_counters SET starts = starts + 1203, desktop_starts = desktop_starts + 1203 WHERE revision_id = ?').bind(active.revisionId).run()
  await env.DB.prepare('UPDATE revision_step_metric_counters SET reached = reached + 1203 WHERE revision_id = ? AND step_stable_id = ?').bind(active.revisionId, f.route.id).run()
  expect(await repository.foldExpiredSessions(now)).toBe(1000)
  expect((await Promise.all([repository.foldExpiredSessions(now), repository.foldExpiredSessions(now)])).sort()).toEqual([0, 203])
  expect(await env.DB.prepare('SELECT dropped FROM revision_step_metric_counters WHERE revision_id = ? AND step_stable_id = ?').bind(active.revisionId, f.route.id).first()).toEqual({ dropped: 1204 })
  expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM respondent_sessions WHERE revision_id = ?').bind(active.revisionId).first()).toEqual({ n: 1 })
}, 60000)

contract(['BASE-INPUT-001'], 'refuses malformed request boundaries without changing any current product data', async () => {
  const f = await fixture('input-boundary')
  const tables = ['workspaces', 'operators', 'flows', 'flow_revisions', 'flow_steps', 'choice_options', 'flow_branch_rules', 'respondent_sessions', 'respondent_session_step_events', 'responses', 'response_answers', 'response_outbox', 'revision_metric_counters', 'revision_step_metric_counters', 'audit_entries', 'auth_magic_links', 'local_dev_inbox', 'local_fixture_initializations']
  const snapshot = async () => (await env.DB.batch(tables.map(table => env.DB.prepare(`SELECT * FROM ${table} ORDER BY id`)))).map(result => result.results)
  const before = await snapshot()
  for (const [path, body, method] of [
    ['/api/app/flows', '{"private-secret":', 'POST'],
    [`${f.path}/draft`, JSON.stringify({ prompt: 'private-secret' }), 'PUT'],
    [`${f.path}/close`, JSON.stringify({ ignored: 'private-secret' }), 'POST'],
    [`${f.path}/draft/order`, JSON.stringify({ expectedVersion: 0, orderedStepIds: 'private-secret' }), 'PUT'],
    [`${f.path}/ledger?offset=Infinity&answerValue=private-secret`, undefined, 'GET'],
    [`/api/app/flows/${'x'.repeat(201)}/draft`, undefined, 'GET'],
    ['/api/public/flows/input-boundary/sessions', JSON.stringify({ deviceClass: 'private-secret' }), 'POST'],
    ['/auth/magic-link', JSON.stringify({ email: 'private-secret' }), 'POST'],
  ] as const) {
    const response = await SELF.fetch(`http://localhost${path}`, { method, headers: { Host: 'localhost', cookie, origin: 'http://localhost', 'content-type': 'application/json', 'CF-Connecting-IP': `192.0.2.${++serial}` }, ...(body === undefined ? {} : { body }) })
    expect(response.status).toBe(400)
    const error = await response.json()
    expect(error).toMatchObject({ error: 'VALIDATION_ERROR', message: expect.any(String) })
    expect(JSON.stringify(error)).not.toContain('private-secret')
    expect(await snapshot()).toEqual(before)
  }
}, 60000)

contract(['FLOW-008','FLOW-009','FLOW-017','FLOW-020','RESP-004','RESP-010','LEDG-004'], 'builds, previews, publishes and reports a branching form without preview effects; pins live revisions and exact answers', async () => {
  const f = await fixture('journey-branch')
  const sessionCount = await env.DB.prepare('SELECT count(*) AS n FROM respondent_sessions').first<{ n: number }>()
  const preview = await ok<{ path: unknown[] }>(`${f.path}/draft/preview`, { answers: { [f.route.id]: f.skip.id } })
  expect(JSON.stringify(preview)).not.toContain(f.detail.id)
  expect((await env.DB.prepare('SELECT count(*) AS n FROM respondent_sessions').first<{ n: number }>())?.n).toBe(sessionCount?.n)
  const old = await f.start(false, 'embed')
  const current = await f.draft()
  const update = { stepId: f.detail.id, prompt: 'Changed next publication', required: true, expectedVersion: current.flow.draftVersion }
  await ok(`${f.path}/draft`, update, 'PUT')
  expect(await ok(`${f.path}/draft`, update, 'PUT')).toMatchObject({ kind: 'conflict' })
  expect((await ok<PublicFlow>('/api/public/flows/journey-branch')).steps.find((s) => s.id === f.detail.id)?.prompt).toBe('Your exact words')
  const nextDraft = await f.draft()
  await ok(`${f.path}/publish`, { expectedVersion: nextDraft.flow.draftVersion })
  const newer = await f.start()
  expect(newer.revisionId).not.toBe(old.revisionId)
  const raw = '  Exact line one\n=literal, "quoted" 😀\nsecond line  '
  const answers = [{ stepId: f.route.id, value: f.more.id }, { stepId: f.detail.id, value: raw }]
  const completed = await f.submit(old, answers)
  expect(completed.status).toBe(201)
  const receipt = await completed.json<{ responseId: string }>()
  expect(await f.submit(old, answers).then((r) => r.json())).toMatchObject({ ...receipt, idempotent: true })
  expect(await env.DB.prepare('SELECT id FROM respondent_sessions WHERE id = ?').bind(old.sessionId).first()).toBeNull()
  expect(await env.DB.prepare('SELECT id FROM respondent_session_step_events WHERE session_id = ?').bind(old.sessionId).first()).toBeNull()
  expect(await env.DB.prepare('SELECT reached FROM revision_step_metric_counters WHERE revision_id = ? AND step_stable_id = ?').bind(old.revisionId, f.end.id).first()).toEqual({ reached: 1 })
  const ledger = await ok<{ total: number; responses: Array<{ answers: Array<{ label: string; value: unknown }>; source: string }> }>(`${f.path}/ledger?source=embed&revisionId=${old.revisionId}`)
  expect(ledger.total).toBe(1)
  expect(ledger.responses[0].source).toBe('embed')
  expect(ledger.responses[0].answers[1]).toMatchObject({ label: 'Your exact words', value: raw })
  expect(JSON.stringify(ledger)).not.toMatch(/sessionToken|sessionId|deviceClass|addressHash/)
  const exported = await ok<{ count: number; responses: typeof ledger.responses }>(`${f.path}/responses/export?revisionId=${old.revisionId}`)
  expect(exported.responses).toEqual(ledger.responses)
  const hidden = await f.submit(newer, [{ stepId: f.route.id, value: f.skip.id }, { stepId: f.detail.id, value: 'hidden answer' }], 'journey-hidden-key')
  expect(hidden.status).toBe(201)
  const hiddenReceipt = await hidden.json<{ responseId: string }>()
  expect(await env.DB.prepare('SELECT step_id FROM response_answers WHERE response_id = ?').bind(hiddenReceipt.responseId).all()).toMatchObject({ results: [{ step_id: f.route.id }] })

  const questions = await ok<Array<{ id: string; answered: number }>>(`${f.path}/questions?revisionId=${newer.revisionId}`)
  expect(questions.find((question) => question.id === f.detail.id)?.answered).toBe(0)
  const anonymous = await SELF.fetch(`http://localhost${f.path}/ledger`, { headers: { Host: 'localhost' } })
  expect(anonymous.status).toBe(401)
}, 60000)
contract(['RESP-017','RESP-018','LEDG-002'], 'quarantines fast submissions, excludes them from reporting, releases exactly once after closure, and erases rejected answers', async () => {
  const f = await fixture('journey-quarantine')
  const fast = await f.start(true)
  const completed = await f.submit(fast, [{ stepId: f.route.id, value: f.skip.id }])
  expect(completed.status).toBe(201)
  const receipt = await completed.json<{ responseId: string }>()
  expect(await ok(`${f.path}/ledger`)).toMatchObject({ total: 0, responses: [] })
  expect(await ok(`${f.path}/responses/export`)).toMatchObject({ excludedQuarantined: 1, responses: [] })
  await ok(`${f.path}/close`, {})
  const releases = await Promise.all([req(`/api/app/responses/${receipt.responseId}/release`, {}), req(`/api/app/responses/${receipt.responseId}/release`, {})])
  expect(releases.map((r) => r.status).sort()).toEqual([204, 404])
  expect(await env.DB.prepare("SELECT count(*) AS n FROM audit_entries WHERE subject_id = ? AND kind = 'response.quarantine-released'").bind(receipt.responseId).first()).toEqual({ n: 1 })
  expect(await env.DB.prepare('SELECT completions FROM revision_metric_counters WHERE revision_id = ?').bind(f.publicFlow.revision.id).first()).toEqual({ completions: 1 })
  expect(await env.DB.prepare('SELECT count(*) AS n FROM response_outbox WHERE response_id = ?').bind(receipt.responseId).first()).toEqual({ n: 1 })
  await ok(`${f.path}/reopen`, {})
  const reject = await f.start(true)
  const rejected = await f.submit(reject, [{ stepId: f.route.id, value: f.more.id }, { stepId: f.detail.id, value: 'private rejected words' }], 'rejected-idempotency')
  const rejectedReceipt = await rejected.json<{ responseId: string }>()
  expect((await req(`/api/app/responses/${rejectedReceipt.responseId}/quarantine`, undefined, 'DELETE')).status).toBe(204)
  expect(await env.DB.prepare('SELECT id FROM responses WHERE id = ?').bind(rejectedReceipt.responseId).first()).toBeNull()
  expect(await env.DB.prepare('SELECT id FROM response_answers WHERE response_id = ?').bind(rejectedReceipt.responseId).first()).toBeNull()
  expect(await env.DB.prepare("SELECT subject_id, details_json FROM audit_entries WHERE kind = 'response.quarantine-deleted'").all()).toMatchObject({ results: [{ subject_id: null, details_json: '{}' }] })
  expect(await ok(`${f.path}/ledger`)).toMatchObject({ total: 1 })
}, 60000)
contract(['RESP-009','FLOW-018'], 'admits only one released completion at a target of one, while retaining its replay after automatic closure', async () => {
  const f = await fixture('journey-target', 1)
  const sessions = await Promise.all([f.start(), f.start()])
  const answers = [{ stepId: f.route.id, value: f.skip.id }]
  const completed = await Promise.all(sessions.map((session) => f.submit(session, answers)))
  expect(completed.map((r) => r.status).sort()).toEqual([201, 409])
  const winner = completed.findIndex((r) => r.status === 201)
  expect((await f.submit(sessions[winner], answers)).status).toBe(201)
  expect(await ok(`${f.path}/ledger`)).toMatchObject({ total: 1 })
  expect(await env.DB.prepare('SELECT status FROM flows WHERE id = ?').bind(f.flow.id).first()).toEqual({ status: 'closed' })
}, 60000)
it('retains the authenticated completion receipt when another request removes a session between reads', async () => {
  for (const stage of ['receipt', 'session'] as const) {
    const f = await fixture(`journey-receipt-race-${stage}`)
    const session = await f.start()
    const answers = [{ stepId: f.route.id, value: f.skip.id }]
    const services = createPencilServices(createPencilPlatform('http://localhost', env))
    const method = stage === 'receipt' ? 'findResponseBySessionToken' : 'findSubmissionContext'
    const original = ResponseRepository.prototype[method]
    let intercepted = false
    let committed: { responseId: string } | undefined
    const spy = vi.spyOn(ResponseRepository.prototype, method).mockImplementation(async function (this: ResponseRepository, ...args: string[]) {
      const row = await (original as (...args: string[]) => Promise<unknown>).apply(this, args)
      if (!intercepted) {
        intercepted = true
        const response = await f.submit(session, answers)
        expect(response.status).toBe(201)
        committed = await response.json<{ responseId: string }>()
      }
      return row as never
    })
    try {
      const retry = await services.responses.submitPublicResponse({ slug: f.publicFlow.flow.slug, ...session, idempotencyKey: 'journey-idempotency-123', answers })
      expect(retry).toMatchObject({ responseId: committed!.responseId, idempotent: true, disposition: 'released', completionStepId: f.end.id })
      expect(await env.DB.prepare('SELECT completions FROM revision_metric_counters WHERE revision_id = ?').bind(session.revisionId).first()).toEqual({ completions: 1 })
      expect(await env.DB.prepare('SELECT count(*) AS n FROM response_outbox WHERE response_id = ?').bind(committed!.responseId).first()).toEqual({ n: 1 })
    } finally { spy.mockRestore() }
  }
}, 60000)
contract(['RESP-013','RESP-019'], 'rejects nonexistent and foreign-revision progress without changing counters or losing expiry drop-off', async () => {
  const f = await fixture('journey-progress-validation')
  const foreign = await fixture('journey-progress-foreign')
  const session = await f.start()
  const before = await env.DB.prepare('SELECT furthest_step_id FROM respondent_sessions WHERE id = ?').bind(session.sessionId).first()
  for (const stepId of ['nonexistent-step', foreign.route.id]) {
    expect((await req(`/api/public/flows/${f.publicFlow.flow.slug}/sessions/advance`, { ...session, stepId })).status).toBe(400)
    expect(await env.DB.prepare('SELECT furthest_step_id FROM respondent_sessions WHERE id = ?').bind(session.sessionId).first()).toEqual(before)
    expect(await env.DB.prepare('SELECT id FROM revision_step_metric_counters WHERE revision_id = ? AND step_stable_id = ?').bind(session.revisionId, stepId).first()).toBeNull()
  }
  expect((await req(`/api/public/flows/${foreign.publicFlow.flow.slug}/sessions/advance`, { ...session, stepId: f.detail.id })).status).toBe(400)
  expect((await req(`/api/public/flows/${f.publicFlow.flow.slug}/sessions/advance`, { ...session, sessionToken: 'x'.repeat(40), stepId: f.detail.id })).status).toBe(400)
  const repeated = await Promise.all(Array.from({ length: 3 }, () => req(`/api/public/flows/${f.publicFlow.flow.slug}/sessions/advance`, { ...session, stepId: f.detail.id })))
  expect(repeated.map((response) => response.status)).toEqual([204, 204, 204])
  expect(await env.DB.prepare('SELECT reached FROM revision_step_metric_counters WHERE revision_id = ? AND step_stable_id = ?').bind(session.revisionId, f.detail.id).first()).toEqual({ reached: 1 })
  await ok(`/api/public/flows/${f.publicFlow.flow.slug}/sessions/advance`, { ...session, stepId: f.route.id })
  const platform = createPencilPlatform('http://localhost', env)
  await env.DB.prepare('UPDATE respondent_sessions SET expires_at = ? WHERE id = ?').bind('2000-01-01T00:00:00.000Z', session.sessionId).run()
  const repository = new ResponseRepository(platform.database, env.DB)
  await repository.foldExpiredSessions(new Date().toISOString())
  expect(await env.DB.prepare('SELECT dropped FROM revision_step_metric_counters WHERE revision_id = ? AND step_stable_id = ?').bind(session.revisionId, f.route.id).first()).toEqual({ dropped: 1 })
}, 60000)
contract(['FLOW-015'], 'reorders stable choices without uniqueness collisions; rejects a conflicting writer and rolls back a failed structure write', async () => {
  const f = await fixture('journey-choice-edits')
  const draft = await f.draft()
  const choices = draft.choices.filter((choice) => choice.stepId === f.route.id).reverse().map((choice) => ({ id: choice.id, value: choice.value, label: `${choice.label} edited` }))
  const update = { stepId: f.route.id, prompt: f.route.prompt, required: true, questionType: 'single_choice', choices, expectedVersion: draft.flow.draftVersion }
  const writes = await Promise.all([req(`${f.path}/draft`, update, 'PUT'), req(`${f.path}/draft`, { ...update, prompt: 'Concurrent edit' }, 'PUT')])
  const outcomes = await Promise.all(writes.map((response) => response.json<{ kind: string }>()))
  expect(outcomes.map((result) => result.kind).sort()).toEqual(['conflict', 'updated'])
  const saved = await f.draft()
  expect(saved.choices.filter((choice) => choice.stepId === f.route.id).map((choice) => choice.id)).toEqual(choices.map((choice) => choice.id))
  expect(saved.branchRules[0].expectedValue).toBe(f.skip.id)
  const create = await Promise.all([req('/api/app/flows', { title: 'Concurrent new', slug: 'journey-concurrent-create' }), req('/api/app/flows', { title: 'Concurrent new', slug: 'journey-concurrent-create' })])
  expect(create.map((result) => result.status).sort()).toEqual([201, 400])
  expect(await env.DB.prepare("SELECT count(*) AS n FROM flow_revisions r JOIN flows f ON f.id = r.flow_id WHERE f.slug = 'journey-concurrent-create'").first()).toEqual({ n: 1 })
  // Force a database constraint failure after the flow insert; D1 must roll the entire graph back.
  const { createFlowStructure } = await import('../../src/core/features/flows/structure')
  const now = new Date().toISOString()
  const workspace = await ok<{ id: string }>('/api/app/workspace')
  await expect(createFlowStructure(env.DB, { flow: { id: 'rollback-flow', workspaceId: workspace.id, slug: 'rollback-flow', title: 'Rollback', status: 'draft', draftVersion: 0, createdAt: now, updatedAt: now, lastActivityAt: now }, revision: { id: 'rollback-revision', flowId: 'rollback-flow', number: 1, state: 'draft', title: 'Rollback', createdAt: now, updatedAt: now }, steps: [{ id: 'bad-step', stableId: 'bad-stable', revisionId: 'rollback-revision', position: 0, kind: 'invalid' as never, prompt: 'Invalid', required: false, createdAt: now, updatedAt: now }] })).rejects.toThrow()
  expect(await env.DB.prepare("SELECT id FROM flows WHERE id = 'rollback-flow'").first()).toBeNull()
  expect(await env.DB.prepare("SELECT id FROM flow_revisions WHERE id = 'rollback-revision'").first()).toBeNull()
}, 60000)
contract(['DATA-002','BASE-DATA-003'], 'erases released data exactly once, recomputes reports, removes receipts/effects and keeps closed admission closed', async () => {
  const f = await fixture('journey-erasure', 1)
  const session = await f.start()
  const answers = [{ stepId: f.route.id, value: f.more.id }, { stepId: f.detail.id, value: 'Sensitive synthetic erasure words' }]
  const admitted = await f.submit(session, answers)
  expect(admitted.status).toBe(201)
  const receipt = await admitted.json<{ responseId: string }>()
  const path = `/api/app/responses/${receipt.responseId}`
  expect((await SELF.fetch(`http://localhost${path}`, { method: 'DELETE', headers: { Host: 'localhost' } })).status).toBe(401)
  expect((await SELF.fetch(`http://localhost${path}`, { method: 'DELETE', headers: { Host: 'localhost', cookie, origin: 'https://untrusted.invalid' } })).status).toBe(403)
  const platform = createPencilPlatform('http://localhost', env)
  const repository = new ResponseRepository(platform.database, env.DB)
  expect(await repository.eraseReleasedResponse({ workspaceId: 'foreign-workspace', responseId: receipt.responseId, operatorId: 'wrong-operator', now: new Date().toISOString() })).toBe(false)
  expect(await ok(`${f.path}/ledger`)).toMatchObject({ total: 1 })
  const priorAudits = await env.DB.prepare("SELECT id FROM audit_entries WHERE kind = 'response.erased'").all<{ id: string }>()
  const erased = await Promise.all([req(path, undefined, 'DELETE'), req(path, undefined, 'DELETE')])
  expect(erased.map((response) => response.status).sort()).toEqual([204, 404])
  for (const [table, key, id] of [['responses', 'id', receipt.responseId], ['response_answers', 'response_id', receipt.responseId], ['response_outbox', 'response_id', receipt.responseId], ['respondent_sessions', 'id', session.sessionId], ['respondent_session_step_events', 'session_id', session.sessionId]]) {
    expect(await env.DB.prepare(`SELECT count(*) AS n FROM ${table} WHERE ${key} = ?`).bind(id).first()).toEqual({ n: 0 })
  }
  const afterAudits = await env.DB.prepare("SELECT id, subject_id, details_json FROM audit_entries WHERE kind = 'response.erased'").all<{ id: string; subject_id: string | null; details_json: string }>()
  expect(afterAudits.results.filter((entry) => !priorAudits.results.some((prior) => prior.id === entry.id))).toEqual([{ id: expect.any(String), subject_id: null, details_json: '{}' }])
  expect(priorAudits.results.every((prior) => afterAudits.results.some((entry) => entry.id === prior.id))).toBe(true)
  expect(await env.DB.prepare('SELECT id FROM audit_entries WHERE subject_id = ? OR details_json LIKE ?').bind(receipt.responseId, `%${receipt.responseId}%`).first()).toBeNull()
  expect(await env.DB.prepare('SELECT completions, total_completion_milliseconds, starts FROM revision_metric_counters WHERE revision_id = ?').bind(session.revisionId).first()).toEqual({ completions: 0, total_completion_milliseconds: 0, starts: 1 })
  expect(await ok(`${f.path}/ledger`)).toMatchObject({ total: 0, responses: [] })
  expect(await ok(`${f.path}/responses/export`)).toMatchObject({ responses: [] })
  expect((await ok<Array<{ answered: number }>>(`${f.path}/questions?revisionId=${session.revisionId}`)).every((question) => question.answered === 0)).toBe(true)
  expect(await env.DB.prepare('SELECT status FROM flows WHERE id = ?').bind(f.flow.id).first()).toEqual({ status: 'closed' })
  expect((await f.submit(session, answers)).status).toBe(400)
}, 60000)

it('keeps released responses while erasing operator custody and prevents delayed response/reopen actions from resurrecting it', async () => {
  const platform = createPencilPlatform('http://localhost', env)
  const owner = await env.DB.prepare('SELECT id, workspace_id FROM operators WHERE email = ?').bind('owner@aurora-coffee.test').first<{ id: string; workspace_id: string }>()
  const auth = new AuthRepository(platform.database, createD1BatchExecutor(env.DB))
  for (const action of ['release', 'delete', 'erase', 'reopen'] as const) {
    const f = await fixture(`operator-late-${action}`)
    const session = await f.start(action !== 'erase')
    const receipt = await (await f.submit(session, [{ stepId: f.route.id, value: f.skip.id }])).json<{ responseId: string }>()
    const actorId = `late-actor-${action}`
    const now = new Date().toISOString()
    await env.DB.prepare('INSERT INTO operators (id, workspace_id, email, display_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').bind(actorId, owner!.workspace_id, `${actorId}@example.test`, 'Erased actor', now, now).run()
    if (action === 'erase') {
      await env.DB.prepare('UPDATE responses SET released_by_operator_id = ? WHERE id = ?').bind(actorId, receipt.responseId).run()
    }
    if (action === 'reopen') await ok(`${f.path}/close`, {})
    let removed = false
    // This is the exact batch handoff after the normal service precheck: let
    // operator removal commit before resuming the already prepared mutation.
    const delayedBinding = new Proxy(env.DB, {
      get(target, key) {
        if (key === 'batch') return async (statements: D1PreparedStatement[]) => {
          expect(await auth.removeOperator({ workspaceId: owner!.workspace_id, actorOperatorId: owner!.id, targetOperatorId: actorId })).toBe('removed')
          removed = true
          const preserved = await env.DB.prepare('SELECT id, released_by_operator_id FROM responses WHERE id = ?').bind(receipt.responseId).first()
          expect(preserved).toEqual({ id: receipt.responseId, released_by_operator_id: null })
          return target.batch(statements)
        }
        const value = Reflect.get(target, key, target)
        return typeof value === 'function' ? value.bind(target) : value
      },
    })
    const repository = new ResponseRepository(platform.database, delayedBinding)
    const input = { workspaceId: owner!.workspace_id, responseId: receipt.responseId, operatorId: actorId, now }
    const changed = action === 'release' ? await repository.releaseQuarantinedResponse(input)
      : action === 'delete' ? await repository.deleteQuarantinedResponse(input)
      : action === 'erase' ? await repository.eraseReleasedResponse(input)
      : await new FlowRepository(platform.database, delayedBinding).reopenFlow(f.flow.id, now, actorId)
    expect(changed).toBe(true)
    expect(removed).toBe(true)
    expect(await env.DB.prepare('SELECT id FROM audit_entries WHERE actor_operator_id = ?').bind(actorId).first()).toBeNull()
    expect(await env.DB.prepare('SELECT id FROM responses WHERE released_by_operator_id = ?').bind(actorId).first()).toBeNull()
    if (action === 'release') expect(await ok(`${f.path}/results`)).toMatchObject({ completedResponses: 1 })
    if (action === 'reopen') expect(await ok<PublicFlow>(`/api/public/flows/operator-late-reopen`)).toMatchObject({ flow: { id: f.flow.id } })
  }
}, 60000)

contract('RESP-012', 'retains the committed completion across changed-answer retries, pinned revisions and removal of the session', async () => {
  const f = await fixture('journey-completion-retry')
  let current = await f.draft()
  await ok(`${f.path}/draft/steps`, { expectedVersion: current.flow.draftVersion, step: { kind: 'completion', questionType: null, prompt: 'Alternate completion B' } })
  current = await f.draft()
  const alternate = current.steps.find((step) => step.prompt === 'Alternate completion B')!
  await ok(`${f.path}/draft/branches`, { expectedVersion: current.flow.draftVersion, rules: [{ sourceStepId: f.route.id, predicateKind: 'equals', expectedValue: f.skip.id, destinationStepId: alternate.id, position: 0 }] }, 'PUT')
  current = await f.draft()
  await ok(`${f.path}/publish`, { expectedVersion: current.flow.draftVersion })
  const session = await f.start()
  const original = [{ stepId: f.route.id, value: f.more.id }, { stepId: f.detail.id, value: 'Original committed path A' }]
  const changed = [{ stepId: f.route.id, value: f.skip.id }]
  const committed = await f.submit(session, original)
  expect(committed.status).toBe(201)
  const receipt = await committed.json<{ responseId: string; completionStepId: string }>()
  expect(receipt).toMatchObject({ completionStepId: f.end.id, disposition: 'released', idempotent: false })
  expect(await env.DB.prepare('SELECT id FROM respondent_sessions WHERE id = ?').bind(session.sessionId).first()).toBeNull()
  // Publish another current graph; the original receipt still uses its pinned graph.
  current = await f.draft()
  await ok(`${f.path}/publish`, { expectedVersion: current.flow.draftVersion })
  const newer = await f.start()
  expect(newer.revisionId).not.toBe(session.revisionId)
  const retry = await f.submit(session, changed)
  expect(retry.status).toBe(201)
  expect(await retry.json()).toEqual({ ...receipt, idempotent: true })
  expect((await f.submit(session, changed, 'different-key-is-refused')).status).toBe(400)
  const other = await ok<{ id: string }>('/api/app/flows', { title: 'Another actual flow', slug: 'journey-completion-wrong-slug' })
  expect(other.id).not.toBe(f.flow.id)
  expect((await req('/api/public/flows/journey-completion-wrong-slug/responses', { ...session, answers: changed, idempotencyKey: 'journey-idempotency-123' })).status).toBe(404)
  expect(await env.DB.prepare('SELECT completions FROM revision_metric_counters WHERE revision_id = ?').bind(session.revisionId).first()).toEqual({ completions: 1 })
  expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM response_outbox WHERE response_id = ?').bind(receipt.responseId).first()).toEqual({ n: 1 })
  expect(await env.DB.prepare('SELECT value_json FROM response_answers WHERE response_id = ? AND step_id = ?').bind(receipt.responseId, f.route.id).first()).toEqual({ value_json: JSON.stringify(f.more.id) })
  const second = await f.submit(newer, changed)
  expect(second.status).toBe(201)
  const secondReceipt = await second.json<{ responseId: string; completionStepId: string }>()
  expect(secondReceipt).toMatchObject({ completionStepId: alternate.id, idempotent: false })
  expect(secondReceipt.responseId).not.toBe(receipt.responseId) // Same key is independently scoped to this session/revision.
  expect(await env.DB.prepare('SELECT completions FROM revision_metric_counters WHERE revision_id = ?').bind(newer.revisionId).first()).toEqual({ completions: 1 })
  const racing = await f.start()
  const attempts = await Promise.all([f.submit(racing, original, 'shared-racing-receipt'), f.submit(racing, changed, 'shared-racing-receipt')])
  expect(attempts.map((result) => result.status)).toEqual([201, 201])
  const racingReceipts = await Promise.all(attempts.map((result) => result.json<{ responseId: string; completionStepId: string; idempotent: boolean }>()))
  expect(racingReceipts[0].responseId).toBe(racingReceipts[1].responseId)
  expect(racingReceipts.map((result) => result.idempotent).sort()).toEqual([false, true])
  const chosen = await env.DB.prepare('SELECT value_json FROM response_answers WHERE response_id = ? AND step_id = ?').bind(racingReceipts[0].responseId, f.route.id).first<{ value_json: string }>()
  const expectedCompletion = chosen!.value_json === JSON.stringify(f.more.id) ? f.end.id : alternate.id
  expect(racingReceipts.map((result) => result.completionStepId)).toEqual([expectedCompletion, expectedCompletion])
  expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM response_outbox WHERE response_id = ?').bind(racingReceipts[0].responseId).first()).toEqual({ n: 1 })
  expect(await env.DB.prepare('SELECT completions FROM revision_metric_counters WHERE revision_id = ?').bind(newer.revisionId).first()).toEqual({ completions: 2 })
}, 60000)

it('fails receipt derivation safely when erasure removes retained evidence between reads', async () => {
  const f = await fixture('journey-completion-erased')
  const session = await f.start()
  const answers = [{ stepId: f.route.id, value: f.skip.id }]
  const receipt = await (await f.submit(session, answers)).json<{ responseId: string }>()
  const original = ResponseRepository.prototype.getRetainedResponseAnswers
  const spy = vi.spyOn(ResponseRepository.prototype, 'getRetainedResponseAnswers').mockImplementationOnce(async function (responseId) {
    await ok(`/api/app/responses/${receipt.responseId}`, undefined, 'DELETE')
    return original.call(this, responseId)
  })
  try {
    const retry = await f.submit(session, answers)
    expect(retry.status).toBe(404)
    expect(await retry.json()).toMatchObject({ error: 'NOT_FOUND' })
    expect(await env.DB.prepare('SELECT id FROM response_outbox WHERE response_id = ?').bind(receipt.responseId).first()).toBeNull()
    expect(await env.DB.prepare('SELECT id FROM response_answers WHERE response_id = ?').bind(receipt.responseId).first()).toBeNull()
    expect(await env.DB.prepare('SELECT completions FROM revision_metric_counters WHERE revision_id = ?').bind(session.revisionId).first()).toEqual({ completions: 0 })
  } finally { spy.mockRestore() }
}, 60000)

it('replays historically accepted whitespace text without applying newer admission validation', async () => {
  const f = await fixture('journey-completion-historical')
  const session = await f.start()
  const answers = [{ stepId: f.route.id, value: f.more.id }, { stepId: f.detail.id, value: 'Historical accepted answer' }]
  const receipt = await (await f.submit(session, answers)).json<{ responseId: string }>()
  // Retained prior-version evidence: earlier admission accepted whitespace text.
  await env.DB.prepare('UPDATE response_answers SET value_json = ? WHERE response_id = ? AND step_id = ?').bind(JSON.stringify('   '), receipt.responseId, f.detail.id).run()
  const snapshot = async () => (await env.DB.batch([
    env.DB.prepare('SELECT * FROM responses WHERE id = ?').bind(receipt.responseId),
    env.DB.prepare('SELECT * FROM response_answers WHERE response_id = ? ORDER BY id').bind(receipt.responseId),
    env.DB.prepare('SELECT * FROM revision_metric_counters WHERE revision_id = ?').bind(session.revisionId),
    env.DB.prepare('SELECT * FROM response_outbox WHERE response_id = ? ORDER BY id').bind(receipt.responseId),
  ])).map((result) => result.results)
  const before = await snapshot()
  const retry = await f.submit(session, [{ stepId: f.route.id, value: f.skip.id }])
  expect(retry.status).toBe(201)
  expect(await retry.json()).toMatchObject({ responseId: receipt.responseId, completionStepId: f.end.id, idempotent: true, disposition: 'released' })
  expect(await snapshot()).toEqual(before)
}, 60000)


contract('FLOW-004', 'persists field-valid incomplete edits, returns the exact conflict version and retains the winning bytes across fresh reads', async () => {
  const f = await fixture('saved-draft-version')
  const before = await f.draft()
  const incomplete = { stepId: f.route.id, prompt: 'Saved incomplete question', required: false, nextStepId: null, expectedVersion: before.flow.draftVersion }
  const accepted = await ok<{ kind: string; draftVersion: number }>(`${f.path}/draft`, incomplete, 'PUT')
  expect(accepted).toEqual(expect.objectContaining({ kind: 'updated', draftVersion: before.flow.draftVersion + 1 }))
  expect(await f.draft()).toMatchObject({ flow: { draftVersion: accepted.draftVersion }, steps: expect.arrayContaining([expect.objectContaining({ id: f.route.id, prompt: incomplete.prompt, required: false, nextStepId: null })]) })
  expect((await req(`${f.path}/publish`, { expectedVersion: accepted.draftVersion })).status).toBe(400)
  const snapshot = async () => (await env.DB.batch([
    env.DB.prepare('SELECT * FROM flows WHERE id = ?').bind(f.flow.id),
    env.DB.prepare('SELECT * FROM flow_steps WHERE revision_id = ? ORDER BY id').bind(before.revision.id),
    env.DB.prepare('SELECT * FROM choice_options WHERE step_id IN (SELECT id FROM flow_steps WHERE revision_id = ?) ORDER BY id').bind(before.revision.id),
  ])).map(result => result.results)
  const winner = await snapshot()
  expect(await ok(`${f.path}/draft`, { ...incomplete, prompt: 'Stale replacement' }, 'PUT')).toEqual({ kind: 'conflict', latestVersion: accepted.draftVersion })
  expect(await snapshot()).toEqual(winner)
  for (let i = 0; i < 3; i++) {
    const current = await f.draft()
    const change = { ...incomplete, prompt: `Version ${current.flow.draftVersion + 1}`, expectedVersion: current.flow.draftVersion }
    const [read, write] = await Promise.all([f.draft(), ok(`${f.path}/draft`, change, 'PUT')])
    expect(write).toMatchObject({ kind: 'updated', draftVersion: change.expectedVersion + 1 })
    const observed = read.steps.find(step => step.id === f.route.id)!
    expect(observed.prompt).toBe(read.flow.draftVersion === current.flow.draftVersion ? current.steps.find(step => step.id === f.route.id)!.prompt : change.prompt)
    expect([current.flow.draftVersion, current.flow.draftVersion + 1]).toContain(read.flow.draftVersion)
  }
  const oldChoices = await f.draft()
  const kept = oldChoices.choices.find(choice => choice.id === f.more.id)!
  await ok(`${f.path}/draft`, { ...incomplete, expectedVersion: oldChoices.flow.draftVersion, choices: [{ id: kept.id, value: kept.value, label: kept.label }] }, 'PUT')
  const changedChoices = await snapshot()
  const obsoleteChoices = oldChoices.choices.filter(choice => choice.stepId === f.route.id).map(choice => ({ id: choice.id, value: choice.value, label: choice.label }))
  expect(await ok(`${f.path}/draft`, { ...incomplete, expectedVersion: oldChoices.flow.draftVersion, choices: obsoleteChoices }, 'PUT')).toEqual({ kind: 'conflict', latestVersion: oldChoices.flow.draftVersion + 1 })
  expect(await snapshot()).toEqual(changedChoices)
})

contract('FLOW-007', 'previews the current draft and incomplete branches with test answers while preserving every product record and effect', async () => {
  const f = await fixture('preview-read-only')
  const published = await f.start()
  await f.submit(published, [{ stepId: f.route.id, value: f.skip.id }])
  let draft = await f.draft()
  await ok(`${f.path}/draft`, { stepId: f.detail.id, prompt: 'Only in the editable draft', required: true, nextStepId: f.end.id, expectedVersion: draft.flow.draftVersion }, 'PUT')
  draft = await f.draft()
  await ok(`${f.path}/draft/steps`, { expectedVersion: draft.flow.draftVersion, step: { kind: 'completion', questionType: null, prompt: 'Preview-only completion' } })
  draft = await f.draft()
  const previewOnly = draft.steps.find(step => step.prompt === 'Preview-only completion')!
  await ok(`${f.path}/draft/branches`, { expectedVersion: draft.flow.draftVersion, rules: [{ sourceStepId: f.route.id, predicateKind: 'equals', expectedValue: f.skip.id, destinationStepId: previewOnly.id, position: 0 }] }, 'PUT')
  draft = await f.draft()
  const unchangedPublic = await ok<PublicFlow>('/api/public/flows/preview-read-only')
  expect(unchangedPublic.steps.some(step => step.id === previewOnly.id)).toBe(false)
  expect(unchangedPublic.branchRules[0].destinationStepId).toBe(f.end.id)
  const tables = ['workspaces', 'operators', 'flows', 'flow_revisions', 'flow_steps', 'choice_options', 'flow_branch_rules', 'respondent_sessions', 'respondent_session_step_events', 'responses', 'response_answers', 'response_outbox', 'revision_metric_counters', 'revision_step_metric_counters', 'audit_entries', 'auth_magic_links', 'local_dev_inbox', 'local_fixture_initializations']
  const snapshot = async () => (await env.DB.batch(tables.map(table => env.DB.prepare(`SELECT * FROM ${table} ORDER BY id`)))).map(result => result.results)
  const before = await snapshot()
  const short = await ok<{ preview: true; draftVersion: number; complete: boolean; screens: Array<{ stepId: string }> }>(`${f.path}/draft/preview`, { answers: { [f.route.id]: f.skip.id } })
  expect(short).toMatchObject({ preview: true, draftVersion: draft.flow.draftVersion, complete: true })
  expect(short.screens.map(screen => screen.stepId)).toEqual([f.route.id, previewOnly.id])
  const long = await ok<typeof short>(`${f.path}/draft/preview`, { answers: { [f.route.id]: f.more.id, [f.detail.id]: 'Synthetic preview only' } })
  expect(long).toMatchObject({ preview: true, draftVersion: draft.flow.draftVersion, complete: true })
  expect(long.screens.map(screen => screen.stepId)).toEqual([f.route.id, f.detail.id, f.end.id])
  expect(await snapshot()).toEqual(before)
  await ok(`${f.path}/draft`, { stepId: f.detail.id, prompt: 'Unconnected draft screen', required: true, nextStepId: null, expectedVersion: draft.flow.draftVersion }, 'PUT')
  draft = await f.draft()
  const incomplete = await snapshot()
  expect(await ok(`${f.path}/draft/preview`, { answers: { [f.route.id]: f.more.id, [f.detail.id]: 'Still no effects' } })).toMatchObject({ preview: true, draftVersion: draft.flow.draftVersion, complete: false, reason: 'The selected path does not reach a completion screen.' })
  expect(await snapshot()).toEqual(incomplete)
})

async function assertSnapshotConflict(operation: 'step' | 'branches' | 'publish') {
  const f = await fixture(`saved-interleave-${operation}`)
  const before = await f.draft()
  const snapshot = async () => (await env.DB.batch([
    env.DB.prepare('SELECT * FROM flows WHERE id = ?').bind(f.flow.id),
    env.DB.prepare('SELECT * FROM flow_revisions WHERE flow_id = ? ORDER BY id').bind(f.flow.id),
    env.DB.prepare('SELECT * FROM flow_steps WHERE revision_id IN (SELECT id FROM flow_revisions WHERE flow_id = ?) ORDER BY id').bind(f.flow.id),
    env.DB.prepare('SELECT * FROM choice_options WHERE step_id IN (SELECT id FROM flow_steps WHERE revision_id IN (SELECT id FROM flow_revisions WHERE flow_id = ?)) ORDER BY id').bind(f.flow.id),
    env.DB.prepare('SELECT * FROM flow_branch_rules WHERE revision_id IN (SELECT id FROM flow_revisions WHERE flow_id = ?) ORDER BY id').bind(f.flow.id),
  ])).map(result => result.results)
  let winner: Awaited<ReturnType<typeof snapshot>> | undefined
  const original = FlowRepository.prototype.getWorkspaceDraftSnapshot
  const gate = vi.spyOn(FlowRepository.prototype, 'getWorkspaceDraftSnapshot').mockImplementationOnce(async function (...args) {
    const read = await original.apply(this, args)
    const retained = before.choices.find(choice => choice.id === f.more.id)!
    await ok(`${f.path}/draft`, { stepId: f.route.id, prompt: 'Winning choice removal', required: true, expectedVersion: before.flow.draftVersion, choices: [{ id: retained.id, value: retained.value, label: retained.label }] }, 'PUT')
    winner = await snapshot()
    return read
  })
  try {
    const stale = operation === 'step'
      ? await ok(`${f.path}/draft`, { stepId: f.route.id, prompt: 'Stale choices', required: true, expectedVersion: before.flow.draftVersion, choices: before.choices.filter(choice => choice.stepId === f.route.id).map(choice => ({ id: choice.id, value: choice.value, label: choice.label })) }, 'PUT')
      : operation === 'branches'
        ? await ok(`${f.path}/draft/branches`, { expectedVersion: before.flow.draftVersion, rules: before.branchRules }, 'PUT')
        : await ok(`${f.path}/publish`, { expectedVersion: before.flow.draftVersion })
    expect(stale).toEqual({ kind: 'conflict', latestVersion: before.flow.draftVersion + 1 })
    expect(winner).toBeDefined()
    expect(await snapshot()).toEqual(winner)
  } finally { gate.mockRestore() }
}

contract('FLOW-004', 'returns the latest step-edit conflict after a post-snapshot winner and preserves its graph', () => assertSnapshotConflict('step'))
contract('FLOW-004', 'returns the latest branch-edit conflict after a post-snapshot winner and preserves its graph', () => assertSnapshotConflict('branches'))
contract('FLOW-004', 'returns the latest publication conflict after a post-snapshot winner and preserves its graph', () => assertSnapshotConflict('publish'))

contract('RESP-014', 'rolls a failed final transaction back completely and commits one original-key retry without partial answers or effects', async () => {
  const f = await fixture('final-write-failure')
  const session = await f.start()
  const answers = [{ stepId: f.route.id, value: f.more.id }, { stepId: f.detail.id, value: 'Exact retained browser answer' }]
  const tables = ['flows', 'flow_revisions', 'respondent_sessions', 'respondent_session_step_events', 'responses', 'response_answers', 'response_outbox', 'revision_metric_counters', 'revision_step_metric_counters', 'audit_entries']
  const snapshot = async () => (await env.DB.batch(tables.map(table => env.DB.prepare(`SELECT * FROM ${table} ORDER BY id`)))).map(result => result.results)
  const before = await snapshot()
  // Abort the last session deletion after the preceding response/answer/outbox/
  // counter statements. The actual D1 batch must roll every one back.
  await env.DB.prepare(`CREATE TRIGGER final_transaction_abort BEFORE DELETE ON respondent_sessions WHEN OLD.id = '${session.sessionId}' BEGIN SELECT RAISE(ABORT, 'synthetic final transaction failure'); END`).run()
  try {
    const failed = await f.submit(session, answers, 'original-uncommitted-final-key')
    expect(failed.status).toBe(500)
    expect(await failed.json()).toEqual({ error: 'INTERNAL_ERROR', message: 'The request could not be completed. Retry or inspect deployment health.' })
    expect(await snapshot()).toEqual(before)
  } finally { await env.DB.prepare('DROP TRIGGER final_transaction_abort').run() }
  const retry = await f.submit(session, answers, 'original-uncommitted-final-key')
  expect(retry.status).toBe(201)
  const receipt = await retry.json<{ responseId: string; completionStepId: string }>()
  expect(receipt).toMatchObject({ idempotent: false, disposition: 'released', completionStepId: f.end.id })
  expect(await env.DB.prepare('SELECT step_id, value_json FROM response_answers WHERE response_id = ? ORDER BY step_id').bind(receipt.responseId).all()).toMatchObject({ results: answers.map(answer => ({ step_id: answer.stepId, value_json: JSON.stringify(answer.value) })).sort((a, b) => a.step_id.localeCompare(b.step_id)) })
  expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM responses WHERE revision_id = ?').bind(session.revisionId).first()).toEqual({ n: 1 })
  expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM response_outbox WHERE response_id = ?').bind(receipt.responseId).first()).toEqual({ n: 1 })
  expect(await env.DB.prepare('SELECT completions FROM revision_metric_counters WHERE revision_id = ?').bind(session.revisionId).first()).toEqual({ completions: 1 })
})

contract(['FLOW-021','RSLT-005'], 'compares only matching stable questions and each published revision owns its labels, denominators and erased/quarantined evidence', async () => {
  const f = await fixture('report-revision-comparison')
  const old = await f.start()
  const oldText = 'Private first-revision answer'
  await f.submit(old, [{ stepId: f.route.id, value: f.more.id }, { stepId: f.detail.id, value: oldText }])
  let draft = await f.draft()
  const changed = draft.choices.filter(choice => choice.stepId === f.route.id).map(choice => ({ id: choice.id, value: choice.value, label: choice.id === f.more.id ? 'Continue now' : choice.label }))
  await ok(`${f.path}/draft`, { stepId: f.route.id, prompt: f.route.prompt, required: true, expectedVersion: draft.flow.draftVersion, choices: changed }, 'PUT')
  draft = await f.draft()
  await ok(`${f.path}/draft/steps`, { expectedVersion: draft.flow.draftVersion, step: { kind: 'question', questionType: 'rating', prompt: f.route.prompt, required: false, questionSettings: { min: 1, max: 5 } } })
  draft = await f.draft()
  const added = draft.steps.find(step => step.questionType === 'rating')!
  expect(added.id).not.toBe(f.route.id)
  await ok(`${f.path}/publish`, { expectedVersion: draft.flow.draftVersion })
  const newer = await f.start()
  const newText = 'Private second-revision answer'
  const released = await f.submit(newer, [{ stepId: f.route.id, value: f.more.id }, { stepId: f.detail.id, value: newText }, { stepId: added.id, value: 4 }])
  const receipt = await released.json<{ responseId: string }>()
  const fast = await f.start(true)
  const quarantine = await (await f.submit(fast, [{ stepId: f.route.id, value: f.skip.id }])).json<{ responseId: string }>()
  type Compare = { revisions: Array<{ id: string; number: number }>; questions: Array<{ id: string; answered: number; eligibleResponses: number; versions: Array<{ revisionId: string; eligibleResponses: number; prompt: string; answered: number; distribution: Array<{ label: string; value: unknown; count: number }> }> }> }
  const compare = () => ok<Compare>(`${f.path}/questions/compare`)
  const snapshot = async () => (await env.DB.batch(['responses', 'response_answers', 'response_outbox', 'revision_metric_counters', 'revision_step_metric_counters', 'audit_entries'].map(table => env.DB.prepare(`SELECT * FROM ${table} ORDER BY id`)))).map(result => result.results)
  const before = await snapshot()
  const report = await compare()
  expect(await snapshot()).toEqual(before)
  expect(report.revisions.map(revision => revision.id)).toEqual([newer.revisionId, old.revisionId])
  const originalQuestion = report.questions.find(question => question.id === f.route.id)!
  expect(originalQuestion.versions.map(version => [version.revisionId, version.answered])).toEqual([[newer.revisionId, 1], [old.revisionId, 1]])
  expect(originalQuestion.versions[0].distribution).toContainEqual({ value: f.more.id, label: 'Continue now', count: 1 })
  expect(originalQuestion.versions[1].distribution).toContainEqual({ value: f.more.id, label: 'Tell us more', count: 1 })
  const addedQuestion = report.questions.find(question => question.id === added.id)!
  expect(addedQuestion).toMatchObject({ answered: 1, eligibleResponses: 1 })
  expect(addedQuestion.versions).toHaveLength(1)
  expect(addedQuestion.versions[0]).toMatchObject({ revisionId: newer.revisionId, prompt: f.route.prompt, answered: 1, distribution: [{ value: 4, label: '4', count: 1 }] })
  expect(report.questions.filter(question => question.versions[0].prompt === f.route.prompt)).toHaveLength(2)
  for (const secret of [oldText, newText, receipt.responseId, quarantine.responseId, old.sessionToken, newer.sessionToken]) expect(JSON.stringify(report)).not.toContain(secret)
  await ok(`/api/app/responses/${quarantine.responseId}/release`, {})
  const afterRelease = await compare()
  expect(afterRelease.questions.find(question => question.id === f.route.id)!.versions[0]).toMatchObject({ answered: 2, eligibleResponses: 2 })
  expect(afterRelease.questions.find(question => question.id === added.id)).toMatchObject({ answered: 1, eligibleResponses: 2 })
  expect(afterRelease.questions.find(question => question.id === f.route.id)!.versions[1]).toMatchObject({ answered: 1 })
  await ok(`/api/app/responses/${receipt.responseId}`, undefined, 'DELETE')
  const afterErasure = await compare()
  expect(afterErasure.questions.find(question => question.id === f.route.id)!.versions[0]).toMatchObject({ answered: 1 })
  expect(afterErasure.questions.find(question => question.id === added.id)!.versions[0]).toMatchObject({ answered: 0, eligibleResponses: 1, distribution: [] })
  expect(afterErasure.questions.find(question => question.id === added.id)!.versions).toHaveLength(1)
  expect((await SELF.fetch(`http://localhost${f.path}/questions/compare`, { headers: { Host: 'localhost' } })).status).toBe(401)
  const services = createPencilServices(createPencilPlatform('http://localhost', env))
  await expect(services.reporting.compareRevisions('foreign-workspace', f.flow.id)).rejects.toThrow('not available in your workspace')
  expect((await req('/api/app/flows/missing-comparison-flow/questions/compare')).status).toBe(404)
}, 60000)

contract(['RESP-015'], 'names unavailable sessions without partial effects, distinguishes invalid steps, and admits an explicit fresh response with the original key', async () => {
  const f = await fixture('session-restart-runtime')
  const old = await f.start()
  const answers = [{ stepId: f.route.id, value: f.skip.id }]
  const tables = ['responses', 'response_answers', 'response_outbox', 'revision_metric_counters', 'revision_step_metric_counters', 'respondent_session_step_events']
  const snapshot = async () => (await env.DB.batch(tables.map(table => env.DB.prepare(`SELECT * FROM ${table} ORDER BY id`)))).map(result => result.results)
  const before = await snapshot()
  const invalidStep = await req('/api/public/flows/session-restart-runtime/sessions/advance', { ...old, stepId: 'outside-this-graph' })
  expect(invalidStep.status).toBe(400)
  expect(await invalidStep.json()).toEqual({ error: 'VALIDATION_ERROR', message: 'This screen is not part of your response session.' })
  expect(await snapshot()).toEqual(before)
  await env.DB.prepare('UPDATE respondent_sessions SET expires_at = ? WHERE id = ?').bind('2000-01-01T00:00:00.000Z', old.sessionId).run()
  const unavailable = { error: 'SESSION_UNAVAILABLE', message: 'This response session has expired or is no longer available. Start again to answer the current form.' }
  const expiredAdvance = await req('/api/public/flows/session-restart-runtime/sessions/advance', { ...old, stepId: f.detail.id })
  expect(expiredAdvance.status).toBe(400); expect(await expiredAdvance.json()).toEqual(unavailable)
  const expiredFinal = await f.submit(old, answers, 'original-restart-key')
  expect(expiredFinal.status).toBe(400); expect(await expiredFinal.json()).toEqual(unavailable)
  const unrecognised = await f.submit({ ...old, sessionToken: 'b'.repeat(64) }, answers, 'original-restart-key')
  expect(unrecognised.status).toBe(400); expect(await unrecognised.json()).toEqual(unavailable)
  expect(await snapshot()).toEqual(before)
  const fresh = await f.start(false, 'embed')
  expect(fresh.sessionId).not.toBe(old.sessionId); expect(fresh.sessionToken).not.toBe(old.sessionToken)
  expect(fresh.revisionId).toBe(old.revisionId)
  const committed = await f.submit(fresh, answers, 'original-restart-key')
  expect(committed.status).toBe(201)
  const receipt = await committed.json<{ responseId: string }>()
  expect(receipt).toMatchObject({ idempotent: false, disposition: 'released', completionStepId: f.end.id })
  const replay = await f.submit(fresh, answers, 'original-restart-key')
  expect(replay.status).toBe(201)
  expect(await replay.json()).toEqual({ ...receipt, idempotent: true })
  expect(await env.DB.prepare('SELECT step_id, value_json FROM response_answers WHERE response_id = ?').bind(receipt.responseId).all()).toMatchObject({ results: [{ step_id: f.route.id, value_json: JSON.stringify(f.skip.id) }] })
  expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM responses WHERE revision_id = ?').bind(old.revisionId).first()).toEqual({ n: 1 })
  expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM response_outbox WHERE response_id = ?').bind(receipt.responseId).first()).toEqual({ n: 1 })
  expect(await env.DB.prepare('SELECT starts, completions FROM revision_metric_counters WHERE revision_id = ?').bind(old.revisionId).first()).toEqual({ starts: 2, completions: 1 })
}, 60000)

it('reports expiry during final admission safely after rollback and retains receipt precedence after session deletion', async () => {
  const f = await fixture('session-expiry-admission-race')
  const old = await f.start()
  const tables = ['flows', 'flow_revisions', 'flow_steps', 'choice_options', 'flow_branch_rules', 'respondent_sessions', 'respondent_session_step_events', 'responses', 'response_answers', 'response_outbox', 'revision_metric_counters', 'revision_step_metric_counters', 'audit_entries']
  const snapshot = async () => (await env.DB.batch(tables.map(table => env.DB.prepare(`SELECT * FROM ${table} ORDER BY id`)))).map(result => result.results)
  let expiredSnapshot: Awaited<ReturnType<typeof snapshot>> | undefined
  const original = ResponseRepository.prototype.createCompletedResponse
  const gate = vi.spyOn(ResponseRepository.prototype, 'createCompletedResponse').mockImplementationOnce(async function (input) {
    await env.DB.prepare('UPDATE respondent_sessions SET expires_at = ? WHERE id = ?').bind('2000-01-01T00:00:00.000Z', old.sessionId).run()
    expiredSnapshot = await snapshot()
    return original.call(this, input)
  })
  try {
    const denied = await f.submit(old, [{ stepId: f.route.id, value: f.skip.id }])
    expect(denied.status).toBe(400)
    expect(await denied.json()).toMatchObject({ error: 'SESSION_UNAVAILABLE' })
    expect(expiredSnapshot).toBeDefined(); expect(await snapshot()).toEqual(expiredSnapshot)
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM responses WHERE revision_id = ?').bind(old.revisionId).first()).toEqual({ n: 0 })
    expect(await env.DB.prepare('SELECT starts, completions FROM revision_metric_counters WHERE revision_id = ?').bind(old.revisionId).first()).toEqual({ starts: 1, completions: 0 })
  } finally { gate.mockRestore() }
  const fresh = await f.start()
  const committed = await f.submit(fresh, [{ stepId: f.route.id, value: f.skip.id }], 'race-restart-original-key')
  const receipt = await committed.json<{ responseId: string }>()
  expect(committed.status).toBe(201)
  expect(await env.DB.prepare('SELECT id FROM respondent_sessions WHERE id = ?').bind(fresh.sessionId).first()).toBeNull()
  const replay = await f.submit(fresh, [{ stepId: f.route.id, value: f.more.id }], 'race-restart-original-key')
  expect(replay.status).toBe(201); expect(await replay.json()).toEqual({ ...receipt, idempotent: true })
  expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM responses WHERE revision_id = ?').bind(fresh.revisionId).first()).toEqual({ n: 1 })
  expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM response_outbox WHERE response_id = ?').bind(receipt.responseId).first()).toEqual({ n: 1 })
}, 60000)

contract(['RESP-015'], 'names a missing final token without any product effect or receipt disclosure and preserves present-token format bounds', async () => {
  const f = await fixture('missing-submission-token')
  const session = await f.start()
  const answers = [{ stepId: f.route.id, value: f.skip.id }]
  const tables = ['flows', 'flow_revisions', 'respondent_sessions', 'respondent_session_step_events', 'responses', 'response_answers', 'response_outbox', 'revision_metric_counters', 'revision_step_metric_counters', 'audit_entries']
  const snapshot = async () => (await env.DB.batch(tables.map(table => env.DB.prepare(`SELECT * FROM ${table} ORDER BY id`)))).map(result => result.results)
  const body = { sessionId: session.sessionId, idempotencyKey: 'missing-token-original-key', answers }
  const before = await snapshot()
  const missing = await req('/api/public/flows/missing-submission-token/responses', body)
  expect(missing.status).toBe(400)
  const unavailable = { error: 'SESSION_UNAVAILABLE', message: 'This response session has expired or is no longer available. Start again to answer the current form.' }
  expect(await missing.json()).toEqual(unavailable); expect(await snapshot()).toEqual(before)
  for (const sessionToken of ['', 'too-short', null, 123]) {
    const malformed = await req('/api/public/flows/missing-submission-token/responses', { ...body, sessionToken })
    expect(malformed.status).toBe(400)
    expect(await malformed.json()).toEqual({ error: 'VALIDATION_ERROR', message: 'Invalid request body.' })
    expect(await snapshot()).toEqual(before)
  }
  const committed = await f.submit(session, answers, body.idempotencyKey)
  expect(committed.status).toBe(201)
  const receipt = await committed.json<{ responseId: string }>()
  const after = await snapshot()
  const missingReceipt = await req('/api/public/flows/missing-submission-token/responses', body)
  expect(missingReceipt.status).toBe(400); expect(await missingReceipt.json()).toEqual(unavailable)
  expect(await snapshot()).toEqual(after)
  const replay = await f.submit(session, answers, body.idempotencyKey)
  expect(replay.status).toBe(201); expect(await replay.json()).toEqual({ ...receipt, idempotent: true })
})

contract(['RESP-015'], 'counts missing-token refusal in the original final-submission rate bucket before any receipt or product admission', async () => {
  // Date-only mocking keeps D1/network timers real while fixing one rate window.
  const fixedNow = new Date(Math.floor(Date.now() / 60000) * 60000 + 10000)
  vi.setSystemTime(fixedNow)
  try {
    const f = await fixture('missing-token-rate-bucket')
    const session = await f.start()
    const address = '198.18.163.48'
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`public-rate:${address}`))
    const addressHash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
    const path = '/api/public/flows/missing-token-rate-bucket/responses'
    const body = { sessionId: session.sessionId, idempotencyKey: 'missing-token-rate-original-key', answers: [{ stepId: f.route.id, value: f.skip.id }] }
    const attempt = data => SELF.fetch(`http://localhost${path}`, { method: 'POST', headers: { 'content-type': 'application/json', 'CF-Connecting-IP': address }, body: JSON.stringify(data) })
    expect((await attempt(body)).status).toBe(400)
    expect(await env.DB.prepare("SELECT count, window_started_at FROM public_rate_limit_windows WHERE scope = 'submission' AND address_hash = ?").bind(addressHash).first()).toEqual({ count: 1, window_started_at: new Date(fixedNow.getTime() - 10000).toISOString() })
    const limit = manifest.limits.publicRateLimits.finalSubmissionsPerIpPerMinute
    await env.DB.prepare("UPDATE public_rate_limit_windows SET count = ? WHERE scope = 'submission' AND address_hash = ?").bind(limit - 1, addressHash).run()
    const missing = await attempt(body)
    expect(missing.status).toBe(400); expect(await missing.json()).toMatchObject({ error: 'SESSION_UNAVAILABLE' })
    expect(await env.DB.prepare("SELECT count FROM public_rate_limit_windows WHERE scope = 'submission' AND address_hash = ?").bind(addressHash).first()).toEqual({ count: limit })
    const refused = await attempt({ ...body, sessionToken: session.sessionToken })
    expect(refused.status).toBe(429); expect(await refused.json()).toMatchObject({ error: 'RATE_LIMITED' })
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM responses WHERE revision_id = ?').bind(session.revisionId).first()).toEqual({ n: 0 })
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM response_answers a JOIN responses r ON r.id = a.response_id WHERE r.revision_id = ?').bind(session.revisionId).first()).toEqual({ n: 0 })
    expect(await env.DB.prepare('SELECT starts, completions FROM revision_metric_counters WHERE revision_id = ?').bind(session.revisionId).first()).toEqual({ starts: 1, completions: 0 })
  } finally { vi.useRealTimers() }
})

async function assertSummarySnapshot(operation: 'final' | 'release' | 'erasure') {
  const f = await fixture(`summary-snapshot-race-${operation}`)
  const first = await f.start()
  expect((await f.submit(first, [{ stepId: f.route.id, value: f.skip.id }], 'summary-first-key')).status).toBe(201)
  const second = await f.start(operation === 'release')
  let secondResponse: string | undefined
  if (operation !== 'final') {
    const response = await f.submit(second, [{ stepId: f.route.id, value: f.skip.id }], 'summary-second-key')
    expect(response.status).toBe(201)
    const receipt = await response.json<{ responseId: string; disposition: string }>()
    expect(receipt.disposition).toBe(operation === 'release' ? 'quarantined' : 'released')
    secondResponse = receipt.responseId
  }
  const platform = createPencilPlatform('http://localhost', env)
  const repository = new ResponseRepository(platform.database, env.DB)
  let committed = false
  const commit = async () => {
    if (committed) return
    committed = true
    if (operation === 'final') expect((await f.submit(second, [{ stepId: f.route.id, value: f.skip.id }], 'summary-second-key')).status).toBe(201)
    else if (operation === 'release') await ok(`/api/app/responses/${secondResponse}/release`, {})
    else await ok(`/api/app/responses/${secondResponse}`, undefined, 'DELETE')
  }
  // Schedule the same real write after the old independent counter read, or
  // before the new atomic read boundary. Neither path substitutes any SQL result.
  type Session = { prepareQuery: (...args: unknown[]) => { all: (...args: unknown[]) => Promise<unknown> } }
  const session = (platform.database as unknown as { session: Session }).session
  const prepare = session.prepareQuery.bind(session)
  const queryGate = vi.spyOn(session, 'prepareQuery').mockImplementation((...args) => {
    const prepared = prepare(...args)
    if ((args[0] as { sql: string }).sql.includes('from "revision_metric_counters"')) {
      const all = prepared.all.bind(prepared)
      prepared.all = async (...params) => { const rows = await all(...params); await commit(); return rows }
    }
    return prepared
  })
  const batch = platform.database.batch.bind(platform.database)
  const batchGate = vi.spyOn(platform.database, 'batch').mockImplementationOnce(async queries => { await commit(); return batch(queries) })
  try {
    const result = await repository.getResults(first.revisionId)
    expect(committed).toBe(true)
    const expected = operation === 'erasure' ? 1 : 2
    expect(result.completedResponses).toBe(expected)
    expect(result.counter).toMatchObject({ starts: 2, completions: expected })
    const stored = await env.DB.prepare("SELECT COUNT(*) AS n, SUM(completion_milliseconds) AS elapsed FROM responses WHERE revision_id = ? AND state = 'released'").bind(first.revisionId).first<{ n: number; elapsed: number }>()
    expect(result.completedResponses).toBe(stored!.n)
    expect(result.counter!.totalCompletionMilliseconds).toBe(stored!.elapsed)
  } finally { queryGate.mockRestore(); batchGate.mockRestore() }
}

it('returns one coherent summary when a final write crosses the counter/read boundary', () => assertSummarySnapshot('final'))
it('returns one coherent summary when quarantine release crosses the counter/read boundary', () => assertSummarySnapshot('release'))
it('returns one coherent summary when erasure crosses the counter/read boundary', () => assertSummarySnapshot('erasure'))

contract(['RSLT-001','RSLT-003','RSLT-004','DASH-002'], 'retains factual zero, quarantine, release and erasure summaries and matching dashboard counts', async () => {
  const f = await fixture('summary-cohort-states')
  const results = () => ok<FlowResults>(`${f.path}/results`)
  expect(await results()).toMatchObject({ starts: 0, completedResponses: 0, completionRate: 0, averageCompletionMilliseconds: 0, deviceStarts: { mobile: 0, tablet: 0, desktop: 0 } })
  const fast = await f.start(true)
  const receipt = await (await f.submit(fast, [{ stepId: f.route.id, value: f.skip.id }], 'summary-quarantine-key')).json<{ responseId: string; disposition: string }>()
  expect(receipt.disposition).toBe('quarantined')
  expect(await results()).toMatchObject({ starts: 1, completedResponses: 0, completionRate: 0, averageCompletionMilliseconds: 0, deviceStarts: { mobile: 0, tablet: 0, desktop: 1 } })
  await ok(`/api/app/responses/${receipt.responseId}/release`, {})
  const stored = await env.DB.prepare('SELECT completion_milliseconds FROM responses WHERE id = ?').bind(receipt.responseId).first<{ completion_milliseconds: number }>()
  const released = await results()
  expect(released).toMatchObject({ starts: 1, completedResponses: 1, completionRate: 1, averageCompletionMilliseconds: stored!.completion_milliseconds })
  expect(JSON.stringify(released)).not.toContain(receipt.responseId); expect(JSON.stringify(released)).not.toContain(fast.sessionToken)
  expect(await ok('/api/app/dashboard?status=open')).toEqual(expect.arrayContaining([expect.objectContaining({ id: f.flow.id, starts: 1, completedResponses: 1 })]))
  await ok(`/api/app/responses/${receipt.responseId}`, undefined, 'DELETE')
  expect(await results()).toMatchObject({ starts: 1, completedResponses: 0, completionRate: 0, averageCompletionMilliseconds: 0, deviceStarts: { mobile: 0, tablet: 0, desktop: 1 } })
  expect(await ok('/api/app/dashboard?status=open')).toEqual(expect.arrayContaining([expect.objectContaining({ id: f.flow.id, starts: 1, completedResponses: 0 })]))
})
