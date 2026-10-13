import { expect } from 'vitest'
import { contract } from '../../../test/contract'
import { errorPageForRow } from './row-error-search'
import type { RowError } from './model'

contract(['IMPORT-002'], 'finding a row reads only bounded diagnostics from the complete large lazy report', () => {
  let reads = 0
  const errors = new Proxy(new Array<RowError>(4250000), {
    get(target, key, receiver) {
      if (typeof key === 'string' && /^(0|[1-9][0-9]*)$/.test(key)) { reads++; return { row: Math.floor(Number(key) / 50) + 2, column: 'Question', message: 'Invalid answer' } }
      return Reflect.get(target, key, receiver)
    },
  })
  for (const [row, expected] of [[2, 0], [40000, 19999], [85001, 42499], [1, undefined], [85002, undefined], [NaN, undefined], [2.5, undefined]] as const) {
    reads = 0
    expect(errorPageForRow(errors, row)).toBe(expected)
    expect(reads).toBeLessThanOrEqual(25)
  }
  expect(errorPageForRow([], 1)).toBeUndefined()
  const sparse = [{ row: 2 }, { row: 10 }, { row: 10 }, { row: 20 }] as RowError[]
  expect(errorPageForRow(sparse, 10, 1)).toBe(1)
  expect(errorPageForRow(sparse, 9, 1)).toBeUndefined()
})
