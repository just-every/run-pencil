import { env, SELF } from 'cloudflare:test'
import { expect } from 'vitest'
import { developmentInbox } from '../helpers/development-outbox'
import { devKeyHeaders } from '../helpers/dev-key.mjs'
import { matureLoad } from './load-time-fixture'
import { csvRows } from '../e2e/export-helpers'
import type { BuilderDraft, Ledger, QuestionReport } from '../../src/core/app/api'
import type { Crosstab } from '../../src/core/features/reporting'

type Session = { sessionId: string; sessionToken: string; loadTime: string; revisionId: string }
/** One native-door journey covers grid authoring, collection and downstream custody. */
export async function matrixScenario() {
  let cookie = '', address = 0
  const request = (path: string, data?: unknown, method = data === undefined ? 'GET' : 'POST', authenticated = true) => SELF.fetch('http://localhost' + path, {
    method, headers: { Host: 'localhost', Origin: 'http://localhost', 'Content-Type': 'application/json', Cookie: authenticated ? cookie : '', 'CF-Connecting-IP': `198.18.211.${++address % 250}` },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }), redirect: 'manual',
  })
  const call = async <T,>(path: string, data?: unknown, method?: string): Promise<T> => {
    const response = await request(path, data, method)
    expect(response.ok, response.ok ? path : await response.text()).toBe(true)
    return response.status === 204 ? undefined as T : response.json<T>()
  }
  const owner = await env.DB.prepare('SELECT email FROM operators WHERE is_setup_operator = 1 LIMIT 1').first<{ email: string }>()
  await call('/auth/magic-link', { email: owner!.email })
  const inbox = await developmentInbox(path => SELF.fetch('http://localhost' + path, { headers: { Host: 'localhost', ...devKeyHeaders } }), owner!.email)
  const login = await request('/auth/confirm', { token: inbox.messages[0].magicLinkToken })
  expect(login.status).toBe(303); cookie = login.headers.get('set-cookie')!.split(';')[0]
  const slug = 'synthetic-pencil-matrix', flow = await call<{ id: string }>('/api/app/flows', { title: 'Service experience', slug })
  const root = `/api/app/flows/${flow.id}`, read = () => call<BuilderDraft>(root + '/draft')
  const rows = ['Clarity', 'Speed', 'Quality', 'Support'].map((label, index) => ({ id: `synthetic-pencil-${index + 1}`, label }))
  const scale = ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'].map((label, index) => ({ label, value: String(index + 1) }))
  const add = async (step: unknown) => call(root + '/draft/steps', { expectedVersion: (await read()).flow.draftVersion, step })
  await add({ kind: 'question', questionType: 'matrix', prompt: 'Rate your experience', required: true, questionSettings: { matrixRows: rows, matrixMode: 'likert5' }, choices: scale })
  await add({ kind: 'question', questionType: 'matrix', prompt: 'What helped?', required: false, questionSettings: { matrixRows: rows.slice(0, 2), matrixMode: 'multiple' }, choices: scale })
  await add({ kind: 'completion', questionType: null, prompt: 'Thank you' })
  await add({ kind: 'completion', questionType: null, prompt: 'We will follow up' })
  let draft = await read()
  const [matrix, multiple, normal, follow] = draft.steps, options = draft.choices.filter(choice => choice.stepId === matrix.id), multiOptions = draft.choices.filter(choice => choice.stepId === multiple.id)
  const condition = { kind: 'test', stepId: matrix.id, rowId: rows[0].id, operator: 'equals', value: options[0].id }
  await call(root + '/draft/branches', { expectedVersion: draft.flow.draftVersion, rules: [{ sourceStepId: multiple.id, predicateKind: 'equals', expectedValue: options[0].id, condition, destinationStepId: follow.id, position: 0 }] }, 'PUT')
  draft = await read()
  const invalidRule = { ...draft.branchRules[0], condition: { ...condition, rowId: 'synthetic-pencil-unknown' } }
  const refusedRule = await request(root + '/draft/branches', { expectedVersion: draft.flow.draftVersion, rules: [invalidRule] }, 'PUT')
  // Invalid operand references are refused at publication, even when a draft may retain an incomplete edit.
  if (refusedRule.ok) {
    const refused = await call<{ kind: string }>(root + '/publish', { expectedVersion: (await read()).flow.draftVersion })
    expect(refused.kind).not.toBe('published')
    await call(root + '/draft/branches', { expectedVersion: (await read()).flow.draftVersion, rules: draft.branchRules }, 'PUT')
  } else expect(refusedRule.status).toBe(400)
  const published = await call<{ kind: string; revision: { id: string } }>(root + '/publish', { expectedVersion: (await read()).flow.draftVersion })
  expect(published.kind).toBe('published')
  const start = async () => { const session = await call<Session>(`/api/public/flows/${slug}/sessions`, { source: 'direct', deviceClass: 'desktop' }); await matureLoad(session); return session }
  const body = (session: Session, value: unknown, extra: unknown = {}) => ({ ...session, idempotencyKey: `synthetic-pencil-${session.sessionId}`, answers: [{ stepId: matrix.id, value }, { stepId: multiple.id, value: extra }] })
  const answer = (first: number, second: number) => Object.fromEntries(rows.map((row, index) => [row.id, options[index === 0 ? first : index === 1 ? second : 2].id]))
  const session = await start()
  for (const value of [{ [rows[0].id]: options[0].id }, { ...answer(0, 0), unknown: options[0].id }, { ...answer(0, 0), [rows[0].id]: [options[0].id] }]) {
    expect((await request(`/api/public/flows/${slug}/responses`, body(session, value))).status).toBe(400)
  }
  expect((await call<Ledger>(root + '/ledger')).total).toBe(0)
  const receipts: Array<{ responseId: string }> = []
  for (let first = 0; first < 5; first++) for (let second = 0; second < 5; second++) {
    const current = first === 0 && second === 0 ? session : await start()
    const receipt = await call<{ responseId: string; completionStepId: string }>(`/api/public/flows/${slug}/responses`, body(current, answer(first, second), first === 0 ? { [rows[0].id]: [multiOptions[0].id, multiOptions[1].id] } : {}))
    expect(receipt.completionStepId).toBe(first === 0 ? follow.id : normal.id); receipts.push(receipt)
  }
  for (let i = 0; i < 4; i++) receipts.push(await call(`/api/public/flows/${slug}/responses`, body(await start(), answer(0, 0))))
  const replay = await call<{ responseId: string; idempotent: boolean }>(`/api/public/flows/${slug}/responses`, body(session, answer(4, 4)))
  expect(replay).toMatchObject({ responseId: receipts[0].responseId, idempotent: true })
  const report = await call<QuestionReport[]>(root + '/questions?revisionId=' + published.revision.id)
  const grid = report.find(question => question.id === matrix.id)!.summary.matrixRows!
  expect(grid.map(row => [row.id, row.answered, row.distribution.map(bucket => bucket.count)])).toEqual([
    [rows[0].id, 29, [9, 5, 5, 5, 5]], [rows[1].id, 29, [9, 5, 5, 5, 5]], [rows[2].id, 29, [0, 0, 29, 0, 0]], [rows[3].id, 29, [0, 0, 29, 0, 0]],
  ])
  const multigrid = report.find(question => question.id === multiple.id)!.summary.matrixRows!
  expect(multigrid.map(row => [row.answered, row.multipleSelect, row.distribution.map(bucket => bucket.count)])).toEqual([[5, true, [5, 5, 0, 0, 0]], [0, true, [0, 0, 0, 0, 0]]])
  const exportText = async (format: string) => {
    let { token } = await call<{ token: string }>(root + '/responses/export/start?format=' + format)
    let result = ''
    while (token) { const response = await request(root + '/responses/export', { token }); expect(response.status).toBe(200); result += await response.text(); token = response.headers.get('x-export-next') ?? '' }
    return result
  }
  const [head, ...records] = csvRows(await exportText('csv'))
  for (const row of rows) expect(head).toContain(`${matrix.id}.${row.id}`)
  expect(records).toHaveLength(29)
  const original = records.find(record => record[0] === receipts[0].responseId)!
  expect(original[head.indexOf(`${matrix.id}.${rows[0].id}`)]).toBe(options[0].id)
  expect(JSON.parse(original[head.indexOf(`${multiple.id}.${rows[0].id}`)])).toEqual([multiOptions[0].id, multiOptions[1].id])
  const exported = JSON.parse(await exportText('json')) as { responses: Ledger['responses'] }
  expect(exported.responses.find(row => row.id === receipts[0].responseId)!.answers.find(row => row.stepId === matrix.id)!.value).toEqual(answer(0, 0))
  const policies = await call<Record<string, unknown>>('/api/app/analysis/policies')
  await call('/api/app/analysis/policies', { ...policies, disclosureThreshold: 1 }, 'PUT')
  const crossPath = root + '/crosstab?' + new URLSearchParams({ revisionId: published.revision.id, rows: `matrix:${matrix.id}:${rows[0].id}`, columns: `matrix:${matrix.id}:${rows[1].id}` })
  const crossed = await call<Crosstab>(crossPath)
  expect(crossed.cells.map(row => row.map(cell => cell.suppressed ? null : cell.count))).toEqual([[5, 1, 1, 1, 1], [1, 1, 1, 1, 1], [1, 1, 1, 1, 1], [1, 1, 1, 1, 1], [1, 1, 1, 1, 1]])
  expect(crossed.cells[0][0].suppressed ? null : crossed.cells[0][0].rowShare).toEqual({ numerator: 5, denominator: 9, percentage: 5 / 9 * 100 })
  expect(crossed.chiSquare).toMatchObject({ offered: true, flagged: false })
  await call('/api/app/analysis/policies', { ...policies, disclosureThreshold: 5 }, 'PUT')
  const suppressed = await call<Crosstab>(crossPath)
  expect(suppressed.cells[0][0]).toMatchObject({ count: 5, suppressed: false })
  expect(suppressed.cells[0][1]).toMatchObject({ suppressed: true })
  expect(suppressed.total).toEqual({ withheld: true }); expect(suppressed.chiSquare).toMatchObject({ withheld: true })
  const multiCross = await call<Crosstab>(root + '/crosstab?' + new URLSearchParams({ revisionId: published.revision.id, rows: `matrix:${multiple.id}:${rows[0].id}`, columns: `matrix:${multiple.id}:${rows[1].id}` }))
  expect(multiCross.chiSquare.offered).toBe(false)
  await call('/api/app/responses/' + receipts[0].responseId, {}, 'DELETE')
  expect((await call<Ledger>(root + '/ledger')).total).toBe(28)
  expect((await request(`/api/public/flows/${slug}/responses`, body(session, answer(0, 0)))).status).toBeGreaterThanOrEqual(400)
  expect((await call<QuestionReport[]>(root + '/questions?revisionId=' + published.revision.id)).find(question => question.id === matrix.id)!.summary.matrixRows![0].answered).toBe(28)
  expect((await request(root + '/questions', undefined, 'GET', false)).status).toBe(401)
  // Published row identity survives draft label and order edits; the new draft also offers seven-point Likert.
  draft = await read()
  await call(root + '/draft', { stepId: matrix.id, prompt: matrix.prompt, required: true, expectedVersion: draft.flow.draftVersion, questionSettings: { matrixRows: [...rows].reverse().map(row => ({ ...row, label: 'Updated ' + row.label })), matrixMode: 'likert7' }, choices: [...options.map(option => ({ id: option.id, value: option.value, label: option.label })), { value: '6', label: 'Very much agree' }, { value: '7', label: 'Completely agree' }] }, 'PUT')
  expect((await read()).steps[0].questionSettings!.matrixRows).toEqual([...rows].reverse().map(row => ({ ...row, label: 'Updated ' + row.label })))
  expect((await call<QuestionReport[]>(root + '/questions?revisionId=' + published.revision.id)).find(question => question.id === matrix.id)!.summary.matrixRows!.map(row => row.label)).toEqual(rows.map(row => row.label))
}
