import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { createWorkerApp } from '../../src/core/app/worker'
import { createPencilPlatform } from '../../src/core/platform/runtime'
import type { BuilderDraft, PublicFlow, SavedResponseState } from '../../src/core/app/api'
import type { LedgerResponse } from '../../src/core/features/reporting/repository'
import type { PresentationOrder } from '../../src/core/shared/presentationOrder'
import { resumeBearer } from '../../src/core/features/resuming/credentials'
import { issueLoadTime } from '../../src/core/features/traffic/loadTime'
import { googleHttp } from './google-import-http'
import { csvRows } from '../e2e/export-helpers'

declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(() => applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__))
type Session = { sessionId: string; sessionToken: string; revisionId: string; flow: PublicFlow }

contract('FIELD-006', '200 respondents retain valid varied choice and block orders through sessions, resume, immutable revisions, copies and ledger exports', async () => {
  const f = await googleHttp(), slug = `workshop-order-${crypto.randomUUID()}`
  const operator = async <T,>(path: string, body?: unknown, method?: string): Promise<T> => {
    const response = await f.call(path, body, { method })
    expect(response.status, await response.clone().text()).toBeLessThan(300)
    return response.json() as Promise<T>
  }
  const app = createWorkerApp(undefined, createPencilPlatform('http://localhost', env))
  const request = (client: number, suffix = '', body?: unknown) => app.request(`http://localhost/api/public/flows/${slug}${suffix}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Host: 'localhost', Origin: 'http://localhost', 'Content-Type': 'application/json', 'CF-Connecting-IP': `198.18.206.${client}` },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const publicCall = async <T,>(client: number, suffix = '', body?: unknown): Promise<T> => {
    const response = await request(client, suffix, body)
    expect(response.status, await response.clone().text()).toBeLessThan(300)
    return response.json() as Promise<T>
  }
  const { id } = await operator<{ id: string }>('/api/app/flows', { title: 'Harbour workshop priorities', slug })
  const base = `/api/app/flows/${id}`, read = () => operator<BuilderDraft>(`${base}/draft`)
  for (const [questionType, prompt] of [['multiple_choice', 'Which workshops interest you?'], ['dropdown', 'Which session suits you?'], ['single_choice', 'How will you attend?']] as const) {
    await operator(`${base}/draft/steps`, { expectedVersion: (await read()).flow.draftVersion, step: {
      kind: 'question', questionType, prompt, required: true,
      choices: [{ value: 'a', label: 'First option' }, { value: 'b', label: 'Second option' }, { value: 'c', label: 'Third option' }, { value: 'other', label: 'Other' }, ...(questionType === 'multiple_choice' ? [{ value: 'none', label: 'None of the above' }] : [])],
    } })
  }
  await operator(`${base}/draft/steps`, { expectedVersion: (await read()).flow.draftVersion, step: { kind: 'completion', questionType: null, prompt: 'Workshop preferences received' } })
  let draft = await read()
  const questions = draft.steps.filter(step => step.kind === 'question'), anchor = questions[0].id
  for (const question of questions) {
    const choices = draft.choices.filter(choice => choice.stepId === question.id)
    await operator(`${base}/draft`, { expectedVersion: (await read()).flow.draftVersion, stepId: question.id, prompt: question.prompt, required: true,
      questionSettings: { randomizeChoices: true, otherChoiceId: choices[3].id, ...(question.questionType === 'multiple_choice' ? { noneChoiceId: choices[4].id } : {}),
        ...(question.id === anchor ? { screen: { kind: 'group', title: 'Plan your workshops', randomize: true, questionIds: questions.map(step => step.id) } } : {}) },
    }, 'PUT')
  }
  draft = await read()
  await operator(`${base}/publish`, { expectedVersion: draft.flow.draftVersion })
  const validate = (flow: PublicFlow) => {
    const order = flow.presentation!
    expect(Object.keys(order.choices).sort()).toEqual(questions.map(step => step.id).sort())
    expect(Object.keys(order.blocks)).toEqual([anchor])
    expect([...order.blocks[anchor]].sort()).toEqual(questions.map(step => step.id).sort())
    for (const question of questions) {
      const choices = draft.choices.filter(choice => choice.stepId === question.id)
      expect([...order.choices[question.id]].sort()).toEqual(choices.map(choice => choice.id).sort())
      expect(order.choices[question.id].slice(3)).toEqual(choices.slice(3).map(choice => choice.id))
      expect(flow.choices.filter(choice => choice.stepId === question.id).sort((a, b) => a.position - b.position).map(choice => choice.id)).toEqual(order.choices[question.id])
    }
    return order
  }
  const firstFlow = await publicCall<PublicFlow>(1), proposed = validate(firstFlow)
  const sessionCount = () => env.DB.prepare('SELECT COUNT(*) AS n FROM respondent_sessions s JOIN flow_revisions v ON v.id=s.revision_id WHERE v.flow_id=?').bind(id).first()
  const before = await sessionCount()
  const badOrders = [
    { ...proposed, choices: { ...proposed.choices, [anchor]: proposed.choices[anchor].slice(1) } },
    { ...proposed, choices: { ...proposed.choices, [anchor]: proposed.choices[anchor].map(() => proposed.choices[anchor][0]) } },
    { ...proposed, choices: { ...proposed.choices, [anchor]: [...proposed.choices[anchor]].reverse() } },
    { ...proposed, choices: { ...proposed.choices, [anchor]: [...proposed.choices[anchor].slice(0, -1), 'foreign-choice'] } },
    { ...proposed, blocks: { [anchor]: [questions[0].id, questions[0].id, questions[2].id] } },
    { ...proposed, blocks: { [anchor]: [questions[0].id, questions[1].id, 'foreign-question'] } },
    { ...proposed, blocks: { ...proposed.blocks, 'foreign-block': questions.map(step => step.id) } },
  ]
  for (const presentation of badOrders) {
    expect((await request(1, '/sessions', { deviceClass: 'desktop', source: 'direct', presentation })).status).toBe(400)
    expect(await sessionCount()).toEqual(before)
  }
  const expected = new Map<string, PresentationOrder>(), choiceOrders = questions.map(() => new Set<string>()), blockOrders = new Set<string>()
  const remember = async (session: Session) => {
    const order = validate(session.flow)
    const stored = await env.DB.prepare('SELECT presentation_json FROM respondent_sessions WHERE id=?').bind(session.sessionId).first<{ presentation_json: string }>()
    expect(JSON.parse(stored!.presentation_json)).toEqual(order)
    questions.forEach((step, index) => choiceOrders[index].add(order.choices[step.id].join(',')))
    blockOrders.add(order.blocks[anchor].join(','))
    return order
  }
  const answers = questions.map(question => ({ stepId: question.id, value: question.questionType === 'multiple_choice' ? [draft.choices.find(choice => choice.stepId === question.id)!.id] : draft.choices.find(choice => choice.stepId === question.id)!.id }))
  const finish = async (client: number, session: Session) => {
    const receipt = await publicCall<{ responseId: string; disposition: string }>(client, '/responses', { sessionId: session.sessionId, sessionToken: session.sessionToken,
      loadTime: await issueLoadTime(env.SESSION_SECRET, session.revisionId, Date.now() - 5000), idempotencyKey: crypto.randomUUID(), answers })
    expect(receipt.disposition).toBe('released')
    expected.set(receipt.responseId, session.flow.presentation!)
  }
  const saved = await publicCall<Session>(1, '/sessions', { deviceClass: 'mobile', source: 'direct', presentation: proposed })
  expect(await remember(saved)).toEqual(proposed)
  const commandKey = crypto.randomUUID()
  await publicCall(1, '/sessions/save', { sessionId: saved.sessionId, sessionToken: saved.sessionToken, commandKey, email: 'workshop-resume@example.test', currentStepId: anchor, answers: [answers[0]] })
  for (let client = 2; client <= 200; client++) {
    const displayed = await publicCall<PublicFlow>(client), displayedOrder = validate(displayed)
    const session = await publicCall<Session>(client, '/sessions', { deviceClass: 'desktop', source: 'direct', ...(client % 2 === 0 ? { presentation: displayedOrder } : {}) })
    const order = await remember(session)
    if (client % 2 === 0) expect(order).toEqual(displayedOrder)
    await finish(client, session)
  }
  for (const orders of choiceOrders) expect(orders.size).toBeGreaterThan(1)
  expect(blockOrders.size).toBeGreaterThan(1)
  // Draft edits and new publications never reinterpret a saved response.
  await operator(`${base}/draft`, { expectedVersion: (await read()).flow.draftVersion, stepId: anchor, prompt: 'A revised workshop question', required: true,
    questionSettings: { ...draft.steps[0].questionSettings, randomizeChoices: false } }, 'PUT')
  expect((await publicCall<PublicFlow>(201)).steps[0].prompt).toBe(questions[0].prompt)
  const copy = await operator<{ id: string }>(`${base}/duplicate`, { title: 'Next workshop survey', slug: `copy-${slug}` })
  const copied = await operator<BuilderDraft>(`/api/app/flows/${copy.id}/draft`)
  const copiedQuestions = copied.steps.filter(step => step.kind === 'question')
  expect(copied.steps[0].questionSettings?.screen).toMatchObject({ randomize: true, questionIds: copiedQuestions.map(step => step.id) })
  expect(copiedQuestions.slice(1).every(step => step.questionSettings?.randomizeChoices === true)).toBe(true)
  expect(copiedQuestions.every(step => !questions.some(original => original.id === step.id))).toBe(true)
  expect(copiedQuestions.every(step => copied.choices.some(choice => choice.stepId === step.id && choice.id === step.questionSettings?.otherChoiceId))).toBe(true)
  await operator(`/api/app/flows/${copy.id}/publish`, { expectedVersion: copied.flow.draftVersion })
  await operator(`${base}/publish`, { expectedVersion: (await read()).flow.draftVersion })
  const resumed = await publicCall<Extract<SavedResponseState, { state: 'open' }>>(201, '/resume', { token: await resumeBearer(env.SESSION_SECRET, saved.sessionId, commandKey) })
  expect(resumed.state).toBe('open')
  expect(resumed.revisionId).toBe(saved.revisionId)
  expect(resumed.answers).toEqual([answers[0]])
  expect(resumed.flow.steps[0].prompt).toBe(questions[0].prompt)
  expect(resumed.flow.presentation).toEqual(saved.flow.presentation)
  await remember(resumed)
  await finish(201, resumed)
  const seen = new Set<string>()
  for (let offset = 0; seen.size < 200;) {
    const ledger = await operator<{ total: number; responses: LedgerResponse[] }>(`${base}/ledger?offset=${offset}`)
    expect(ledger.total).toBe(200)
    expect(ledger.responses.length).toBeGreaterThan(0)
    offset += ledger.responses.length
    for (const row of ledger.responses) { expect(row.presentedOrder).toEqual(expected.get(row.id)); seen.add(row.id) }
  }
  expect([...seen].sort()).toEqual([...expected.keys()].sort())
  const download = async (format: 'json' | 'csv') => {
    const start = await operator<{ token: string; total: number }>(`${base}/responses/export/start`, { format })
    expect(start.total).toBe(200)
    let token: string | null = start.token, content = ''
    while (token) {
      const part = await f.call(`${base}/responses/export?token=${encodeURIComponent(token)}`)
      expect(part.status).toBe(200)
      content += await part.text(); token = part.headers.get('X-Export-Next')
    }
    return content
  }
  const exported = JSON.parse(await download('json')) as { responses: LedgerResponse[] }
  expect(exported.responses).toHaveLength(200)
  for (const row of exported.responses) expect(row.presentedOrder).toEqual(expected.get(row.id))
  const [header, ...rows] = csvRows(await download('csv')), orderColumn = header.indexOf('presented_order_json'), idColumn = header.indexOf('response_id')
  expect(orderColumn).toBeGreaterThanOrEqual(0)
  expect(rows).toHaveLength(200)
  for (const row of rows) expect(JSON.parse(row[orderColumn])).toEqual(expected.get(row[idColumn]))
}, 120_000)
