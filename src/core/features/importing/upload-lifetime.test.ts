import { expect } from 'vitest'
import { contract } from '../../../test/contract'
import { canonicalJson } from '../../../base/import-kit/src/d1/index'
import { buildImportPlan } from '../../../base/import-kit/src/plan/index'
import { formJson, csv } from '../../../../tests/fixtures/form-import/fixture'
import { prepareImport } from './prepare'

const context = (prepared: ReturnType<typeof prepareImport>) => ({ destination: 'workspace', namespace: prepared.namespace, mappingVersion: prepared.mapping.version, authorization: { principalId: 'owner' } })

contract(['IMPORT-002', 'IMPORT-003', 'IMPORT-004'], 'normalization preserves reusable caller inputs and no longer needs consumed HTTP file strings', () => {
  const input = { definition: formJson, csv, plannedAt: '2026-10-08T00:00:00.000Z' }, before = JSON.stringify(input)
  const first = prepareImport(input, 'workspace'), repeated = prepareImport(input, 'workspace')
  expect(JSON.stringify(input)).toBe(before)
  const expected = buildImportPlan(first.source, first.mapping, context(first))
  expect(canonicalJson(buildImportPlan(repeated.source, repeated.mapping, context(repeated)))).toBe(canonicalJson(expected))
  const ownedHttpInput = { ...input }, consumed = prepareImport(ownedHttpInput, 'workspace')
  ownedHttpInput.definition = ''; ownedHttpInput.csv = ''
  expect(canonicalJson(buildImportPlan(consumed.source, consumed.mapping, context(consumed)))).toBe(canonicalJson(expected))
  expect(consumed.form.report).toEqual(first.form.report)
  expect(consumed.columns).toEqual(first.columns)
  expect(consumed.responseCount).toBe(first.responseCount)
  expect(consumed.source.artifacts.map(({ sha256, size }) => ({ sha256, size }))).toEqual(first.source.artifacts.map(({ sha256, size }) => ({ sha256, size })))
  expect(JSON.stringify(input)).toBe(before)
})
