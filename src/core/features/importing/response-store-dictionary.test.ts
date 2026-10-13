import { expect } from 'vitest'
import { contract } from '../../../test/contract'
import { responseStore } from './response-store'

for (const longValues of [false, true]) contract(['IMPORT-003', 'IMPORT-004'], `shared and page dictionaries preserve complete typed records across ${longValues ? 'byte' : 'entry'} boundaries`, () => {
  const store = responseStore<unknown>(), expected: unknown[] = []
  const statement = '漢'.repeat(256), long = '字'.repeat(4000)
  for (let index = 0; index < 1401; index++) {
    const row = { index, consent: { accepted: index % 2 === 0, statement }, values: [null, false, 0, '', `${index}:a`, `${index}:b`, `${index}:c`, `${index}:d`], long: longValues && index < 100 ? long + index : statement }
    expected.push(row); store.add(row)
  }
  expect(store.length).toBe(expected.length)
  for (let index = store.length - 1; index >= 0; index--) expect(store.get(index)).toEqual(expected[index])
  const changed = store.get(99) as { consent: { statement: string }; values: unknown[] }
  changed.consent.statement = 'Changed only in one read'; changed.values.push('Changed')
  expect(store.get(99)).toEqual(expected[99])
  expect(store.get(100)).toEqual(expected[100])
})
