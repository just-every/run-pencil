import { matureLoad } from './load-time-fixture'
import { devKeyHeaders } from '../helpers/dev-key.mjs'
import { scheduledNotificationPrestate, assertScheduledNotificationEffects } from './retention-notification-evidence'
import { eraseResponseAndImportCustody } from '../../src/core/features/importing/erasure'
import { httpExport, allTexts } from '../helpers/report-download'
import { developmentInbox } from '../helpers/development-outbox'
import { applyD1Migrations, createScheduledController, env, SELF, type D1Migration } from 'cloudflare:test'
import worker from '../../src/core/app/worker'
import { contract } from '../../src/test/contract'
import { beforeAll, expect, it, vi } from 'vitest'
import type { BuilderDraft, FlowResults, PublicFlow } from '../../src/core/app/api'
import { ResponseRepository } from '../../src/core/features/responses/repository'
import { createPencilServices } from '../../src/core/app/services'
import { createPencilPlatform } from '../../src/core/platform/runtime'
declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
let cookie = ''
let serial = 0
async function req(path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST') {
  const response = await SELF.fetch(`http://localhost${path}`, { method, headers: { Host: 'localhost', cookie, origin: 'http://localhost', 'content-type': 'application/json', 'CF-Connecting-IP': `192.0.2.${++serial}` }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  return response
}
async function ok<T>(path: string, body?: unknown, method?: string): Promise<T> {
  if (path.includes('/responses/export') && !path.includes('/start') && !path.includes('token=')) return httpExport<T>(target => req(target),path)
  const response = await req(path, body, method)
  const text = await response.text()
  expect(response.status, `${path}: ${text}`).toBeLessThan(300)
  return text ? JSON.parse(text) as T : undefined as T
}
beforeAll(async () => {
  await applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__)
  await ok('/health')
  await ok('/auth/magic-link', { email: 'owner@aurora-coffee.test' })
  const inbox = await developmentInbox(path => SELF.fetch('http://localhost' + path, { headers: { Host: 'localhost', ...devKeyHeaders } }), 'owner@aurora-coffee.test')
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
  const start = async (fast = false, source = 'direct', deviceClass: 'mobile' | 'tablet' | 'desktop' = 'desktop') => {
    const session = await ok<{ sessionId: string; sessionToken: string; loadTime: string; revisionId: string; flow: PublicFlow }>(`/api/public/flows/${slug}/sessions`, { deviceClass, source })
    expect(session.flow.revision.id).toBe(session.revisionId)
    if (!fast) await matureLoad(session, 5000)
    return session
  }
  const submit = (session: { sessionId: string; sessionToken: string; loadTime: string }, answers: unknown[], key = 'synthetic-journey-idempotency-123') => req(`/api/public/flows/${slug}/responses`, { ...session, answers, idempotencyKey: key })
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
  const scheduledTime = Date.now()
  const dispatchedAt = new Date(scheduledTime).toISOString()
  const outboxIndex = protectedTables.indexOf('response_outbox'), auditIndex = protectedTables.indexOf('audit_entries')
  const notificationPrestate = await scheduledNotificationPrestate(env.DB, dispatchedAt, before[outboxIndex], before[protectedTables.indexOf('responses')])
  const expectedOutbox = before[outboxIndex].filter(row => row.response_id === receipt.responseId)
  expect(expectedOutbox).toHaveLength(1)
  expect(notificationPrestate.ids).toContain(expectedOutbox[0].id)
  const recipients = await env.DB.prepare(`SELECT p.operator_id,r.workspace_id FROM notification_preferences p
    JOIN responses r ON r.flow_id=p.flow_id WHERE r.id=? AND p.mode='immediately' ORDER BY p.operator_id`).bind(receipt.responseId).all<{ operator_id: string; workspace_id: string }>()
  expect(recipients.results).toHaveLength(1)
  expect(notificationPrestate.recipients.filter(row => row.outbox_id === expectedOutbox[0].id))
    .toEqual([{ outbox_id: expectedOutbox[0].id, response_id: receipt.responseId, ...recipients.results[0] }])
  expect(await env.DB.prepare('SELECT * FROM notification_deliveries').all().then(result => result.results)).toEqual([])
  const log = vi.spyOn(console, 'log').mockImplementation(() => {})
  try {
    await Promise.all([worker.scheduled(createScheduledController({ scheduledTime, cron: '15 * * * *' }), env), worker.scheduled(createScheduledController({ scheduledTime, cron: '15 * * * *' }), env)])
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/retention-expired-secret|sessionToken|sessionId|owner@|retention-runtime|responseId|answer/)
    expect(log.mock.calls).toHaveLength(2)
  } finally { log.mockRestore() }
  const after = await Promise.all(protectedTables.map(table => env.DB.prepare(`SELECT * FROM ${table} ORDER BY id`).all().then(result => result.results)))
  // Every previously committed eligible command dispatches at this instant;
  // all other persisted rows and fields remain exactly as snapshotted.
  const expected = before.map(rows => rows.map(row => ({ ...row })))
  expected[outboxIndex] = expected[outboxIndex].map(row => notificationPrestate.ids.includes(String(row.id))
    ? { ...row, status: 'dispatched', dispatched_at: dispatchedAt, updated_at: dispatchedAt } : row)
  const addedAudit = after[auditIndex].filter(row => !before[auditIndex].some(previous => previous.id === row.id))
  await assertScheduledNotificationEffects(env.DB, dispatchedAt, notificationPrestate, addedAudit)
  // Match SELECT ... ORDER BY id's binary collation, including retained
  // migration-owned IDs and newly generated audit IDs on every host locale.
  expected[auditIndex] = [...expected[auditIndex], ...addedAudit].sort((left, right) => String(left.id) < String(right.id) ? -1 : String(left.id) > String(right.id) ? 1 : 0)
  expect(after).toEqual(expected)
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
  expect(exported.responses).toEqual(ledger.responses.map(response => ({ ...response, answers: response.answers.map(answer => ({ ...answer, value: answer.value === f.more.id ? 'detail' : answer.value })) })))
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
  const repository = new ResponseRepository(platform.database, env.DB, eraseResponseAndImportCustody)
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
  expect((await req('/api/public/flows/journey-completion-wrong-slug/responses', { ...session, answers: changed, idempotencyKey: 'synthetic-journey-idempotency-123' })).status).toBe(404)
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
  await ok(`${f.path}/draft`, { stepId: f.detail.id, prompt: f.detail.prompt, required: f.detail.required, expectedVersion: draft.flow.draftVersion, nextStepId: added.id }, 'PUT')
  draft = await f.draft()
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
  expect(addedQuestion.versions[0]).toMatchObject({ revisionId: newer.revisionId, prompt: f.route.prompt, answered: 1, distribution: Array.from({ length: 5 }, (_, index) => ({ value: index + 1, label: String(index + 1), count: index === 3 ? 1 : 0 })) })
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
  expect(afterErasure.questions.find(question => question.id === added.id)!.versions[0]).toMatchObject({ answered: 0, eligibleResponses: 1, distribution: Array.from({ length: 5 }, (_, index) => ({ value: index + 1, label: String(index + 1), count: 0 })) })
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

contract(['RSLT-001','RSLT-003','RSLT-004','DASH-002'], 'retains factual zero, quarantine, release and erasure summaries and matching dashboard counts', async () => {
  const f = await fixture('summary-cohort-states')
  const results = () => ok<FlowResults>(`${f.path}/results?revisionId=${f.publicFlow.revision.id}`)
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

  const devicePath = `${f.path}/devices?revisionId=${fast.revisionId}`
  expect(await ok(devicePath)).toMatchObject({basis:'sessions',total:1,counts:{desktop:1,mobile:0,tablet:0,unknown:0},sessionsWithoutResponse:0})
  const mobile = await f.start(false, 'direct', 'mobile')
  const mobileReceipt = await (await f.submit(mobile,[{stepId:f.route.id,value:f.more.id},{stepId:f.detail.id,value:'Mobile cohort'}],'synthetic-pencil-mobile')).json<{responseId:string}>()
  expect((await env.DB.prepare('SELECT id,device_class FROM responses WHERE revision_id=? ORDER BY id').bind(fast.revisionId).all()).results).toEqual(expect.arrayContaining([{id:receipt.responseId,device_class:'desktop'},{id:mobileReceipt.responseId,device_class:'mobile'}]))
  const selected = `${devicePath}&answerStepId=${f.route.id}&answerValue=${f.more.id}`
  expect(await ok(selected)).toMatchObject({basis:'responses',total:1,counts:{mobile:1,tablet:0,desktop:0,unknown:0},nativeResponses:1,sessionsWithoutResponse:0})
  expect(await ok(`${selected}&deviceClass=desktop`)).toMatchObject({total:0,counts:{mobile:0,desktop:0}})
  const emptyRevision = await ok<{revision:{id:string}}>(`${f.path}/publish`,{expectedVersion:(await f.draft()).flow.draftVersion})
  expect(await ok(`${f.path}/devices?revisionId=${emptyRevision.revision.id}&deviceClass=mobile`)).toMatchObject({total:0})
  expect(await ok(selected)).toMatchObject({total:1,counts:{mobile:1}})
  // A historical response's absent class is unknown, never inferred from its answers or source.
  await env.DB.prepare('UPDATE responses SET device_class=NULL WHERE id=?').bind(mobileReceipt.responseId).run()
  expect(await ok(`${devicePath}&deviceClass=unknown`)).toMatchObject({total:1,unknownResponses:1,counts:{unknown:1,mobile:0,desktop:0}})
  const exported = await ok<{responses:unknown[]}>(`${f.path}/responses/export?revisionId=${fast.revisionId}&deviceClass=unknown`)
  expect(exported.responses).toEqual([expect.objectContaining({id:mobileReceipt.responseId})])
  expect(JSON.stringify(exported)).not.toMatch(/deviceClass|device_class|user.agent|fingerprint|screen.width|raw.ip/i)
  const exportedCsv = await req(`${f.path}/responses/export/start`,{format:'csv',revisionId:fast.revisionId,deviceClass:'unknown'}).then(response=>response.json<{token:string}>())
  const csv = await req(`${f.path}/responses/export?token=${encodeURIComponent(exportedCsv.token)}`).then(response=>response.text())
  expect(csv).toContain(mobileReceipt.responseId)
  expect(csv).not.toMatch(/deviceClass|device_class|user.agent|fingerprint|screen.width|raw.ip/i)
  await ok(`/api/app/responses/${mobileReceipt.responseId}`,undefined,'DELETE')
  expect(await env.DB.prepare('SELECT device_class FROM responses WHERE id=?').bind(mobileReceipt.responseId).first()).toBeNull()
  expect(await ok(`${devicePath}&deviceClass=unknown`)).toMatchObject({total:0,unknownResponses:0})

  expect(await ok('/api/app/dashboard?status=open')).toEqual(expect.arrayContaining([expect.objectContaining({ id: f.flow.id, starts: 2, completedResponses: 1 })]))
  await ok(`/api/app/responses/${receipt.responseId}`, undefined, 'DELETE')
  expect(await results()).toMatchObject({ starts: 2, completedResponses: 0, completionRate: 0, averageCompletionMilliseconds: 0, deviceStarts: { mobile: 1, tablet: 0, desktop: 1 } })
  expect(await ok('/api/app/dashboard?status=open')).toEqual(expect.arrayContaining([expect.objectContaining({ id: f.flow.id, starts: 2, completedResponses: 0 })]))
})
