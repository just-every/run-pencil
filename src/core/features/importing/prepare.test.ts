import { expect } from 'vitest'
import { contract } from '../../../test/contract'
import { formJson, csv, definition, simpleJson } from '../../../../tests/fixtures/form-import/fixture'
import { prepareImport } from './prepare'
import { parseCsv } from './csv'
const input = { definition: formJson, csv, plannedAt: '2026-10-08T00:00:00.000Z' }
contract(['IMPORT-001', 'IMPORT-002', 'IMPORT-003'], 'accounts for every field and logic action, typed answers and privacy omissions before writes', () => {
  const result = prepareImport(input, 'workspace')
  expect(result.rowErrors).toEqual([])
  expect(result.responseCount).toBe(27)
  definition.fields.forEach((_, i) => expect(result.form.report.some(r => r.location === `/fields/${i}`)).toBe(true))
  definition.logic.forEach((logic, i) => logic.actions.forEach((_, j) => expect(result.form.report.some(r => r.location === `/logic/${i}/actions/${j}`)).toBe(true)))
  expect(result.form.report.filter(r => r.location.startsWith('/logic/')).map(r => r.state)).toEqual(['imported', 'imported', 'unsupported'])
  expect(result.form.steps.filter(s => s.kind === 'welcome')).toHaveLength(1)
  expect(result.form.steps.filter(s => s.kind === 'completion')).toHaveLength(2)
  const serialized = JSON.stringify(result.source)
  expect(serialized).not.toContain('forbidden-network-')
  expect(serialized).not.toContain('192.0.2.')
  expect(serialized).not.toContain('never-import-hidden-value')
  expect(serialized).not.toContain('991827')
  expect(result.source.artifacts.every(a => a.original?.status === 'unavailable')).toBe(true)
  // An omitted calculation (the score add on 'short') never routes, so the question keeps its default path.
  const short = result.form.steps.findIndex(s => s.sourceId === 'short')
  expect(result.form.steps[short].next).toBe(result.form.steps[short + 1].id)
  const first = result.source.records.find(r => r.kind === 'response')!.payload as any
  expect(first.answers[result.form.steps.find(s => s.sourceId === 'yes')!.id]).toBe(false)
  expect(first.answers[result.form.steps.find(s => s.sourceId === 'nps')!.id]).toBe(10)
  expect(first.answers[result.form.steps.find(s => s.sourceId === 'number')!.id]).toBe(2.5)
  expect(first.answers[result.form.steps.find(s => s.sourceId === 'legal')!.id]).toEqual({ accepted: true, statement: 'I accept the stated terms.' })
  expect(first.answers[result.form.steps.find(s => s.sourceId === 'long')!.id]).toBeUndefined()
})
contract(['IMPORT-002', 'IMPORT-003'], 'collects every row error, rejects malformed quoting and never guesses ambiguous headings', () => {
  const bad = prepareImport({ definition: simpleJson, csv: 'Answer,Submit Date\nhello,bad\nworld,nope\n', plannedAt: input.plannedAt }, 'workspace')
  expect(bad.rowErrors.filter(e => e.column === 'Submit Date').map(e => e.row)).toEqual([2, 3])
  expect(bad.responseCount).toBe(0)
  expect(parseCsv('A,B\n"unterminated,x').errors).not.toHaveLength(0)
  expect(parseCsv('A,B\nx,y,z').errors).toEqual([{ row: 2, column: 'row', message: 'Expected 2 columns, received 3.' }])
  const duplicate = JSON.stringify({ title: 'Duplicate', fields: [{ ref: 'a', title: 'Same', type: 'short_text' }, { ref: 'b', title: 'Same', type: 'short_text' }] })
  expect(prepareImport({ definition: duplicate, csv: 'Same,Submit Date\nx,2026-09-12 10:00:00' }, 'workspace').columns[0].target).toBe('skip')
})
contract('IMPORT-002', 'mapping can skip answers but cannot map network data, and limits refuse rather than truncate', () => {
  const result = prepareImport(input, 'workspace'), id = result.form.steps.find(s => s.sourceId === 'short')!.id
  const columns = result.columns.map(c => c.column === 0 ? { ...c, target: 'skip' } : c.column === 18 ? { ...c, target: id } : c)
  const changed = prepareImport({ ...input, columns }, 'workspace')
  expect(changed.columns[18].target).toBe('skip')
  expect((changed.source.records[1].payload as any).answers[id]).toBeUndefined()
  expect(() => prepareImport({ definition: JSON.stringify({ title: 'Too many', fields: Array.from({ length: 51 }, (_, i) => ({ ref: String(i), title: String(i), type: 'short_text' })) }), csv: '' }, 'workspace')).toThrow('limits')
})
contract('IMPORT-001', 'first statement becomes welcome and later statements remain explicit unsupported', () => {
  const definition = JSON.stringify({ title: 'Statements', fields: [{ ref: 'a', title: 'Hello', type: 'statement' }, { ref: 'b', title: 'Question', type: 'short_text' }, { ref: 'c', title: 'Middle', type: 'statement' }] })
  const result = prepareImport({ definition, csv: '' }, 'workspace')
  expect(result.form.steps[0].kind).toBe('welcome')
  expect(result.form.report.find(r => r.location === '/fields/2')?.state).toBe('unsupported')
})
contract(['IMPORT-001', 'IMPORT-002'], 'refuses native choice and answer limits and reports nested unsupported fields', () => {
  const choices = Array.from({ length: 101 }, (_, i) => ({ ref: `option-${i}`, label: `Option ${i}` }))
  expect(() => prepareImport({ definition: JSON.stringify({ title: 'Choices', fields: [{ ref: 'question', title: 'Pick', type: 'dropdown', properties: { choices } }] }), csv: '' }, 'workspace')).toThrow('limits')
  const invalid = prepareImport({ definition: simpleJson, csv: `Answer,Submit Date\n${'x'.repeat(201)},2026-09-12 10:00:00\nshort,2026-02-30 10:00:00` }, 'workspace')
  expect(invalid.rowErrors.some(e => e.row === 2 && e.message.includes('200'))).toBe(true)
  expect(invalid.rowErrors.some(e => e.row === 3 && e.column === 'Submit Date')).toBe(true)
  expect(invalid.responseCount).toBe(0)
  const grouped = JSON.stringify({ title: 'Nested group', fields: [{ ref: 'normal', title: 'A question', type: 'short_text' }, { ref: 'group', title: 'Group', type: 'group', properties: { fields: [{ ref: 'nested', title: 'Nested question', type: 'short_text' }] } }] })
  const result = prepareImport({ definition: grouped, csv: '' }, 'workspace')
  expect(result.form.report.find(r => r.location === '/fields/1/properties/fields/0')).toMatchObject({ state: 'unsupported', label: 'Nested question' })
})

contract('IMPORT-004', 'native target identities are stable within a workspace and disjoint between workspaces', () => {
  const ids = (workspace: string) => [...prepareImport(input, workspace).effects.values()].map(effect => effect.targetId)
  const first = ids('first-workspace'), second = new Set(ids('second-workspace'))
  expect(ids('first-workspace')).toEqual(first)
  expect(first).toHaveLength(28)
  expect(first.some(id => second.has(id))).toBe(false)
})
