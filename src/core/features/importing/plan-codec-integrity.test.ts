import { expect } from 'vitest'
import { contract } from '../../../test/contract'
import { canonicalJson } from '../../../base/import-kit/src/d1/index'
import { buildImportPlan } from '../../../base/import-kit/src/plan/index'
import { formJson, csv } from '../../../../tests/fixtures/form-import/fixture'
import { prepareImport } from './prepare'
import { importPlanCodec } from './plan-codec'

function fixture() {
  const prepared = prepareImport({ definition: formJson, csv, plannedAt: '2026-10-08T00:00:00.000Z' }, 'workspace')
  const plan = buildImportPlan(prepared.source, prepared.mapping, { destination: 'workspace', namespace: prepared.namespace, mappingVersion: prepared.mapping.version, authorization: { principalId: 'owner' } })
  return { plan, payload: JSON.parse(canonicalJson(importPlanCodec.encode(plan))) }
}
contract(['IMPORT-003', 'IMPORT-004'], 'separate decoded custody reads never share mutable source, effect or column containers', () => {
  const { plan, payload } = fixture(), first = importPlanCodec.decode(payload), second = importPlanCodec.decode(payload)
  const original = canonicalJson(plan)
  ;(first.entries[0].source.payload as any).title = 'Changed only in the first reader'
  ;(first.entries[0].effects[0].value as any).tables.flow_steps[0].prompt = 'Changed only in the first reader'
  expect(canonicalJson(second)).toBe(original)
  expect(canonicalJson(importPlanCodec.decode(payload))).toBe(original)
})
contract(['IMPORT-003', 'IMPORT-004'], 'every native vector tuple byte is validated before a decoded plan can be retained', () => {
  const { payload } = fixture()
  const table = payload.entries[0].effects[0].value.tables.flow_steps
  table.columns[0].push('unreviewed retained material')
  expect(() => importPlanCodec.decode(payload)).toThrow('IMPORT_PLAN_CODEC_MISMATCH')
})
contract(['IMPORT-003', 'IMPORT-004'], 'native vector lengths and derived identifiers cannot silently discard or invent rows', () => {
  for (const change of [
    (table: any) => { table.length = -1 },
    (table: any) => { table.columns.find(([key]: [string]) => key === 'id')[1] = { derived: 2 } },
    (table: any) => { table.columns.find(([, column]: [string, any]) => Array.isArray(column.values))[1].values.pop() },
    (table: any) => { table.columns.push(table.columns[0]) },
    (table: any) => { table.ignored = 'unreviewed retained material' },
  ]) {
    const { payload } = fixture()
    change(payload.entries[0].effects[0].value.tables.flow_steps)
    expect(() => importPlanCodec.decode(payload)).toThrow('IMPORT_PLAN_CODEC_MISMATCH')
  }
})
