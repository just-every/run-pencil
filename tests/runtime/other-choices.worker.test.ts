import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { ulid } from 'ulid'
import { contract } from '../../src/test/contract'
import type { BuilderDraft, LedgerResponse, QuestionReport } from '../../src/core/app/api'
import type { ImportInput, ImportReview } from '../../src/core/features/importing/model'
import { authoringClient } from './choice-recall-fixture'
import { otherEvidenceScenario } from './other-evidence-scenario'

declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(() => applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__))

contract(['FIELD-010', 'IMPORT-003', 'LEDG-002'], 'Other write-ins and exclusive None retain stable choices through native collection, reports, exports, copies and source JSON imports', async () => {
  const f = await authoringClient(), form = await f.create('Northstar service choices')
  const roles = Array.from({ length: 3 }, () => ({ fixed: ulid(), other: ulid(), none: ulid() }))
  for (const [index, type] of ['single_choice', 'multiple_choice', 'dropdown'].entries()) {
    const ids = roles[index]
    await form.add({ kind: 'question', questionType: type, prompt: type, required: true,
      choices: [{ newId: ids.fixed, value: 'design', label: 'Design' }, { newId: ids.other, value: 'other', label: 'Something else' }, ...(type === 'multiple_choice' ? [{ newId: ids.none, value: 'none', label: 'None of these' }] : [])],
      questionSettings: { otherChoiceId: ids.other, ...(type === 'multiple_choice' ? { noneChoiceId: ids.none, minSelections: 2 } : {}), otherText: index === 2 ? { inputMask: '@@-##' } : { minLength: 2, maxLength: 80, pattern: '^[A-Za-z ,]+$' } },
    })
  }
  await form.add({ kind: 'completion', questionType: null, prompt: 'Thank you' }); await form.publish()
  const draft = await form.draft(), questions = draft.steps.filter(step => step.kind === 'question')
  const other = (index: number, text: string, ids = [roles[index].other]) => ({ choiceIds: ids, other: { choiceId: roles[index].other, text } })
  const values: unknown[] = [other(0, 'Accessibility workshops'), other(1, 'Local research', [roles[1].fixed, roles[1].other]), other(2, 'AB-42')]
  const session = await form.session()
  const submit = (row: unknown[], key: string, current = session) => f.request(`/api/public/flows/${form.slug}/responses`, { ...current, idempotencyKey: key, answers: row.map((value, index) => ({ stepId: questions[index].id, value })) })
  for (const [index, invalid] of [[0, roles[0].other], [0, other(0, ' ')], [0, other(0, '42')], [0, { choiceIds: [roles[0].fixed], other: { choiceId: roles[0].other, text: 'stale' } }], [1, [roles[1].none, roles[1].fixed]], [1, [roles[1].fixed]], [2, other(2, 'AB-4')]] as Array<[number, unknown]>) {
    const row = [...values]; row[index] = invalid
    expect((await submit(row, 'refused-choice')).status).toBe(400)
  }
  expect((await f.call<{ total: number }>(form.root + '/ledger')).total).toBe(0)
  expect(await (await submit(values, 'first-choice')).json()).toMatchObject({ disposition: 'released' })
  const second = await form.session()
  expect(await (await submit([roles[0].fixed, [roles[1].none], roles[2].fixed], 'second-choice', second)).json()).toMatchObject({ disposition: 'released' })
  const reports = await f.call<QuestionReport[]>(form.root + '/questions?revisionId=' + session.revisionId)
  for (const [index, question] of questions.entries()) {
    const report = reports.find(row => row.id === question.id)!
    expect(report.answered).toBe(2)
    expect(report.distribution.find(bucket => bucket.value === roles[index].other)?.count).toBe(1)
    const text = await f.call<{ texts: string[] }>(form.root + '/questions/text', { revisionId: session.revisionId, questionId: question.id, search: '' })
    expect(text.texts).toEqual([(values[index] as { other: { text: string } }).other.text])
  }
  for (const value of [roles[0].other, 'Accessibility workshops']) expect((await f.call<{ total: number }>(`${form.root}/ledger?answerStepId=${questions[0].id}&answerValue=${encodeURIComponent(value)}`)).total).toBe(1)
  const ledger = await f.call<{ responses: LedgerResponse[] }>(form.root + '/ledger')
  expect(ledger.responses.flatMap(row => row.answers).find(answer => answer.displayValue.includes('Accessibility workshops'))?.value).toEqual(values[0])
  await otherEvidenceScenario({ cookie: f.cookie(), flowId: form.flow.id, revisionId: session.revisionId, questionId: questions[0].id, responseId: ledger.responses.find(row => row.answers.some(answer => answer.displayValue.includes('Accessibility workshops')))!.id, text: 'Accessibility workshops', choiceId: roles[0].other })
  const csv = await f.download(form.root, 'csv')
  for (const value of ['Accessibility workshops', 'Local research', 'AB-42', `${questions[0].id}.other_text`, `${questions[0].id}.choices`]) expect(csv).toContain(value)
  const copied = await f.call<{ id: string }>(form.root + '/duplicate', { title: 'Repeated service choices', slug: form.slug + '-copy' })
  const copy = await f.call<BuilderDraft>(`/api/app/flows/${copied.id}/draft`)
  for (const step of copy.steps.filter(step => step.kind === 'question')) {
    const available = copy.choices.filter(choice => choice.stepId === step.id).map(choice => choice.id)
    expect(available).toContain(step.questionSettings?.otherChoiceId)
    expect(roles.flatMap(role => [role.fixed, role.other, role.none])).not.toContain(step.questionSettings?.otherChoiceId)
  }
  const copyRoot = `/api/app/flows/${copied.id}`, copyQuestions = copy.steps.filter(step => step.kind === 'question')
  const copyOther = String(copyQuestions[0].questionSettings!.otherChoiceId)
  await f.call(copyRoot + '/draft/branches', { expectedVersion: copy.flow.draftVersion, rules: [{ sourceStepId: copyQuestions[0].id, predicateKind: 'equals', expectedValue: copyOther, destinationStepId: copyQuestions[2].id, position: 0 }] }, 'PUT')
  await f.call(copyRoot + '/publish', { expectedVersion: (await f.call<BuilderDraft>(copyRoot + '/draft')).flow.draftVersion })
  const branched = await f.call<{ sessionId: string; sessionToken: string; revisionId: string }>(`/api/public/flows/${form.slug}-copy/sessions`, { source: 'direct', deviceClass: 'desktop' })
  await env.DB.prepare('UPDATE respondent_sessions SET created_at=? WHERE id=?').bind(new Date(Date.now() - 6000).toISOString(), branched.sessionId).run()
  const copyDropdown = copy.choices.find(choice => choice.stepId === copyQuestions[2].id && choice.value === 'design')!
  expect(await f.call(`/api/public/flows/${form.slug}-copy/responses`, { ...branched, idempotencyKey: branched.sessionId, answers: [{ stepId: copyQuestions[0].id, value: { choiceIds: [copyOther], other: { choiceId: copyOther, text: 'Accessibility workshops' } } }, { stepId: copyQuestions[2].id, value: copyDropdown.id }] })).toMatchObject({ disposition: 'released' })
  const branchedLedger = await f.call<{ responses: LedgerResponse[] }>(copyRoot + '/ledger')
  expect(branchedLedger.responses[0].answers.map(answer => answer.stepId)).not.toContain(copyQuestions[1].id)
  const imports: ImportInput[] = [
    { definition: JSON.stringify({ title: 'Typeform service history', fields: [{ id: 'services', ref: 'services', type: 'multiple_choice', title: 'Services', properties: { allow_multiple_selection: true, allow_other_choice: true, choices: [{ id: 'design', ref: 'design', label: 'Design' }] } }, { id: 'preferred', ref: 'preferred', type: 'multiple_choice', title: 'Preferred service', properties: { allow_other_choice: true, choices: [{ id: 'research', ref: 'research', label: 'Research' }] } }] }), csv: '', responses: JSON.stringify({ items: [{ submitted_at: '2026-10-01T15:00:00Z', answers: [{ field: { id: 'services', ref: 'services' }, type: 'choices', choices: { refs: ['design'], other: 'Community, locally' } }, { field: { id: 'preferred', ref: 'preferred' }, type: 'choice', choice: { other: 'Accessibility workshops' } }] }] }) },
    { source: 'google-forms', definition: JSON.stringify({ info: { title: 'Google service history' }, items: [{ itemId: 'services-item', title: 'Services', questionItem: { question: { questionId: 'services', choiceQuestion: { type: 'CHECKBOX', options: [{ value: 'Design' }, { value: 'Other', isOther: true }] } } } }] }), csv: '', responses: JSON.stringify({ responses: [{ responseId: 'private-source-id', respondentEmail: 'private-source@example.test', createTime: '2026-09-01T15:00:00Z', lastSubmittedTime: '2026-10-01T15:00:00Z', answers: { services: { questionId: 'services', textAnswers: { answers: [{ value: 'Design' }, { value: 'Community, locally' }] } } } }] }) },
  ]
  for (const input of imports) {
    const review = await f.call<ImportReview>('/api/app/imports/review', input)
    expect(review.rowErrors).toEqual([]); expect(review.responseCount).toBe(1)
    let job = await f.call<{ id: string; state: string }>('/api/app/imports/commit', { ...input, columns: review.columns, plannedAt: review.plannedAt, fingerprint: review.fingerprint, acknowledged: true })
    while (job.state !== 'completed') job = await f.call(`/api/app/imports/${job.id}/resume`, {})
    const imported = await f.call<{ responses: LedgerResponse[] }>(`/api/app/flows/${review.flowId}/ledger`)
    expect(imported.responses[0]).toMatchObject({ completedAt: '2026-10-01T15:00:00.000Z', startedAt: null, source: 'imported' })
    expect(imported.responses[0].answers[0].displayValue).toContain('Community, locally')
    expect(imported.responses[0].answers[0].value).toMatchObject({ other: { text: 'Community, locally' } })
    expect(JSON.stringify(imported)).not.toContain('private-source')
    if (input.source !== 'google-forms') expect(imported.responses[0].answers.some(answer => answer.displayValue.includes('Accessibility workshops'))).toBe(true)
    job = await f.call(`/api/app/imports/${job.id}/undo`, {})
    while (job.state !== 'undone') job = await f.call(`/api/app/imports/${job.id}/resume`, {})
    expect(await env.DB.prepare('SELECT count(*) AS n FROM responses WHERE flow_id=?').bind(review.flowId).first()).toEqual({ n: 0 })
  }
}, 90000)
