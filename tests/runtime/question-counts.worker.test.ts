import { applyD1Migrations, env, SELF, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect, it } from 'vitest'
import { contract } from '../../src/test/contract'
import type { BuilderDraft, PublicFlow } from '../../src/core/app/api'
import { ResponseRepository } from '../../src/core/features/responses/repository'
import { createPencilPlatform } from '../../src/core/platform/runtime'
declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
let cookie = ''
let serial = 0
async function req(path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST') {
  return SELF.fetch(`http://localhost${path}`, { method, headers: { Host: 'localhost', cookie, origin: 'http://localhost', 'content-type': 'application/json', 'CF-Connecting-IP': `198.18.210.${++serial}` }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
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

contract('RSLT-002', 'counts the validated final path once and keeps skipped, expired, quarantined, erased and later-revision cohorts distinct', async () => {
  const f = await fixture('question-stage-counts')
  const answers = [{ stepId: f.route.id, value: f.more.id }, { stepId: f.detail.id, value: 'Private stage-count answer' }]
  const report = () => ok<Array<{ id: string; reached: number; dropped: number; answered: number }>>(`${f.path}/questions?revisionId=${f.publicFlow.revision.id}`)
  const detailed = await f.start()
  const receipt = await (await f.submit(detailed, answers, 'stage-original-key')).json<{ responseId: string }>()
  // A validated final proves the path even when progress acknowledgements were absent.
  expect((await report()).find(q => q.id === f.detail.id)).toMatchObject({ reached: 1, dropped: 0, answered: 1 })
  await f.submit(detailed, answers, 'stage-original-key')
  const skipped = await f.start()
  await f.submit(skipped, [{ stepId: f.route.id, value: f.skip.id }], 'stage-skipped-key')
  expect((await report()).find(q => q.id === f.detail.id)).toMatchObject({ reached: 1, dropped: 0, answered: 1 })
  const abandoned = await f.start()
  for (let i = 0; i < 2; i++) await ok(`/api/public/flows/question-stage-counts/sessions/advance`, { ...abandoned, stepId: f.detail.id })
  await env.DB.prepare('UPDATE respondent_sessions SET expires_at = ? WHERE id = ?').bind('2000-01-01T00:00:00.000Z', abandoned.sessionId).run()
  const platform = createPencilPlatform('http://localhost', env)
  await new ResponseRepository(platform.database, env.DB).foldExpiredSessions(new Date().toISOString())
  expect((await report()).find(q => q.id === f.detail.id)).toMatchObject({ reached: 2, dropped: 1, answered: 1 })
  const fast = await f.start(true)
  for (let i = 0; i < 2; i++) await ok(`/api/public/flows/question-stage-counts/sessions/advance`, { ...fast, stepId: f.detail.id })
  const quarantine = await (await f.submit(fast, answers, 'stage-quarantine-key')).json<{ responseId: string; disposition: string }>()
  expect(quarantine.disposition).toBe('quarantined')
  expect((await report()).find(q => q.id === f.detail.id)).toMatchObject({ reached: 3, dropped: 1, answered: 1 })
  await ok(`/api/app/responses/${quarantine.responseId}/release`, {})
  expect((await report()).find(q => q.id === f.detail.id)).toMatchObject({ reached: 3, dropped: 1, answered: 2 })
  await ok(`/api/app/responses/${receipt.responseId}`, undefined, 'DELETE')
  const old = await report()
  expect(old.find(q => q.id === f.detail.id)).toMatchObject({ reached: 3, dropped: 1, answered: 1 })
  expect(old.find(q => q.id === f.route.id)).toMatchObject({ reached: 4, dropped: 0, answered: 2 })
  expect(old.find(q => q.id === f.end.id)).toMatchObject({ reached: 3, dropped: 0, answered: 0 })
  for (const secret of [answers[1].value, receipt.responseId, quarantine.responseId, abandoned.sessionToken]) expect(JSON.stringify(old)).not.toContain(secret)
  const draft = await f.draft()
  await ok(`${f.path}/publish`, { expectedVersion: draft.flow.draftVersion })
  const fresh = await f.start()
  await f.submit(fresh, answers, 'stage-next-revision-key')
  expect(await report()).toEqual(old)
  const newer = await ok<Array<{ id: string; reached: number; dropped: number; answered: number }>>(`${f.path}/questions?revisionId=${fresh.revisionId}`)
  expect(newer.find(q => q.id === f.detail.id)).toMatchObject({ reached: 1, dropped: 0, answered: 1 })
})

it('counts a visited optional unanswered step on a validated final without inventing an answer', async () => {
  const f = await fixture('optional-stage-counts')
  const draft = await f.draft()
  await ok(`${f.path}/draft`, { stepId: f.detail.id, prompt: f.detail.prompt, required: false, expectedVersion: draft.flow.draftVersion }, 'PUT')
  const changed = await f.draft()
  await ok(`${f.path}/publish`, { expectedVersion: changed.flow.draftVersion })
  const session = await f.start()
  expect((await f.submit(session, [{ stepId: f.route.id, value: f.more.id }])).status).toBe(201)
  const questions = await ok<Array<{ id: string; reached: number; dropped: number; answered: number }>>(`${f.path}/questions?revisionId=${session.revisionId}`)
  expect(questions.find(q => q.id === f.detail.id)).toMatchObject({ reached: 1, dropped: 0, answered: 0 })
})
