import { devKeyHeaders } from '../helpers/dev-key.mjs'
import { createWorkerApp } from '../../src/core/app/worker'
import { createPencilPlatform } from '../../src/core/platform/runtime'
import { httpExport, allTexts } from '../helpers/report-download'
import { applyD1Migrations, env, SELF, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { collectAnswerScenario, type ScenarioCall } from '../results-scenario'
import { beginHistoricalScenario } from '../import-results-scenario'
import { developmentInbox } from '../helpers/development-outbox'
import { ReportingRepository } from '../../src/core/features/reporting/repository'
import type { QuestionReport, Ledger, FlowResults, BuilderDraft, RevisionComparison } from '../../src/core/app/api'
declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
let cookie = ''
let serial = 0
const call: ScenarioCall = async <T,>(path: string, data?: unknown, method = data === undefined ? 'GET' : 'POST'): Promise<T> => {
  if (path.includes('/responses/export') && !path.includes('/start') && !path.includes('token=')) return httpExport<T>(target => SELF.fetch(`http://localhost${target}`, { headers: { Host: 'localhost', cookie } }),path)
  const response = await SELF.fetch(`http://localhost${path}`, { method, headers: { Host: 'localhost', cookie, Origin: 'http://localhost', 'content-type': 'application/json', 'CF-Connecting-IP': `198.18.166.${++serial % 250}` }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) })
  expect(response.status, path).toBeGreaterThanOrEqual(200)
  expect(response.status, response.ok ? path : `${path}: ${await response.text()}`).toBeLessThan(300)
  return response.status === 204 ? undefined as T : await response.json<T>()
}
beforeAll(async () => {
  await applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__)
  await call('/health')
  const operator = await env.DB.prepare('SELECT email FROM operators ORDER BY created_at, id LIMIT 1').first<{ email: string }>()
  expect(operator).not.toBeNull()
  await call('/auth/magic-link', { email: operator!.email })
  const inbox = await developmentInbox(path => SELF.fetch(`http://localhost${path}`, { headers: { Host: 'localhost', ...devKeyHeaders } }), operator!.email)
  const login = await SELF.fetch('http://localhost/auth/confirm', { method: 'POST', headers: { Host: 'localhost', Origin: 'http://localhost', 'content-type': 'application/json' }, body: JSON.stringify({ token: inbox.messages[0].magicLinkToken }), redirect: 'manual' })
  expect(login.status).toBe(303)
  cookie = login.headers.get('set-cookie')!.split(';')[0]
})
contract(['RSLT-001', 'RSLT-002', 'RSLT-005', 'LEDG-001', 'LEDG-003', 'DATA-002', 'BASE-ACCESS-002'], 'native query summaries retain every type with immutable evidence and correct revision denominators', async () => {
  const scenario = await collectAnswerScenario(call, 'native-answer-summary-study')
  expect(scenario.questions).toHaveLength(13)
  expect(scenario.questions.map(question => question.questionType)).toEqual(['short_text', 'long_text', 'email', 'single_choice', 'multiple_choice', 'rating', 'priority', 'dropdown', 'yes_no', 'nps', 'number', 'date', 'consent'])
  expect(scenario.questions.every(question => question.answered === 12)).toBe(true)
  const question = (type: string) => scenario.questions.find(question => question.questionType === type)!
  expect(await allTexts(call, scenario.path, scenario.revisionId, question('long_text').id)).toEqual(Array.from({ length: 12 }, (_, index) => `Exact retained answer ${11 - index}`))
  const textQuery=`${scenario.path}/questions/text?revisionId=${scenario.revisionId}&questionId=${question('long_text').id}`
  const textStart=await call<{texts:string[];countCursor:string}>(textQuery)
  expect(textStart.texts).toHaveLength(5)
  let countStatements=0
  const measured=new Proxy(env.DB,{get(target,key) {if(key==='prepare') return (sql:string)=>{countStatements++;return target.prepare(sql)};const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value}})
  const app=createWorkerApp(undefined,createPencilPlatform('http://localhost',{...env,DB:measured,SEED_SAMPLE_DATA:'false'}))
  const counted=await app.fetch(new Request(`http://localhost${textQuery}&countOnly=true&cursor=${encodeURIComponent(textStart.countCursor)}`,{headers:{Host:'localhost',cookie}}))
  expect(counted.status).toBe(200);expect(await counted.json()).toMatchObject({texts:[],matching:12})
  expect(countStatements).toBe(6)
  const countDenied=await SELF.fetch(`http://localhost${textQuery}&countOnly=true&cursor=${encodeURIComponent(textStart.countCursor)}`,{headers:{Host:'localhost'}})
  expect(countDenied.status).toBe(401);expect(await countDenied.text()).not.toContain('Exact retained answer')
  expect(question('multiple_choice').distribution.map(bucket => bucket.count)).toEqual([12, 12])
  expect(question('rating').summary.average).toBe(2.75)
  expect(question('nps').summary).toEqual({ score: -50, promoters: 2, passives: 2, detractors: 8 })
  expect(question('number').summary).toEqual({ minimum: -5.5, median: 0, maximum: 5.5 })
  expect(question('date').summary).toEqual({ earliest: '2024-02-01', latest: '2024-02-12' })
  expect(question('consent').distribution.map(bucket => bucket.count)).toEqual([6, 6])
  expect(question('priority').summary.positions?.map(position => position.average)).toEqual([1.5, 1.5])
  expect(scenario.ledger.total).toBe(12)
  expect(scenario.ledger.responses[0].answers).toHaveLength(13)
  expect(scenario.ledger.responses[0].answers.find(answer => answer.questionType === 'consent')?.value).toEqual({ accepted: false, statement: 'I agree to the stated terms.' })
  expect(scenario.comparison.questions.every(question => question.answered === 12 && question.eligibleResponses === 12)).toBe(true)
  const denied = await SELF.fetch(`http://localhost${scenario.path}/questions?revisionId=${scenario.revisionId}`, { headers: { Host: 'localhost' } })
  expect(denied.status).toBe(401)
  expect(await denied.text()).not.toContain('Exact retained answer')
  await call(`/api/app/responses/${scenario.receipts[11]}`, undefined, 'DELETE')
  const after = await call<QuestionReport[]>(`${scenario.path}/questions?revisionId=${scenario.revisionId}`)
  expect(after.filter(question => question.questionType).every(question => question.answered === 11)).toBe(true)
  expect(await allTexts(call,scenario.path,scenario.revisionId,question('long_text').id)).not.toContain('Exact retained answer 11')
  expect((await call<Ledger>(`${scenario.path}/ledger?revisionId=${scenario.revisionId}`)).total).toBe(11)
  const emptySession = await call<{ sessionId: string; sessionToken: string }>('/api/public/flows/native-answer-summary-study/sessions', { deviceClass: 'desktop', source: 'direct' })
  const empty = await call<{ responseId: string; disposition: string }>('/api/public/flows/native-answer-summary-study/responses', { ...emptySession, idempotencyKey: 'empty-answer-path-study', answers: [] })
  if (empty.disposition === 'quarantined') await call(`/api/app/responses/${empty.responseId}/release`, {})
  const emptyLedger = await call<Ledger>(`${scenario.path}/ledger`)
  const retainedEmpty = emptyLedger.responses.find(response => response.id === empty.responseId)!
  expect(retainedEmpty.answers).toEqual([])
  expect(retainedEmpty.omittedQuestions).toHaveLength(13)
  expect(retainedEmpty.omittedQuestions.map(question => question.position)).toEqual(Array.from({ length: 13 }, (_, index) => index))
  expect(await env.DB.prepare('SELECT count(*) AS count FROM response_answers WHERE response_id = ?').bind(empty.responseId).first()).toEqual({ count: 0 })

})

