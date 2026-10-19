import { collectResponseSearchScenario } from '../response-search-scenario'
import { devKeyHeaders } from '../helpers/dev-key.mjs'
import { httpExport, allTexts } from '../helpers/report-download'
import { applyD1Migrations, env, SELF, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { developmentInbox } from '../helpers/development-outbox'
import { collectLedgerFilterScenario, consentStatement } from '../ledger-filter-scenario'
import type { ScenarioCall } from '../results-scenario'
import type { BuilderDraft, Ledger, LedgerResponse, FlowResults } from '../../src/core/app/api'
import { ReportingRepository } from '../../src/core/features/reporting/repository'

declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
let cookie = '', serial = 0
const call: ScenarioCall = async <T,>(path: string, data?: unknown, method = data === undefined ? 'GET' : 'POST'): Promise<T> => {
  if (path.includes('/responses/export') && !path.includes('/start') && !path.includes('token=')) return httpExport<T>(target => SELF.fetch(`http://localhost${target}`, { headers: { Host: 'localhost', cookie } }),path)
  const response = await SELF.fetch(`http://localhost${path}`, { method, headers: { Host: 'localhost', cookie, Origin: 'http://localhost', 'content-type': 'application/json', 'CF-Connecting-IP': `198.18.170.${++serial % 250}` }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) })
  expect(response.status, path).toBeGreaterThanOrEqual(200)
  expect(response.status, path).toBeLessThan(300)
  return response.status === 204 ? undefined as T : await response.json<T>()
}
beforeAll(async () => {
  await applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__)
  await call('/health')
  const operator = await env.DB.prepare('SELECT email FROM operators ORDER BY created_at, id LIMIT 1').first<{ email: string }>()
  expect(operator).not.toBeNull()
  await call('/auth/magic-link', { email: operator!.email })
  const inbox = await developmentInbox(path => SELF.fetch('http://localhost' + path, { headers: { Host: 'localhost', ...devKeyHeaders } }), operator!.email)
  const login = await SELF.fetch('http://localhost/auth/confirm', { method: 'POST', headers: { Host: 'localhost', Origin: 'http://localhost', 'content-type': 'application/json' }, body: JSON.stringify({ token: inbox.messages[0].magicLinkToken }), redirect: 'manual' })
  expect(login.status).toBe(303)
  cookie = login.headers.get('set-cookie')!.split(';')[0]
})

