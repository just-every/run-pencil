import { devKeyHeaders } from '../helpers/dev-key.mjs'
import { httpExport, allTexts } from '../helpers/report-download'
import { applyD1Migrations, env, SELF, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { developmentInbox } from '../helpers/development-outbox'
import { collectLedgerFilterScenario, consentStatement } from '../ledger-filter-scenario'
import type { ScenarioCall } from '../results-scenario'
import type { Ledger, LedgerResponse, FlowResults } from '../../src/core/app/api'
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
      expect(response.completedAt <= snapshot.cutoff && response.releasedAt <= snapshot.cutoff).toBe(true)
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
