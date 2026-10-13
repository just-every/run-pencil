import { expect } from 'vitest'
import { contract } from '../../../test/contract'
import { responseStore } from './response-store'

contract(['IMPORT-003', 'IMPORT-004'], 'response pages retain exact JSON text values and independent typed records across compression boundaries', () => {
  const store = responseStore<unknown>(), expected: unknown[] = []
  for (let row = 0; row < 203; row++) {
    const value = JSON.parse('{"__proto__":{"constructor":"own"},"10":1,"2":"1"}')
    value.row = row
    value.values = [null, false, true, 0, '0', '', '"\\\n\t\u0000', '\ud800', '😀e\u0301', '漢'.repeat(255 + row % 3), '{ "spelling" : "\\u6f22" }']
    expected.push(value); store.add(value)
  }
  expect(store.length).toBe(203)
  for (const row of [202, 100, 0, 99, 101, 199, 200, 1]) expect(store.get(row)).toEqual(expected[row])
  const changed = store.get(100) as any
  changed.__proto__.constructor = 'Changed only in this read'; changed.values[1] = true
  expect(store.get(100)).toEqual(expected[100])
  for (let row = 0; row < expected.length; row++) expect(store.get(row)).toEqual(expected[row])
})
