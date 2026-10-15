import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { allStoredData } from './import-privacy-fixture'
import { counts, googleHttp, type ImportJob } from './google-import-http'
import { ambiguousGoogleCsv, answerCanary, branchDefinition, googleInput, ordinaryEmail, quoteCsv, simpleGoogleJson, skippedIdentity } from '../fixtures/form-import/google-fixture'
import type { ImportInput } from '../../src/core/features/importing/model'
declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(() => applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__))
contract(['IMPORT-001', 'IMPORT-002', 'IMPORT-003', 'IMPORT-004'], 'Google public commit pins anonymous history, omits every identity copy, replays both files and undoes without mail', async () => {
  const f = await googleHttp(), before = await counts(), initial = await f.review(googleInput)
  const first = initial.questions.find(question => question.sourceId === 'first')!, second = initial.questions.find(question => question.sourceId === 'second')!
  const input = { ...googleInput, columns: initial.columns.map(column => column.column === 3 ? { ...column, target: first.id } : column.column === 4 ? { ...column, target: second.id } : column) }
  const { report, job } = await f.commit(input)
  const rows = (await env.DB.prepare('SELECT r.*,v.state AS revision_state FROM responses r JOIN flow_revisions v ON v.id=r.revision_id WHERE r.flow_id=? ORDER BY r.completed_at').bind(report.flowId).all()).results
  expect(rows).toHaveLength(2)
  expect(rows.map(row => row.completed_at)).toEqual(['2026-04-22T23:10:11.000Z', '2026-04-24T01:12:13.000Z'])
  expect(rows.every(row => row.source === 'imported' && row.state === 'released' && row.participant_id === null && row.revision_state === 'published')).toBe(true)
  expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM responses r JOIN respondent_sessions s ON s.id=r.session_id WHERE r.flow_id=?').bind(report.flowId).first())).toEqual({ n: 0 })
  const answers = (await env.DB.prepare('SELECT a.step_id,a.value_json FROM response_answers a JOIN responses r ON r.id=a.response_id WHERE r.flow_id=? ORDER BY r.completed_at,a.step_id').bind(report.flowId).all()).results
  expect(answers).toContainEqual({ step_id: first.id, value_json: JSON.stringify('left') }); expect(answers).toContainEqual({ step_id: second.id, value_json: JSON.stringify('right') })
  expect(JSON.stringify(answers)).toContain(answerCanary)
  const stored = await allStoredData(); expect(stored).not.toContain(skippedIdentity); expect(stored).not.toContain('PRIVATE-GRADE-73f2a'); expect(stored).not.toContain('SYNTHETIC-PRIVATE-73f2a')
  const after = await counts()
  for (const table of ['distribution_contacts', 'invitation_participants', 'invitation_launches', 'respondent_sessions', 'response_outbox', 'mail_deliveries', 'local_mail_outbox', 'rer_mail_development_outbox', 'revision_metric_counters', 'notification_deliveries', 'notification_attempts']) expect(after[table], table).toBe(before[table])
  const results = await f.call(`/api/app/flows/${report.flowId}/results`); expect(results.status).toBe(200)
  expect(await results.json()).toMatchObject({ importedResponses: 2, liveCompletedResponses: 0, starts: 0, completionRate: 0, averageCompletionMilliseconds: 0 })
  const again = await f.commit(input); expect(again.job.id).toBe(job.id); expect(again.report.alreadyImported).toBe(true)
  expect(await counts()).toEqual(after)
  const reinterpretedInput = { ...input, google: { timeZone: 'UTC' } }, reinterpreted = await f.review(reinterpretedInput)
  expect(reinterpreted.alreadyImported).toBe(true)
  const replay = await f.call('/api/app/imports/commit', { ...reinterpretedInput, plannedAt: reinterpreted.plannedAt, fingerprint: reinterpreted.fingerprint, acknowledged: true })
  expect(replay.status).toBe(200); expect((await replay.json() as ImportJob).id).toBe(job.id)
  expect((await env.DB.prepare('SELECT completed_at FROM responses WHERE flow_id=? ORDER BY completed_at').bind(report.flowId).all()).results).toEqual(rows.map(row => ({ completed_at: row.completed_at })))
  expect(await counts()).toEqual(after)
  const other = await googleHttp(f.workspace)
  const recognized = await other.review(input); expect(recognized.heldByOtherOperator).toBe(true)
  const otherBefore = await counts()
  for (const action of ['resume', 'undo']) {
    const denied = await other.call(`/api/app/imports/${job.id}/${action}`, {}); expect(denied.status).toBe(400)
    expect(await denied.text()).not.toContain(answerCanary)
  }
  expect(await counts()).toEqual(otherBefore)
  const undo = await f.call(`/api/app/imports/${job.id}/undo`, {}); expect(undo.status).toBe(200); await f.finish(await undo.json(), 'undone')
  expect((await (await f.call(`/api/app/imports/${job.id}/undo`, {})).json() as ImportJob).state).toBe('undone')
  expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM responses WHERE flow_id=?').bind(report.flowId).first()).toEqual({ n: 0 })
  expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM flows WHERE id=?').bind(report.flowId).first()).toEqual({ n: 0 })
}, 90_000)
contract(['IMPORT-002', 'IMPORT-004'], 'CSV-only public route preserves whole labels, prepares privately and resumes custody; revoked sessions cannot continue', async () => {
  const f = await googleHttp(), input: ImportInput = { source: 'google-forms', definition: '', csv: quoteCsv([['Timestamp', 'Answer', 'Email Address'], ...Array.from({ length: 23 }, (_, i) => ['23/04/2026 ' + String(i).padStart(2, '0') + ':10:11', i === 0 ? answerCanary : `Historical answer ${i}`, skippedIdentity])]), google: { title: 'Flat historical form', timeZone: 'Australia/Brisbane', questions: [{ sourceId: 'csv:1', type: 'short_text' }] } }
  const checkbox: ImportInput = { ...input, csv: quoteCsv([['Timestamp', 'Colors', 'Workspace preference', 'Email address remarks'], ['23/04/2026 09:10:11', 'Red', 'Shared office', 'Work email preferred'], ['24/04/2026 09:10:11', 'Blue', 'Private office', 'Personal email preferred'], ['25/04/2026 09:10:11', 'Red, Blue', 'Remote', 'Either address']]), google: { ...input.google, questions: [{ sourceId: 'csv:1', type: 'multiple_choice', choices: ['Red', 'Blue'] }] } }
  const before = await counts(), refused = await f.review(checkbox)
  expect(refused.rowErrors).toEqual([expect.objectContaining({ row: 4, column: 'Colors' })])
  expect(refused.responseCount).toBe(2)
  expect((await f.call('/api/app/imports/commit', { ...checkbox, columns: refused.columns, plannedAt: refused.plannedAt, fingerprint: refused.fingerprint, acknowledged: true })).status).toBe(400)
  expect(await counts()).toEqual(before)
  for (const definition of ['', JSON.stringify({ info: { title: 'Colors' }, items: [{ itemId: 'colors-item', title: 'Colors', questionItem: { question: { questionId: 'colors', choiceQuestion: { type: 'CHECKBOX', options: [{ value: 'Red' }, { value: '1' }] } } } }] })]) {
    const selected: ImportInput = { ...checkbox, definition, csv: quoteCsv([['Timestamp', 'Colors'], ['23/04/2026 09:10:11', 'Red'], ['24/04/2026 09:10:11', '1']]), google: { ...checkbox.google, questions: definition ? [] : [{ sourceId: 'csv:1', type: 'multiple_choice', choices: ['Red', '1'] }] } }
    const reviewed = await f.review(selected), question = reviewed.questions.find(question => question.prompt === 'Colors')!
    expect(reviewed.rowErrors).toEqual([])
    expect(reviewed.responseCount).toBe(2)
    const choice = question.choices.find(option => option.label === 'Red')!.id
    const forged = { ...selected, plannedAt: reviewed.plannedAt, columns: reviewed.columns.map(column => column.column === 1 ? { ...column, choice } : column) }
    expect((await f.call('/api/app/imports/review', forged)).status).toBe(400)
    expect(await counts()).toEqual(before)
    expect((await f.call('/api/app/imports/commit', { ...forged, fingerprint: reviewed.fingerprint, acknowledged: true })).status).toBe(400)
    expect(await counts()).toEqual(before)
  }
  const whole = await f.commit({ ...checkbox, google: { ...checkbox.google, questions: [{ sourceId: 'csv:1', type: 'multiple_choice', choices: ['Red', 'Blue', 'Red, Blue'] }] } })
  const question = whole.report.questions.find(question => question.sourceId === 'csv:1')!
  const preserved = (await env.DB.prepare('SELECT a.value_json FROM response_answers a JOIN responses r ON r.id=a.response_id WHERE r.flow_id=? AND a.step_id=? ORDER BY r.completed_at').bind(whole.report.flowId, question.id).all<{ value_json: string }>()).results
  expect(preserved.map(answer => JSON.parse(answer.value_json))).toEqual(question.choices.map(choice => [choice.id]))
  for (const [title, expected] of [['Workspace preference', ['Shared office', 'Private office', 'Remote']], ['Email address remarks', ['Work email preferred', 'Personal email preferred', 'Either address']]] as const) {
    const ordinary = whole.report.questions.find(question => question.prompt === title)!
    expect(ordinary.questionType).toBe('short_text')
    const answers = (await env.DB.prepare('SELECT a.value_json FROM response_answers a JOIN responses r ON r.id=a.response_id WHERE r.flow_id=? AND a.step_id=? ORDER BY r.completed_at').bind(whole.report.flowId, ordinary.id).all<{ value_json: string }>()).results
    expect(answers.map(answer => JSON.parse(answer.value_json))).toEqual(expected)
  }
  const review = await f.review(input)
  const prepared = await f.call('/api/app/imports/commit', { ...input, columns: review.columns, plannedAt: review.plannedAt, fingerprint: review.fingerprint, acknowledged: true })
  expect(prepared.status).toBe(200); const job = await prepared.json() as ImportJob; expect(job.state).toBe('preparing')
  expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM flows WHERE id=?').bind(review.flowId).first()).toEqual({ n: 0 })
  await env.DB.prepare('UPDATE oa_sessions SET revoked_at=? WHERE id=?').bind(Date.now(), f.sessionId).run()
  for (const action of ['resume', 'undo']) expect((await f.call(`/api/app/imports/${job.id}/${action}`, {})).status).toBe(401)
  await env.DB.prepare('UPDATE oa_sessions SET revoked_at=NULL WHERE id=?').bind(f.sessionId).run()
  const resumed = await f.call(`/api/app/imports/${job.id}/resume`, {}); expect(resumed.status).toBe(200)
  const partial = await resumed.json() as ImportJob; expect(partial.state).toBe('applying'); expect(partial.checkpoint).toBeGreaterThan(0)
  const interim = await env.DB.prepare('SELECT COUNT(*) AS n FROM responses WHERE flow_id=?').bind(review.flowId).first<{ n: number }>()
  expect(interim!.n).toBeGreaterThan(0); expect(interim!.n).toBeLessThan(23)
  await f.finish(partial)
  expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM responses WHERE flow_id=?').bind(review.flowId).first()).toEqual({ n: 23 })
  expect((await f.commit(input)).job.id).toBe(job.id)
  expect(await allStoredData()).not.toContain(skippedIdentity)
}, 90_000)
