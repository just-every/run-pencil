import { expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { contract } from '../../../test/contract'
import { prepareImport } from './prepare'
import type { ImportInput } from './model'
import { ambiguousGoogleCsv, csvOnlyObservations, googleInput, googleDefinition, quoteCsv, simpleGoogleJson, skippedIdentity } from '../../../../tests/fixtures/form-import/google-fixture'
const prepare = (input: ImportInput) => prepareImport(input, 'synthetic-workspace')
const responses = (result: ReturnType<typeof prepare>) => [...result.source.records].filter(row => row.kind === 'response').map(row => row.payload as unknown as { submittedAt: string; answers: Record<string, unknown> })
const timestampInput = (timestamp: string, timeZone: string, dateOrder: 'DMY' | 'MDY' = 'DMY'): ImportInput => ({ source: 'google-forms', definition: simpleGoogleJson, csv: quoteCsv([['Timestamp', 'Answer'], [timestamp, 'hello']]), google: { timeZone, dateOrder } })
contract(['IMPORT-002', 'IMPORT-003'], 'Google timestamps require explicit zone and resolve date order from consistent evidence only', () => {
  const result = prepare(googleInput)
  expect(result.rowErrors).toEqual([])
  expect(responses(result).map(row => row.submittedAt)).toEqual(['2026-04-22T23:10:11.000Z', '2026-04-24T01:12:13.000Z'])
  expect(prepare({ ...googleInput, google: {} }).rowErrors.length).toBeGreaterThan(0)
  const ambiguous = { ...googleInput, definition: simpleGoogleJson, csv: ambiguousGoogleCsv, google: { timeZone: 'Asia/Kathmandu' } }
  expect(prepare(ambiguous).rowErrors.length).toBeGreaterThan(0)
  expect(responses(prepare({ ...ambiguous, google: { ...ambiguous.google, dateOrder: 'DMY' } }))[0].submittedAt).toBe('2026-04-02T18:20:06.000Z')
  expect(responses(prepare({ ...ambiguous, google: { ...ambiguous.google, dateOrder: 'MDY' } }))[0].submittedAt).toBe('2026-03-03T18:20:06.000Z')
  const conflict = quoteCsv([['Timestamp', 'Answer'], ['23/04/2026 12:00:00', 'a'], ['04/23/2026 12:00:00', 'b']])
  expect(prepare({ ...googleInput, csv: conflict }).rowErrors.length).toBeGreaterThan(0)
})
contract('IMPORT-002', 'Google rejects impossible dates and both DST gap and overlap instead of shifting historical time', () => {
  for (const value of ['30/02/2026 12:00:00', '29/02/2025 12:00:00', '23/04/2026 24:00:00', '23/04/2026 12:60:00', '23/04/2026 12:00:60', '']) expect(prepare(timestampInput(value, 'UTC')).rowErrors.length, value).toBeGreaterThan(0)
  expect(prepare(timestampInput('23/04/2026 12:00:00', 'Invalid/Zone')).rowErrors.length).toBeGreaterThan(0)
  for (const value of ['03/08/2026 02:30:00', '11/01/2026 01:30:00']) expect(prepare(timestampInput(value, 'America/New_York', 'MDY')).rowErrors.length, value).toBeGreaterThan(0)
  expect(responses(prepare(timestampInput('03/08/2026 03:30:00', 'America/New_York', 'MDY')))[0].submittedAt).toBe('2026-03-08T07:30:00.000Z')
})
contract(['IMPORT-002', 'IMPORT-003'], 'Google real CSV quoting and positional duplicate mapping preserve values while omissions never enter safe records', () => {
  const first = prepare(googleInput), bySource = (id: string) => first.form.steps.find(step => step.sourceId === id)!.id
  expect(first.columns.filter(column => [3, 4, 6, 7, 8, 9, 10, 11].includes(column.column)).every(column => column.target === 'skip')).toBe(true)
  const selected = prepare({ ...googleInput, columns: first.columns.map(column => column.column === 3 ? { ...column, target: bySource('first') } : column.column === 4 ? { ...column, target: bySource('second') } : column) })
  const answer = responses(selected)[0].answers
  expect(answer[bySource('first')]).toBe('left'); expect(answer[bySource('second')]).toBe('right')
  expect(answer[bySource('notes')]).toBe('First line, café\nSecond "quoted" line')
  expect(responses(selected)[1].answers[bySource('notes')]).toBeUndefined()
  expect(answer[bySource('colors')]).toEqual(first.form.steps.find(step => step.sourceId === 'colors')!.choices.map(choice => choice.id))
  expect(JSON.stringify([...selected.source.records])).not.toMatch(/GOOGLE-SKIPPED-IDENTITY|PRIVATE-GRADE-73f2a|SYNTHETIC-PRIVATE-73f2a/)
  expect(() => prepare({ ...googleInput, columns: first.columns.map(column => column.column === 4 ? { ...column, target: bySource('first') } : column.column === 3 ? { ...column, target: bySource('first') } : column) })).toThrow()
  const forced = prepare({ ...googleInput, columns: first.columns.map(column => [8, 9, 10].includes(column.column) ? { ...column, target: bySource('answer') } : column) })
  expect(JSON.stringify([...forced.source.records])).not.toContain('PRIVATE-GRADE-73f2a')
  expect(JSON.stringify([...forced.source.records])).not.toContain('SYNTHETIC-PRIVATE-73f2a')
})
contract('IMPORT-002', 'Google checkbox answers require an unambiguous complete known-label interpretation and reject unmatched Other', () => {
  const checkbox = (labels: string[], cell: string) => prepare({ ...googleInput, definition: JSON.stringify({ info: { title: 'Checkbox' }, items: [{ itemId: 'i', title: 'Pick', questionItem: { question: { questionId: 'q', choiceQuestion: { type: 'CHECKBOX', options: labels.map(value => ({ value })) } } } }] }), csv: quoteCsv([['Timestamp', 'Pick'], ['23/04/2026 12:00:00', cell]]) })
  expect(checkbox(['Red', 'Blue'], 'Red, Blue').rowErrors).toEqual([])
  for (const [labels, cell] of [[['Tea, green', 'Café', 'Tea', 'green'], 'Tea, green'], [['Red', 'Blue'], 'Other: purple'], [['Red', 'Blue'], 'Red, Red']] as [string[], string][]) expect(checkbox(labels, cell).rowErrors.length).toBeGreaterThan(0)
})
contract(['IMPORT-001', 'IMPORT-002'], 'CSV-only observations never apply type or choice inference without explicit operator selections', () => {
  const input: ImportInput = { source: 'google-forms', definition: '', csv: csvOnlyObservations, google: { title: 'Reconstructed', timeZone: 'Australia/Brisbane' } }
  const review = prepare(input)
  expect(review.form.steps.filter(step => step.kind === 'question').every(step => step.questionType === 'short_text' && step.choices.length === 0)).toBe(true)
  const codeDefault = review.form.steps.find(step => step.sourceId === 'csv:1')!
  expect(responses(review)[0].answers[codeDefault.id]).toBe('0012')
  const explicit = prepare({ ...input, google: { ...input.google, questions: [ { sourceId: 'csv:1', type: 'short_text' }, { sourceId: 'csv:2', type: 'short_text' }, { sourceId: 'csv:4', type: 'dropdown', choices: ['Tea, green', 'Café'] } ] } })
  expect(explicit.rowErrors).toEqual([])
  const code = explicit.form.steps.find(step => step.sourceId === 'csv:1')!
  expect(responses(explicit)[0].answers[code.id]).toBe('0012')
  expect(explicit.form.steps.find(step => step.sourceId === 'csv:4')!.choices.map(choice => choice.label)).toEqual(['Tea, green', 'Café'])
  for (const definition of ['', JSON.stringify({ info: { title: 'Grid reconstruction' }, items: [googleDefinition.items.find(item => item.itemId === 'grid-item')] })]) {
    const csv = quoteCsv([['Timestamp', 'Service [Speed]'], ['23/04/2026 09:10:11', 'Red'], ['24/04/2026 09:10:11', 'Blue'], ['25/04/2026 09:10:11', 'Red, Blue']])
    const selected: ImportInput = { ...input, definition, csv, google: { ...input.google, questions: [{ sourceId: 'csv:1', type: 'multiple_choice', choices: ['Red', 'Blue'] }] } }
    const refused = prepare(selected)
    expect([...refused.rowErrors]).toEqual([expect.objectContaining({ row: 4, column: 'Service [Speed]' })])
    expect(responses(refused)).toHaveLength(2)
    const whole = prepare({ ...selected, google: { ...selected.google, questions: [{ sourceId: 'csv:1', type: 'multiple_choice', choices: ['Red', 'Blue', 'Red, Blue'] }] } })
    const question = whole.form.steps.find(step => step.sourceId === 'csv:1')!
    expect(whole.rowErrors).toEqual([])
    expect(responses(whole).map(row => row.answers[question.id])).toEqual(question.choices.map(choice => [choice.id]))
    const text = prepare({ ...selected, google: { ...selected.google, questions: [{ sourceId: 'csv:1', type: 'short_text' }] } })
    expect(responses(text)[2].answers[question.id]).toBe('Red, Blue')
  }
  for (const definition of ['', JSON.stringify({ info: { title: 'Colors' }, items: [{ itemId: 'colors-item', title: 'Colors', questionItem: { question: { questionId: 'colors', choiceQuestion: { type: 'CHECKBOX', options: [{ value: 'Red' }, { value: '1' }] } } } }] })]) {
    const selected: ImportInput = { ...input, definition, csv: quoteCsv([['Timestamp', 'Colors'], ['23/04/2026 09:10:11', 'Red'], ['24/04/2026 09:10:11', '1']]), google: { ...input.google, questions: definition ? [] : [{ sourceId: 'csv:1', type: 'multiple_choice', choices: ['Red', '1'] }] } }
    const whole = prepare(selected), question = whole.form.steps.find(step => step.prompt === 'Colors')!
    expect(whole.rowErrors).toEqual([])
    expect(responses(whole).map(row => row.answers[question.id])).toEqual(question.choices.map(choice => [choice.id]))
    const choice = question.choices.find(option => option.label === 'Red')!.id
    for (const target of [question.id, 'skip']) expect(() => prepare({ ...selected, columns: whole.columns.map(column => column.column === 1 ? { ...column, target, choice } : column) })).toThrow()
  }
})
contract(['IMPORT-001', 'IMPORT-002'], 'Google malformed question unions, repeated source IDs and oversized answers are refused visibly', () => {
  const item = googleDefinition.items[0]
  for (const definition of [ { info: { title: 'Duplicate IDs' }, items: [item, item] }, { info: { title: 'Malformed union' }, items: [{ ...item, pageBreakItem: {} }] }, { info: { title: 'Invented Typeform shape' }, fields: [{ title: 'Answer', type: 'short_text' }] } ]) expect(() => prepare({ ...googleInput, definition: JSON.stringify(definition) })).toThrow()
  const invalid = prepare({ ...timestampInput('23/04/2026 12:00:00', 'UTC'), csv: quoteCsv([['Timestamp', 'Answer'], ['23/04/2026 12:00:00', 'x'.repeat(201)]]) })
  expect(invalid.responseCount).toBe(0); expect(invalid.rowErrors.length).toBeGreaterThan(0)
  expect(JSON.stringify(prepare({ ...googleInput, csv: 'Timestamp,Answer,Email Address\n"unterminated,' + skippedIdentity }).rowErrors)).not.toContain(skippedIdentity)
})
contract('IMPORT-004', 'source namespaces separate equal artifact bytes while timestamp interpretations change reviewed meaning', () => {
  const both = JSON.stringify({ title: 'Dual documented source', fields: [{ ref: 'answer', type: 'short_text', title: 'Answer' }], info: { title: 'Dual documented source' }, items: [{ itemId: 'item', title: 'Answer', questionItem: { question: { questionId: 'answer', textQuestion: {} } } }] })
  const typeform = prepare({ definition: both, csv: '' }), google = prepare({ source: 'google-forms', definition: both, csv: '' })
  expect(typeform.namespace).not.toBe(google.namespace); expect(typeform.flowId).not.toBe(google.flowId)
  expect(typeform.source.artifacts[0].sha256).toBe(google.source.artifacts[0].sha256)
  const a = prepare(timestampInput('03/04/2026 12:00:00', 'UTC', 'DMY')), b = prepare(timestampInput('03/04/2026 12:00:00', 'UTC', 'MDY'))
  expect(responses(a)[0].submittedAt).not.toBe(responses(b)[0].submittedAt)
})
contract(['IMPORT-001', 'IMPORT-002'], 'Google documented date and rating kinds retain values; time is omitted and two-option choices require explicit Yes/No confirmation', () => {
  const definition = { info: { title: 'Typed Google questions' }, items: [
    { itemId: 'date-item', title: 'Visit date', questionItem: { question: { questionId: 'date', dateQuestion: { includeYear: true, includeTime: false } } } },
    { itemId: 'scale-item', title: 'Scale', questionItem: { question: { questionId: 'scale', scaleQuestion: { low: 0, high: 10, lowLabel: 'Low', highLabel: 'High' } } } },
    { itemId: 'rating-item', title: 'Stars', questionItem: { question: { questionId: 'stars', ratingQuestion: { ratingScaleLevel: 5, iconType: 'STAR' } } } },
    { itemId: 'return-item', title: 'Return?', questionItem: { question: { questionId: 'return', choiceQuestion: { type: 'RADIO', options: [{ value: 'Yes' }, { value: 'No' }] } } } },
    { itemId: 'time-item', title: 'Duration', questionItem: { question: { questionId: 'duration', timeQuestion: { duration: true } } } },
  ] }
  const input: ImportInput = { source: 'google-forms', definition: JSON.stringify(definition), csv: quoteCsv([['Timestamp', 'Visit date', 'Scale', 'Stars', 'Return?', 'Duration'], ['23/04/2026 09:10:11', '2026-04-23', '0', '5', 'No', '01:02:03']]), google: { timeZone: 'Australia/Brisbane' } }
  const original = prepare(input)
  expect(original.form.steps.find(step => step.sourceId === 'return')?.questionType).toBe('single_choice')
  const mapped = prepare({ ...input, google: { ...input.google, questions: [{ sourceId: 'return', type: 'yes_no', confirmYesNo: true, yesLabel: 'Yes', noLabel: 'No' }] } })
  expect(mapped.rowErrors).toEqual([])
  const answers = responses(mapped)[0].answers, id = (sourceId: string) => mapped.form.steps.find(step => step.sourceId === sourceId)!.id
  expect(answers[id('date')]).toBe('2026-04-23'); expect(answers[id('scale')]).toBe(0); expect(answers[id('stars')]).toBe(5); expect(answers[id('return')]).toBe(false)
  expect(mapped.form.report.some(item => item.sourceType === 'timeQuestion' && item.state === 'unsupported')).toBe(true)
  expect(JSON.stringify([...mapped.source.records])).not.toContain('01:02:03')
  expect(() => prepare({ ...input, google: { ...input.google, questions: [{ sourceId: 'return', type: 'yes_no' }] } })).toThrow()

  const routingDefinition = JSON.parse(readFileSync(new URL('../../../../tests/fixtures/form-import/google-routing-losses.forms.json', import.meta.url), 'utf8'))
  const routing = prepare({ source: 'google-forms', definition: JSON.stringify(routingDefinition), csv: '', google: { timeZone: 'UTC', dateOrder: 'DMY' } })
  const routePath = `/items/${routingDefinition.items.findIndex((item: { itemId: string }) => item.itemId === 'route-item')}`
  const uploadRoutePath = `/items/${routingDefinition.items.findIndex((item: { itemId: string }) => item.itemId === 'upload-route-item')}`
  const loopPath = `/items/${routingDefinition.items.findIndex((item: { itemId: string }) => item.itemId === 'loop-item')}`
  const uploadPath = `/items/${routingDefinition.items.findIndex((item: { itemId: string }) => item.itemId === 'upload-item')}`
  const route = routing.form.steps.find(step => step.sourceId === 'route')!
  const uploadRoute = routing.form.steps.find(step => step.sourceId === 'upload-route')!
  const loop = routing.form.steps.find(step => step.sourceId === 'loop')!
  expect(routing.form.report.find(item => item.location === `${routePath}/questionItem/question/choiceQuestion/options/3`)).toMatchObject({ sourceType: 'section navigation', state: 'unsupported' })
  expect(routing.form.report.find(item => item.location === `${routePath}/questionItem/question/choiceQuestion/options/0`)).toMatchObject({ sourceType: 'section navigation', state: 'unsupported' })
  expect(routing.form.report.find(item => item.location === `${routePath}/questionItem/question/choiceQuestion/options/1`)).toMatchObject({ sourceType: 'section navigation', state: 'unsupported' })
  expect(routing.form.report.find(item => item.location === `${uploadRoutePath}/questionItem/question/choiceQuestion/options/0`)).toMatchObject({ sourceType: 'section navigation', state: 'unsupported' })
  expect(routing.form.report.find(item => item.location === `${loopPath}/questionItem/question/choiceQuestion/options/0`)).toMatchObject({ sourceType: 'section navigation', state: 'unsupported' })
  expect(routing.form.report.find(item => item.location === uploadPath)).toMatchObject({ sourceType: 'fileUploadQuestion', state: 'unsupported' })
  expect([route.next, uploadRoute.next, loop.next]).toEqual([null, null, null])
  expect(routing.form.rules.some(rule => [route.id, uploadRoute.id, loop.id].includes(rule.source))).toBe(false)
})
