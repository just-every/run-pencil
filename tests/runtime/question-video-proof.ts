import { env, SELF } from 'cloudflare:test'
import { expect } from 'vitest'
import type { BuilderDraft, PublicFlow } from '../../src/core/app/api'
import { matureLoad } from './load-time-fixture'

type Request = (path: string, body?: unknown, method?: string) => Promise<Response>

/** The normal authenticated authoring doors own video just like every other revision setting. */
export async function proveQuestionVideo(request: Request) {
  async function ok<T>(path: string, body?: unknown, method?: string): Promise<T> {
    const response = await request(path, body, method)
    const text = await response.text()
    expect(response.status, `${path}: ${text}`).toBeLessThan(300)
    return text ? JSON.parse(text) as T : undefined as T
  }
  const flow = await ok<{ id: string }>('/api/app/flows', { title: 'Question video custody', slug: 'question-video-custody' })
  const path = `/api/app/flows/${flow.id}`
  const draft = () => ok<BuilderDraft>(`${path}/draft`)
  const youtube = { provider: 'youtube', reference: 'synthetiC01' }
  const vimeo = { provider: 'vimeo', reference: '123456789' }
  const add = async (step: unknown) => ok(`${path}/draft/steps`, { expectedVersion: (await draft()).flow.draftVersion, step })
  await add({ kind: 'welcome', questionType: null, prompt: 'A local introduction' })
  await add({ kind: 'question', questionType: 'short_text', prompt: 'What did the first video show?', required: true, questionSettings: { video: youtube } })
  await add({ kind: 'question', questionType: 'short_text', prompt: 'What did the second video show?', required: true })
  await add({ kind: 'completion', questionType: null, prompt: 'Video response recorded' })
  let current = await draft()
  const [welcome, first, second, completion] = current.steps
  expect(first.questionSettings?.video).toEqual(youtube)
  const save = async (stepId: string, settings: Record<string, unknown> | null) => {
    const latest = await draft()
    const selected = latest.steps.find(step => step.id === stepId)!
    return request(`${path}/draft`, { stepId, prompt: selected.prompt, required: selected.required, expectedVersion: latest.flow.draftVersion, questionSettings: settings }, 'PUT')
  }
  const snapshot = async () => (await env.DB.batch([
    env.DB.prepare('SELECT * FROM flows WHERE id = ?').bind(flow.id),
    env.DB.prepare('SELECT * FROM flow_revisions WHERE flow_id = ? ORDER BY id').bind(flow.id),
    env.DB.prepare('SELECT * FROM flow_steps WHERE revision_id IN (SELECT id FROM flow_revisions WHERE flow_id = ?) ORDER BY id').bind(flow.id),
    env.DB.prepare('SELECT * FROM choice_options WHERE step_id IN (SELECT id FROM flow_steps WHERE revision_id IN (SELECT id FROM flow_revisions WHERE flow_id = ?)) ORDER BY id').bind(flow.id),
    env.DB.prepare('SELECT * FROM flow_branch_rules WHERE revision_id IN (SELECT id FROM flow_revisions WHERE flow_id = ?) ORDER BY id').bind(flow.id),
  ])).map(result => result.results)
  const refused = async (action: () => Promise<Response>) => {
    const before = await snapshot()
    const beforeDraft = await draft()
    const response = await action()
    expect(response.status, await response.clone().text()).toBe(400)
    expect(await response.json()).toMatchObject({ error: 'VALIDATION_ERROR', message: expect.any(String) })
    expect(await snapshot()).toEqual(before)
    expect(await draft()).toEqual(beforeDraft)
  }
  // References are canonical provider IDs, never caller-selected hosts, schemes or embed markup.
  for (const video of [
    { provider: 'unapproved', reference: 'synthetiC01' },
    { provider: 'youtube', reference: 'https://unapproved.example/watch?v=synthetiC01' },
    { provider: 'youtube', reference: 'http://www.youtube.com/watch?v=synthetiC01' },
    { provider: 'youtube', reference: 'javascript:alert(1)' },
    { provider: 'youtube', reference: '<iframe src="https://www.youtube.com"></iframe>' },
    { provider: 'youtube', reference: 'too-short' },
    { provider: 'youtube', reference: 'synthetiC01?autoplay=1' },
    { provider: 'vimeo', reference: '../123456789' },
    { provider: 'vimeo', reference: '0' },
    { provider: 'vimeo', reference: '0123456789' },
    { provider: 'vimeo', reference: '1234567890123' },
    { provider: 'youtube', reference: 'synthetiC01', host: 'unapproved.example' },
    { provider: 'youtube', reference: 'synthetiC01', autoplay: true },
    null,
  ]) {
    await refused(() => save(first.id, { video }))
    await refused(async () => request(`${path}/draft/steps`, {
      expectedVersion: (await draft()).flow.draftVersion,
      step: { kind: 'question', questionType: 'short_text', prompt: 'Refused video', questionSettings: { video } },
    }))
  }
  for (const kind of ['welcome', 'completion'] as const) {
    await refused(async () => request(`${path}/draft/steps`, {
      expectedVersion: (await draft()).flow.draftVersion,
      step: { kind, questionType: null, prompt: 'Unsupported video placement', questionSettings: { video: youtube } },
    }))
  }
  for (const step of [welcome, completion]) await refused(() => save(step.id, { video: youtube }))
  const screen = async (kind: 'group' | 'page' | null) => request(`${path}/draft/screen`, {
    stepId: first.id, expectedVersion: (await draft()).flow.draftVersion,
    layout: kind ? { kind, title: 'A combined screen', questionIds: [first.id, second.id] } : null,
  }, 'PUT')
  // A standalone video cannot be folded into either kind of combined screen.
  for (const kind of ['group', 'page'] as const) await refused(() => screen(kind))
  expect((await save(first.id, {})).status).toBe(200)
  for (const kind of ['group', 'page'] as const) {
    expect((await screen(kind)).status).toBe(200)
    // Check both the anchor's own settings and a member whose grouping lives on another step.
    for (const id of [first.id, second.id]) {
      const selected = (await draft()).steps.find(step => step.id === id)!
      await refused(() => save(id, { ...selected.questionSettings, video: youtube }))
    }
    expect((await screen(null)).status).toBe(200)
  }
  expect((await save(first.id, { video: youtube })).status).toBe(200)
  expect((await save(second.id, { video: vimeo })).status).toBe(200)
  current = await draft()
  expect(current.steps.find(step => step.id === first.id)?.questionSettings?.video).toEqual(youtube)
  expect(current.steps.find(step => step.id === second.id)?.questionSettings?.video).toEqual(vimeo)
  const beforeAnonymous = await snapshot()
  const anonymous = await SELF.fetch(`http://localhost${path}/draft`, {
    method: 'PUT', headers: { Host: 'localhost', origin: 'http://localhost', 'content-type': 'application/json' },
    body: JSON.stringify({ stepId: first.id, prompt: 'Anonymous replacement', required: true, expectedVersion: current.flow.draftVersion, questionSettings: { video: vimeo } }),
  })
  expect(anonymous.status).toBe(401)
  expect(await snapshot()).toEqual(beforeAnonymous)
  const published = await ok<{ revision: { id: string } }>(`${path}/publish`, { expectedVersion: current.flow.draftVersion })
  const publicFlow = await ok<PublicFlow>('/api/public/flows/question-video-custody')
  expect(publicFlow.revision.id).toBe(published.revision.id)
  expect(publicFlow.steps.find(step => step.id === first.id)?.questionSettings?.video).toEqual(youtube)
  expect(publicFlow.steps.find(step => step.id === second.id)?.questionSettings?.video).toEqual(vimeo)
  const session = await ok<{ sessionId: string; sessionToken: string; loadTime: string; revisionId: string; flow: PublicFlow }>('/api/public/flows/question-video-custody/sessions', { source: 'direct', deviceClass: 'desktop' })
  expect(session.flow.steps.find(step => step.id === first.id)?.questionSettings?.video).toEqual(youtube)
  const draftBeforeEdit = await draft()
  expect((await save(first.id, { video: { provider: 'vimeo', reference: '987654321' } })).status).toBe(200)
  const stale = await request(`${path}/draft`, {
    stepId: first.id, prompt: first.prompt, required: first.required,
    expectedVersion: draftBeforeEdit.flow.draftVersion, questionSettings: { video: { provider: 'youtube', reference: 'synthetiC02' } },
  }, 'PUT')
  expect(stale.status).toBe(200)
  expect(await stale.json()).toMatchObject({ kind: 'conflict' })
  expect((await draft()).steps.find(step => step.id === first.id)?.questionSettings?.video).toEqual({ provider: 'vimeo', reference: '987654321' })
  expect((await ok<PublicFlow>('/api/public/flows/question-video-custody')).steps.find(step => step.id === first.id)?.questionSettings?.video).toEqual(youtube)
  const retained = await env.DB.prepare('SELECT question_settings_json FROM flow_steps WHERE revision_id = ? AND stable_id = ?').bind(published.revision.id, first.id).first<{ question_settings_json: string }>()
  expect(JSON.parse(retained!.question_settings_json).video).toEqual(youtube)
  await matureLoad(session)
  const answers = [{ stepId: first.id, value: 'First local answer' }, { stepId: second.id, value: 'Second local answer' }]
  const completed = await ok<{ responseId: string; disposition: string; completionStepId: string }>('/api/public/flows/question-video-custody/responses', {
    ...session, answers, idempotencyKey: 'synthetic-pencil-video-completion',
  })
  expect(completed).toMatchObject({ disposition: 'released', completionStepId: completion.id })
  const stored = await env.DB.prepare('SELECT step_id, value_json FROM response_answers WHERE response_id = ? ORDER BY step_id').bind(completed.responseId).all()
  expect(stored.results).toEqual(answers.map(answer => ({ step_id: answer.stepId, value_json: JSON.stringify(answer.value) })).sort((a, b) => a.step_id.localeCompare(b.step_id)))
  expect(await env.DB.prepare('SELECT revision_id FROM responses WHERE id = ?').bind(completed.responseId).first()).toEqual({ revision_id: published.revision.id })
}
