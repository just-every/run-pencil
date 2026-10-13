import { expect } from 'vitest'
import { contract } from '../../../test/contract'
import { prepareImport } from './prepare'

const timestamp = '2026-09-12 10:03:00'
const safe = { ref: 'answer', type: 'short_text', title: 'Answer' }
function assertDiscarded(definition: object, header: string) {
  const input = { definition: JSON.stringify(definition), csv: `${header},Answer,Submit Date\nprivate-customer-123,ordinary answer,${timestamp}` }
  const review = prepareImport(input, 'workspace')
  const target = review.form.steps.find(step => step.sourceId === 'answer')!.id
  const columns = review.columns.map(column => ({ ...column, target: column.column === 0 ? target : column.column === 1 ? 'skip' : column.target }))
  const remapped = prepareImport({ ...input, columns }, 'workspace')
  expect(remapped.columns[0].target).toBe('skip')
  expect(remapped.forbiddenColumns).toContain(0)
  expect(remapped.rowErrors).toEqual([])
  expect(remapped.responseCount).toBe(1)
  expect(JSON.stringify(remapped.source)).not.toContain('private-customer-123')
  expect(JSON.stringify([...remapped.effects.values()])).not.toContain('private-customer-123')
  expect(remapped.form.report.find(item => item.location === '/csv/columns/0')?.reason).toMatch(/Hidden|Network/)
  return remapped
}

contract(['IMPORT-002', 'IMPORT-003'], 'hidden source names cannot be remapped to ordinary questions or timestamps', () => {
  const result = assertDiscarded({ title: 'Hidden test', hidden: ['customer_id'], fields: [safe] }, 'customer_id')
  const source = { definition: JSON.stringify({ title: 'Hidden time', hidden: ['submitted_at'], fields: [safe] }), csv: `submitted_at,Submit Date\n${timestamp},${timestamp}` }
  const mapped = prepareImport({ ...source, columns: [{ column: 0, target: 'startedAt' }, { column: 1, target: 'submittedAt' }] }, 'workspace')
  expect(mapped.columns[0].target).toBe('skip')
  expect((mapped.source.records[1].payload as { startedAt: string | null }).startedAt).toBeNull()
  expect(JSON.stringify(result.source)).not.toContain('customer_id')
})

contract('IMPORT-003', 'explicit hidden and network field identities forbid neutral titles and every source alias', () => {
  for (const identity of ['ip_address', 'network_id', 'ipv6', 'ipAddress']) {
    for (const key of ['ref', 'id']) {
      const field = { ref: 'neutral-ref', id: 'neutral-id', type: 'short_text', title: 'Technical identifier', [key]: identity }
      for (const header of [field.title, field.ref, field.id]) {
        const result = assertDiscarded({ title: 'Metadata test', fields: [safe, field] }, header)
        expect(result.form.steps.filter(step => step.kind === 'question')).toHaveLength(1)
        expect(result.form.report.find(item => item.location === '/fields/1')?.state).toBe('unsupported')
      }
    }
  }
  assertDiscarded({ title: 'Hidden alias', hidden: ['private-ref'], fields: [safe, { ref: 'private-ref', id: 'private-id', type: 'short_text', title: 'Technical identifier' }] }, 'Technical identifier')
  assertDiscarded({ title: 'Hidden case', hidden: ['Customer_ID'], fields: [safe] }, ' customer_id ')
})
