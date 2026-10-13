import { expect } from 'vitest'
import { contract } from '../../../test/contract'
import { responseStore } from './response-store'

contract(['IMPORT-002', 'IMPORT-003'], 'compact safe responses preserve typed values, Unicode, duplicate row positions and independent decoding', () => {
  const store = responseStore()
  const response = { row: 2, startedAt: null, submittedAt: '2026-10-08T00:00:00.000Z', answers: JSON.parse('{"__proto__":"literal key","text":"😀\\n\\u0000","number":-1.25,"choice":["a","b"],"consent":{"accepted":false,"statement":"Retained statement"},"empty":null}') }
  store.add(response); store.add({ ...response, row: 3 })
  expect(store.length).toBe(2)
  expect(store.get(0)).toEqual(response)
  expect(store.get(1)).toEqual({ ...response, row: 3 })
  store.get(0).answers.text = 'Changed decoded copy'
  expect(store.get(0)).toEqual(response)
  expect(Object.hasOwn(store.get(0).answers, '__proto__')).toBe(true)
  for (let row = 4; row < 205; row++) store.add({ ...response, row })
  expect(store.length).toBe(203)
  for (const index of [202, 99, 100, 0, 199, 200, 1]) {
    expect(store.get(index)).toEqual({ ...response, row: index + 2 })
    store.get(index).answers.text = 'Changed compressed page copy'
    expect(store.get(index).answers.text).toBe(response.answers.text)
  }
})
