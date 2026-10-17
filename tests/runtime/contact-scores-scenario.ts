import { env, SELF } from 'cloudflare:test'
import { expect } from 'vitest'
import type { BuilderDraft, LedgerResponse, QuestionReport } from '../../src/core/app/api'
import { developmentInbox } from '../helpers/mail-capture.mjs'
import { devKeyHeaders } from '../helpers/dev-key.mjs'

/** The paid mail edge supplies the login; all product work uses native HTTP. */
export async function contactScoresScenario() {
  let cookie = '', serial = 0
  const request = (path: string, data?: unknown, method = data === undefined ? 'GET' : 'POST') => SELF.fetch(`http://localhost${path}`, {
    method, headers: { cookie, Host: 'localhost', Origin: 'http://localhost', 'Content-Type': 'application/json', 'CF-Connecting-IP': `198.18.199.${++serial % 250}` },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }), redirect: 'manual',
  })
  const call = async <T,>(path: string, data?: unknown, method?: string): Promise<T> => {
    const response = await request(path, data, method)
    expect(response.ok, response.ok ? path : `${path}: ${await response.clone().text()}`).toBe(true)
    return response.status === 204 ? undefined as T : response.json<T>()
  }
  await call('/health')
  const owner = await env.DB.prepare('SELECT o.email FROM operators o JOIN operator_auth_links l ON l.operator_id=o.id JOIN oa_operators a ON a.id=l.auth_id WHERE a.status=\'active\' ORDER BY o.created_at,o.id LIMIT 1').first<{ email: string }>()
  expect(owner).not.toBeNull()
  await call('/auth/magic-link', { email: owner!.email })
  const edge = await developmentInbox(path => SELF.fetch(`http://localhost${path}`, { headers: { Host: 'localhost', ...devKeyHeaders } }), owner!.email)
  const login = await request('/auth/confirm', { token: edge.messages[0].magicLinkToken })
  expect(login.status).toBe(303)
  cookie = login.headers.get('set-cookie')!.split(';')[0]
  const slug = `northstar-intake-${crypto.randomUUID().slice(0, 8)}`
  const flow = await call<{ id: string }>('/api/app/flows', { title: 'Northstar intake and satisfaction', slug })
  const root = `/api/app/flows/${flow.id}`
  const types = ['csat', 'ces', 'emoji_rating', 'thumbs_rating', 'phone', 'postal_address', 'full_name', 'url', 'currency'] as const
  for (const type of types) {
    const draft = await call<BuilderDraft>(`${root}/draft`)
    await call(`${root}/draft/steps`, { expectedVersion: draft.flow.draftVersion, step: { kind: 'question', questionType: type, prompt: type, required: true } })
  }
  let draft = await call<BuilderDraft>(`${root}/draft`)
  await call(`${root}/draft/steps`, { expectedVersion: draft.flow.draftVersion, step: { kind: 'completion', questionType: null, prompt: 'Request received' } })
  draft = await call<BuilderDraft>(`${root}/draft`)
  await call(`${root}/publish`, { expectedVersion: draft.flow.draftVersion })
  const start = async () => {
    const session = await call<{ sessionId: string; sessionToken: string; revisionId: string }>(`/api/public/flows/${slug}/sessions`, { source: 'direct', deviceClass: 'desktop' })
    // A mature synthetic session exercises ordinary admission without changing its policy.
    await env.DB.prepare('UPDATE respondent_sessions SET created_at=? WHERE id=?').bind(new Date(Date.now() - 5000).toISOString(), session.sessionId).run()
    return session
  }
  const values: unknown[] = [5, 7, 5, false, { number: '(202) 555-0142', extension: '0123' }, { street: '560 Cedar Street', unit: 'Suite 4', city: 'Portland', state: 'or', postalCode: '972051234', country: 'us' }, { given: 'Taylor', middle: 'Alex', family: 'Reed', suffix: 'Jr.' }, 'https://EXAMPLE.TEST/intake', '1,250.50']
  const answers = (row: unknown[]) => row.map((value, index) => ({ stepId: draft.steps[index].id, value }))
  const invalidSession = await start()
  for (const [index, invalid] of [[0, 0], [1, 8], [2, 0], [3, 'yes'], [4, { number: '111' }], [5, { street: '560 Cedar Street', city: 'Portland', state: 'Oregon', postalCode: '9720', country: 'US' }], [6, { given: ' ', family: 'Reed' }], [7, 'example.test'], [8, '123.456']] as Array<[number, unknown]>) {
    const row = [...values]; row[index] = invalid
    const response = await request(`/api/public/flows/${slug}/responses`, { ...invalidSession, idempotencyKey: 'invalid-native-intake', answers: answers(row) })
    expect(response.status).toBe(400)
    expect(await response.json(), `Invalid ${types[index]} identifies its question`).toMatchObject({ error: 'VALIDATION_ERROR', details: [{ stepId: draft.steps[index].id }] })
  }
  expect((await call<{ total: number }>(`${root}/ledger`)).total).toBe(0)
  const rows = [[5, 7, 5, false], [4, 4, 4, true], [3, 1, 2, true], [1, 6, 1, false]]
  for (const [index, scores] of rows.entries()) {
    const session = index === 0 ? invalidSession : await start()
    const row = [...scores, ...values.slice(4)]
    if (index === 1) { row[5] = { street: '560 Cedar Street', city: 'Portland', state: 'OR', postalCode: '97205', country: 'US' }; row[8] = { currency: 'USD', minorUnits: 0 } }
    if (index === 2) { row[4] = { number: '+442079460123' }; row[5] = { street: '10 Downing Street', city: 'London', state: '', postalCode: 'SW1A 2AA', country: 'GB' }; row[8] = '-0.01' }
    const receipt = await call<{ responseId: string; disposition: string }>(`/api/public/flows/${slug}/responses`, { ...session, idempotencyKey: `intake-${session.sessionId}`, answers: answers(row) })
    expect(receipt.disposition).toBe('released')
    const retry = await call<{ responseId: string; idempotent: boolean }>(`/api/public/flows/${slug}/responses`, { ...session, idempotencyKey: `intake-${session.sessionId}`, answers: answers(values) })
    expect(retry).toMatchObject({ responseId: receipt.responseId, idempotent: true })
  }
  const questions = await call<QuestionReport[]>(`${root}/questions?revisionId=${invalidSession.revisionId}`)
  expect(questions.find(q => q.questionType === 'csat')?.summary.csat).toEqual({ satisfied: 2, answered: 4, percentage: 50 })
  expect(questions.find(q => q.questionType === 'ces')?.summary.ces).toEqual({ total: 18, answered: 4, mean: 4.5 })
  expect(questions.find(q => q.questionType === 'emoji_rating')?.distribution.map(bucket => bucket.count)).toEqual([1, 1, 0, 1, 1])
  expect(questions.find(q => q.questionType === 'thumbs_rating')?.distribution.map(bucket => bucket.count)).toEqual([2, 2])
  const ledger = await call<{ total: number; responses: LedgerResponse[] }>(`${root}/ledger`)
  expect(ledger.total).toBe(4)
  const native = ledger.responses.find(row => row.answers.some(a => a.questionType === 'currency' && JSON.stringify(a.value) === JSON.stringify({ currency: 'USD', minorUnits: 125050 })))!
  expect(native.participant).toBeUndefined()
  expect(native.answers.find(a => a.questionType === 'phone')).toMatchObject({ value: { number: '+12025550142', extension: '0123' }, displayValue: '(202) 555-0142 ext. 0123' })
  expect(native.answers.find(a => a.questionType === 'postal_address')?.value).toMatchObject({ state: 'OR', postalCode: '97205-1234', country: 'US' })
  expect(native.answers.find(a => a.questionType === 'full_name')?.value).toEqual({ given: 'Taylor', middle: 'Alex', family: 'Reed', suffix: 'Jr.' })
  expect(native.answers.find(a => a.questionType === 'url')?.value).toBe('https://example.test/intake')
  const download = async (format: 'json' | 'csv') => {
    let { token } = await call<{ token: string }>(`${root}/responses/export/start?format=${format}`)
    let output = ''
    while (token) { const part = await request(`${root}/responses/export`, { token }); expect(part.status).toBe(200); output += await part.text(); token = part.headers.get('x-export-next') ?? '' }
    return output
  }
  const json = JSON.parse(await download('json')) as { responses: LedgerResponse[] }
  expect(json.responses.map(row => row.id).sort()).toEqual(ledger.responses.map(row => row.id).sort())
  const csv = await download('csv')
  for (const column of ['phone.number', 'phone.extension', 'address.state', 'address.postalCode', 'name.given', 'name.family', 'currency.minorUnits']) expect(csv).toContain(column)
  for (const value of ['+12025550142', '0123', '97205-1234', '125050', '$1,250.50']) expect(csv).toContain(value)
  expect(await env.DB.prepare('PRAGMA foreign_key_check').all()).toMatchObject({ results: [] })
}