contract(['LEDG-001', 'LEDG-003', 'LEDG-004', 'FLOW-019', 'IMPORT-003', 'RSLT-001', 'RSLT-003'], 'typed filters return exact native and imported IDs with retained consent and revision/source scopes in snapshot exports', async () => {
  const scenario = await collectLedgerFilterScenario(call, 'Typed response filter study')
  const positive = [scenario.nativePositive.responseId, scenario.importedPositive.id].sort()
  const negative = [scenario.nativeNegative.responseId, scenario.importedNegative.id].sort()
  const ids = (responses: LedgerResponse[]) => responses.map(response => response.id).sort()
  const numericAndDates = [['number', '11.0'], ['nps', '10.0'], ['rating', '5.0'], ['date', '2024-02-29'], ['email', 'mixed.case@example.TEST']]
  for (const [type, value] of [...['yes_no', 'consent'].flatMap(type => [[type, 'true'], [type, 'false']]), ...numericAndDates]) {
    const params = new URLSearchParams({ answerStepId: scenario.stepId(type), answerValue: value })
    const expected = value === 'false' ? negative : positive
    expect(ids((await call<Ledger>(`${scenario.path}/ledger?${params}`)).responses)).toEqual(expected)
    const snapshot = await call<{ responses: LedgerResponse[]; cutoff: string; excludedQuarantined: number }>(`${scenario.path}/responses/export?${params}`)
    expect(ids(snapshot.responses)).toEqual(expected)
    expect(snapshot.excludedQuarantined).toBe(0)
    for (const response of snapshot.responses) {
      expect(response.answers.find(answer => answer.questionType === 'consent')?.value).toEqual({ accepted: value !== 'false', statement: consentStatement })
      expect(response.completedAt <= snapshot.cutoff && response.releasedAt !== null && response.releasedAt <= snapshot.cutoff).toBe(true)
    }
    for (const [source, revisionId, expectedId] of [['direct', scenario.nativeRevisionId, expected.find(id => id === scenario.nativePositive.responseId || id === scenario.nativeNegative.responseId)!], ['imported', scenario.importedRevisionId, expected.find(id => id === scenario.importedPositive.id || id === scenario.importedNegative.id)!]]) {
      params.set('source', source); params.set('revisionId', revisionId)
      expect(ids((await call<Ledger>(`${scenario.path}/ledger?${params}`)).responses)).toEqual([expectedId])
      expect(ids((await call<{ responses: LedgerResponse[] }>(`${scenario.path}/responses/export?${params}`)).responses)).toEqual([expectedId])
    }
  }
  for (const type of ['dropdown', 'multiple_choice', 'priority']) {
    const stepId = scenario.stepId(type)
    const choice = scenario.current.choices.find(choice => choice.stepId === stepId)!
    const params = new URLSearchParams({ answerStepId: stepId, answerValue: choice.id })
    expect(ids((await call<Ledger>(`${scenario.path}/ledger?${params}`)).responses)).toEqual(type === 'priority' ? [...positive, ...negative].sort() : positive)
    expect(ids((await call<{ responses: LedgerResponse[] }>(`${scenario.path}/responses/export?${params}`)).responses)).toEqual(type === 'priority' ? [...positive, ...negative].sort() : positive)
  }
  for (const [type, values] of [['yes_no', ['1', 'TRUE', "true' OR 1=1--"]], ['consent', ['0', '{}']], ['number', ['', ' ', '11bad', '11\n', 'Infinity', '0x0']], ['date', ['2023-02-29', '2024-02-29T00:00:00Z']]] as const) for (const value of values) {
    const params = new URLSearchParams({ answerStepId: scenario.stepId(type), answerValue: value })
    expect((await call<Ledger>(`${scenario.path}/ledger?${params}`)).total).toBe(0)
    expect((await call<{ responses: LedgerResponse[] }>(`${scenario.path}/responses/export?${params}`)).responses).toEqual([])
  }
  expect(await call<FlowResults>(`${scenario.path}/results?revisionId=${scenario.importedRevisionId}`)).toMatchObject({ completedResponses: 2, importedResponses: 2, starts: 0, liveCompletedResponses: 0, completionRate: 0 })
  expect(await call<FlowResults>(`${scenario.path}/results?revisionId=${scenario.nativeRevisionId}`)).toMatchObject({ completedResponses: 2, importedResponses: 0, starts: 2, liveCompletedResponses: 2, completionRate: 1 })

  const workspace = await call<{ id: string }>('/api/app/workspace')
  const repository = new ReportingRepository(env.DB), cutoff = new Date().toISOString()
  const filter = { answerStepId: scenario.stepId('consent'), answerValue: 'false' }
  const before = await repository.ledger(workspace.id, scenario.flowId, filter, cutoff)
  const pending = await scenario.submit(false, false)
  expect(pending.disposition).toBe('quarantined')
  const exported = await call<{ responses: LedgerResponse[]; excludedQuarantined: number }>(`${scenario.path}/responses/export?${new URLSearchParams(filter)}`)
  expect(ids(exported.responses)).toEqual(negative)
  expect(exported.excludedQuarantined).toBe(1)
  await call(`/api/app/responses/${pending.responseId}/release`, {})
  expect(ids((await repository.ledger(workspace.id, scenario.flowId, filter, cutoff)).responses)).toEqual(ids(before.responses))
  expect((await call<Ledger>(`${scenario.path}/ledger?${new URLSearchParams(filter)}`)).total).toBe(3)
  expect((await repository.ledger('unrelated-workspace', scenario.flowId, filter, new Date().toISOString())).total).toBe(0)
  expect((await repository.ledger(workspace.id, 'unrelated-flow', filter, new Date().toISOString())).total).toBe(0)
}, 60_000)

contract('LEDG-006', 'response search composes with revision and source filters, exports the same released IDs and excludes erasure', async () => {
  const scenario = await collectResponseSearchScenario(call, 'ledger-search-worker')
  const ids = (rows: LedgerResponse[]) => rows.map(row => row.id).sort()
  const ledger = (search: string, extra: Record<string,string> = {}) => call<Ledger>(`${scenario.path}/ledger?${new URLSearchParams({ search, ...extra })}`)
  expect(ids((await ledger('QUEUE')).responses)).toEqual([scenario.slow, scenario.faster].sort())
  expect(ids((await ledger('queue', { revisionId: scenario.firstRevision, source: 'direct' })).responses)).toEqual([scenario.slow])
  expect(ids((await ledger('Cold brew')).responses)).toEqual([scenario.slow])
  expect(ids((await ledger('jo.cafe@example.test')).responses)).toEqual([scenario.slow])
  for (const literal of ['%_', "' OR 1=1--", 'unrecorded text']) expect((await ledger(literal)).total).toBe(0)
  const snapshot = await call<{ filter: { search: string }; responses: LedgerResponse[]; excludedQuarantined: number }>(`${scenario.path}/responses/export?search=queue`)
  expect(snapshot.filter.search).toBe('queue')
  expect(ids(snapshot.responses)).toEqual([scenario.slow, scenario.faster].sort())
  expect(snapshot.excludedQuarantined).toBe(1)
  await call(`/api/app/responses/${scenario.slow}`, undefined, 'DELETE')
  expect(ids((await ledger('queue')).responses)).toEqual([scenario.faster])
  expect((await ledger('Cold brew')).total).toBe(0)
}, 60_000)