contract(['RSLT-001', 'RSLT-002', 'RSLT-003', 'RSLT-004', 'RSLT-005', 'IMPORT-004', 'LEDG-001'], 'real historical imports retain answers without native telemetry and compare with later native responses', async () => {
  const imported = await beginHistoricalScenario(call, false, 'Historical native comparison study')
  await imported.finish()
  const path = `/api/app/flows/${imported.review.flowId}`
  const ledger = await call<Ledger>(`${path}/ledger?source=imported`)
  expect(ledger.total).toBe(1)
  const sourceRevision = ledger.responses[0].revisionId
  const importedResults = await call<FlowResults>(`${path}/results?revisionId=${sourceRevision}`)
  expect(importedResults).toMatchObject({ starts: 0, completedResponses: 1, liveCompletedResponses: 0, importedResponses: 1, completionRate: 0, averageCompletionMilliseconds: 0, deviceStarts: { mobile: 0, tablet: 0, desktop: 0 } })
  const importedQuestions = await call<QuestionReport[]>(`${path}/questions?revisionId=${sourceRevision}`)
  const importedQuestion = importedQuestions.find(question => question.questionType)!
  expect(importedQuestion).toMatchObject({ reached: 0, dropped: 0, answered: 1, importedAnswered: 1, summary: { texts: [] } })
  expect(await allTexts(call,path,sourceRevision,importedQuestion.id)).toEqual(['Hello'])
  const current = await call<BuilderDraft>(`${path}/draft`)
  await call(`${path}/publish`, { expectedVersion: current.flow.draftVersion })
  const session = await call<{ sessionId: string; sessionToken: string }>(`/api/public/flows/${current.flow.slug}/sessions`, { deviceClass: 'desktop', source: 'direct' })
  const receipt = await call<{ responseId: string; disposition: string }>(`/api/public/flows/${current.flow.slug}/responses`, { ...session, idempotencyKey: 'historical-and-native-answer', answers: [{ stepId: importedQuestion.id, value: 'Native answer' }] })
  if (receipt.disposition === 'quarantined') await call(`/api/app/responses/${receipt.responseId}/release`, {})
  expect(await call<FlowResults>(`${path}/results`)).toMatchObject({ starts: 1, completedResponses: 1, liveCompletedResponses: 1, importedResponses: 0, completionRate: 1 })
  const comparison = await call<RevisionComparison>(`${path}/questions/compare`)
  const combined = comparison.questions.find(question => question.id === importedQuestion.id)!
  expect(combined).toMatchObject({ answered: 2, eligibleResponses: 2 })
  expect(combined.versions.map(question => [question.answered, question.importedAnswered, question.reached])).toEqual([[1, 0, 1], [1, 1, 0]])
  expect((await call<Ledger>(`${path}/ledger`)).total).toBe(2)
  expect((await call<{ responses: unknown[] }>(`${path}/responses/export?source=imported`)).responses).toHaveLength(1)
  const countersBefore = (await env.DB.prepare('SELECT m.* FROM revision_metric_counters m JOIN flow_revisions r ON r.id = m.revision_id WHERE r.flow_id = ? ORDER BY m.revision_id').bind(imported.review.flowId).all()).results
  await call(`/api/app/responses/${ledger.responses[0].id}`, undefined, 'DELETE')
  expect((await env.DB.prepare('SELECT m.* FROM revision_metric_counters m JOIN flow_revisions r ON r.id = m.revision_id WHERE r.flow_id = ? ORDER BY m.revision_id').bind(imported.review.flowId).all()).results).toEqual(countersBefore)
  expect(await call<FlowResults>(`${path}/results?revisionId=${sourceRevision}`)).toMatchObject({ completedResponses: 0, importedResponses: 0, liveCompletedResponses: 0, starts: 0, completionRate: 0, averageCompletionMilliseconds: 0 })
  expect(await call<FlowResults>(`${path}/results`)).toMatchObject({ completedResponses: 1, liveCompletedResponses: 1, starts: 1, completionRate: 1 })

})
contract(['LEDG-002', 'IMPORT-004'], 'fixed export cutoffs exclude historical rows actually committed by a later resumed import batch', async () => {
  const imported = await beginHistoricalScenario(call, true, 'Historical cutoff study')
  expect(imported.job.state).toBe('applying')
  const workspace = await call<{ id: string }>('/api/app/workspace')
  const repository = new ReportingRepository(env.DB)
  const cutoff = new Date().toISOString()
  const before = await repository.ledger(workspace.id, imported.review.flowId, { source: 'imported' }, cutoff)
  expect(before.total).toBeGreaterThan(0)
  expect(before.total).toBeLessThan(27)
  await new Promise(resolve => setTimeout(resolve, 20))
  await imported.finish()
  const retained = await repository.ledger(workspace.id, imported.review.flowId, { source: 'imported' }, cutoff)
  expect(retained.total).toBe(before.total)
  expect(retained.responses.map(response => response.id)).toEqual(before.responses.map(response => response.id))
  const latest = await call<Ledger>(`/api/app/flows/${imported.review.flowId}/ledger?source=imported`)
  expect(latest.total).toBe(27)
  expect(latest.responses.every(response => response.completedAt < cutoff && response.releasedAt < cutoff)).toBe(true)
})
