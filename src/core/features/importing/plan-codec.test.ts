import { expect } from 'vitest'
import { contract } from '../../../test/contract'
import { canonicalJson } from '../../../base/import-kit/src/d1/index'
import { buildImportPlan } from '../../../base/import-kit/src/plan/index'
import { formJson, csv } from '../../../../tests/fixtures/form-import/fixture'
import { prepareImport } from './prepare'
import { importPlanCodec } from './plan-codec'

contract(['IMPORT-003', 'IMPORT-004'], 'retained native plan codec reconstructs exact reviewed bytes without parsing or mapping input again', () => {
  const prepared = prepareImport({ definition: formJson, csv, plannedAt: '2026-10-08T00:00:00.000Z' }, 'workspace')
  const plan = buildImportPlan(prepared.source, prepared.mapping, { destination: 'workspace', namespace: prepared.namespace, mappingVersion: prepared.mapping.version, authorization: { principalId: 'owner' } })
  const original = canonicalJson(plan), payload = JSON.parse(canonicalJson(importPlanCodec.encode(plan)))
  prepared.mapping.map = () => { throw new Error('Original mapping is no longer available') }
  const decoded = importPlanCodec.decode(payload)
  expect(canonicalJson(decoded)).toBe(original)
  expect(decoded.fingerprint).toBe(plan.fingerprint)
  expect(canonicalJson(plan)).toBe(original)
  const tables = (payload.entries[0].effects[0].value as any).tables
  const idColumn = (table: any) => table.columns.find(([key]: [string]) => key === 'id')[1]
  expect(idColumn(tables.flow_steps)).toEqual({ derived: 1 })
  expect(idColumn(tables.choice_options)).toEqual({ derived: 1 })
  expect(idColumn(payload.entries[1].effects[0].value.tables.response_answers)).toEqual({ derived: 1 })
  const changed = JSON.parse(original)
  changed.entries[1].effects[0].value.tables.response_answers[0].id = 'unreviewed-id'
  expect(() => importPlanCodec.encode(changed)).toThrow('IMPORT_PLAN_CODEC_MISMATCH')
  idColumn(tables.flow_steps).extra = 'unreviewed'
  expect(() => importPlanCodec.decode(payload)).toThrow('IMPORT_PLAN_CODEC_MISMATCH')
})