contract('LEDG-006', 'an accented and a non-ASCII phrase match case-insensitively while wildcards stay literal', async () => {
  const slug = 'ledger-search-unicode'
  const flow = await call<{ id: string }>('/api/app/flows', { title: 'Café feedback', slug })
  const path = `/api/app/flows/${flow.id}`
  for (const step of [
    { kind: 'question', questionType: 'long_text', prompt: 'Tell us more', required: true },
    { kind: 'question', questionType: 'single_choice', prompt: 'Dessert', required: true, choices: [{ label: 'Crème brûlée', value: 'creme' }, { label: 'Tea cake', value: 'cake' }] },
    { kind: 'completion', questionType: null, prompt: 'Thank you.' },
  ]) await call(`${path}/draft/steps`, { expectedVersion: (await call<BuilderDraft>(`${path}/draft`)).flow.draftVersion, step })
  const draft = await call<BuilderDraft>(`${path}/draft`)
  await call(`${path}/publish`, { expectedVersion: draft.flow.draftVersion })
  const [text, choice] = draft.steps, options = draft.choices.filter(option => option.stepId === choice.id)
  const submit = async (message: string, option: number) => {
    const session = await call<{ sessionId: string; sessionToken: string }>(`/api/public/flows/${slug}/sessions`, { deviceClass: 'desktop', source: 'direct' })
    const receipt = await call<{ responseId: string; disposition: string }>(`/api/public/flows/${slug}/responses`, { ...session, idempotencyKey: `unicode-${session.sessionId}`, answers: [{ stepId: text.id, value: message }, { stepId: choice.id, value: options[option].id }] })
    if (receipt.disposition === 'quarantined') await call(`/api/app/responses/${receipt.responseId}/release`, {})
    return receipt.responseId
  }
  const french = await submit('Le CAFÉ était FROID', 1)
  const russian = await submit('Очень ВКУСНО', 1)
  const greek = await submit('ΚΑΦΕΣ ΚΑΛΟΣ', 1)
  const dessert = await submit('Rated 5* overall', 0)
  const found = async (search: string) => (await call<Ledger>(`${path}/ledger?${new URLSearchParams({ search })}`)).responses.map(response => response.id).sort()
  expect(await found('café était froid')).toEqual([french])
  expect(await found('очень вкусно')).toEqual([russian])
  expect(await found('καφες καλος')).toEqual([greek])
  expect(await found('CRÈME BRÛLÉE')).toEqual([dessert])
  for (const literal of ['5*', '*']) expect(await found(literal), literal).toEqual([dessert])
  // Every distinct folded letter nests one replace() under D1's expression-depth cap of 100.
  const alphabet = 'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЭЮЯΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΤΥΦΧΨΩ', widest = alphabet.slice(0, 32).repeat(6)
  expect((await call<Ledger>(`${path}/ledger?${new URLSearchParams({ search: widest, revisionId: draft.revision.id, source: 'direct' })}`)).total).toBe(0)
  expect((await call<{ responses: LedgerResponse[] }>(`${path}/responses/export?${new URLSearchParams({ search: widest })}`)).responses).toEqual([])
  expect((await call<{ responses: LedgerResponse[] }>(`${path}/responses/export?${new URLSearchParams({ search: 'ΚΑΦΕΣ' })}`)).responses.map(response => response.id)).toEqual([greek])
  for (const literal of ['cafe etait', '?', '[', '%_']) expect(await found(literal), literal).toEqual([])
  const refused = await SELF.fetch(`http://localhost${path}/ledger?${new URLSearchParams({ search: alphabet.slice(0, 33) })}`, { headers: { Host: 'localhost', cookie } })
  expect(refused.status).toBe(400)
}, 60_000)
