import { expect } from 'vitest'
import { contract } from '../../../test/contract'
import { canonicalJson } from '../../../base/import-kit/src/d1/index'
import { importPlanCodec } from './plan-codec'

function plan() {
  const values = [null, true, false, 0, -0, '0', '漢😀\ud800', { nested: [false, 'same'] }, { nested: [false, 'same'] }]
  return { extra: { kept: [1, '1'] }, entries: [{ extra: { kept: true }, effects: [{ extra: ['kept'], value: { extra: { kept: null }, tables: { records: values.map((value, index) => ({ id: String(index), value, repeated: '{ "exact" : "\\u6f22" }' })) } } }] }] } as any
}

contract(['IMPORT-003', 'IMPORT-004'], 'selective native decoding preserves every field, primitive type and independent mutable read', () => {
  const original = plan(), payload = importPlanCodec.encode(original), expected = canonicalJson(original)
  const first: any = importPlanCodec.decode(payload), second = importPlanCodec.decode(payload)
  expect(canonicalJson(first)).toBe(expected)
  first.extra.kept[0] = 9
  first.entries[0].effects[0].value.tables.records[7].value.nested[0] = true
  expect(first.entries[0].effects[0].value.tables.records[8].value.nested[0]).toBe(false)
  expect(canonicalJson(second)).toBe(expected)
  expect(canonicalJson(importPlanCodec.decode(payload))).toBe(expected)
  expect(canonicalJson(original)).toBe(expected)
})

contract(['IMPORT-003', 'IMPORT-004'], 'selective decoding rejects nonplain containers, sparse entries and invalid unused fields', () => {
  for (const change of [
    (value: any) => Object.setPrototypeOf(value, { inherited: true }),
    (value: any) => Object.setPrototypeOf(value.entries[0], { inherited: true }),
    (value: any) => Object.setPrototypeOf(value.entries[0].effects[0], { inherited: true }),
    (value: any) => Object.setPrototypeOf(value.entries[0].effects[0].value, { inherited: true }),
    (value: any) => Object.setPrototypeOf(value.entries[0].effects[0].value.tables, { inherited: true }),
    (value: any) => { value.entries = Array(1) },
    (value: any) => { Object.defineProperty(value, 'entries', { enumerable: false }) },
    (value: any) => { value.extra.unused = undefined },
    (value: any) => { value.entries[0].effects[0].value.extra.unused = Infinity },
  ]) {
    const payload = importPlanCodec.encode(plan())
    change(payload)
    expect(() => importPlanCodec.decode(payload)).toThrow()
  }
})

contract(['IMPORT-003', 'IMPORT-004'], 'selective decoding reads original metadata getters once in canonical order', () => {
  const payload: any = importPlanCodec.encode(plan()), reads: string[] = []
  Object.defineProperties(payload, {
    z: { enumerable: true, get() { reads.push('z'); return false } },
    a: { enumerable: true, get() { reads.push('a'); return '漢' } },
  })
  const decoded: any = importPlanCodec.decode(payload)
  expect(reads).toEqual(['a', 'z'])
  expect(decoded.a).toBe('漢')
  expect(decoded.z).toBe(false)
})


contract(['IMPORT-003', 'IMPORT-004'], 'native column comparison preserves exact key spelling and rejects changed schemas', () => {
  const original = plan(), first = { '10': 'ten', '2': 2, 'a,b': false, 'a"b': true, constructor: null }
  Object.defineProperty(first, '__proto__', { value: 'own', enumerable: true })
  const second = Object.fromEntries(Object.entries(first).reverse())
  original.entries[0].effects[0].value.tables = { records: [first, second] }
  expect(canonicalJson(importPlanCodec.decode(importPlanCodec.encode(original)))).toBe(canonicalJson(original))
  for (const replacement of [
    { ...second, extra: null },
    Object.fromEntries(Object.entries(second).filter(([key]) => key !== 'a,b')),
    Object.fromEntries(Object.entries(second).map(([key, value]) => [key === 'a,b' ? 'a,b,' : key, value])),
  ]) {
    original.entries[0].effects[0].value.tables.records[1] = replacement
    expect(() => importPlanCodec.encode(original)).toThrow('IMPORT_PLAN_CODEC_MISMATCH')
  }
})
