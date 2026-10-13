import { expect } from 'vitest'
import { contract } from '../../../test/contract'
import type { ImportReview, RowError } from './model'
import { errorPages, pagedErrors } from './row-error-pages'
import { readReviewStream, reviewStream } from './review-stream'

const review = (rowErrors: RowError[]): ImportReview => ({ plannedAt: '2026-10-08T00:00:00.000Z', fingerprint: 'review', flowId: 'flow', title: 'Review', report: [], headers: [], forbiddenColumns: [], columns: [], questions: [], rowErrors, responseCount: 0, lossRequired: true, alreadyImported: false, heldByOtherOperator: false })

contract(['IMPORT-002', 'IMPORT-003'], 'streamed browser reports retain exact ordered diagnostics without mutable aliases', async () => {
  const errors = Array.from({ length: 1203 }, (_, index) => ({ row: Math.floor(index / 3) + 2, column: ['零', '__proto__', '𐐀'][index % 3], message: `Value ${index % 7} must be corrected.` }))
  const source = reviewStream(review(errors)), reader = source.getReader()
  let chunk: Uint8Array = new Uint8Array(), offset = 0
  const split = new ReadableStream<Uint8Array>({ async pull(controller) {
    if (offset === chunk.length) { const next = await reader.read(); if (next.done) { controller.close(); return }; chunk = next.value; offset = 0 }
    const end = Math.min(offset + 17, chunk.length); controller.enqueue(chunk.slice(offset, end)); offset = end
  } })
  const decoded = await readReviewStream(split)
  expect(Array.from(decoded.rowErrors)).toEqual(errors)
  expect(decoded.rowErrors.slice(499, 603)).toEqual(errors.slice(499, 603))
  decoded.rowErrors[501].message = 'Changed only in this read'
  expect(decoded.rowErrors[501]).toEqual(errors[501])
  expect({ ...decoded, rowErrors: [] }).toEqual(review([]))
})

contract(['IMPORT-002', 'IMPORT-003'], 'all diagnostics from 85000 wide invalid rows fit a compact browser store and remain readable', () => {
  const count = 85000 * 50, expected = (index: number) => ({ row: Math.floor(index / 50) + 2, column: `Column ${index % 50}`, message: index % 50 === 49 ? 'A submission timestamp is required.' : 'Use 1/0 or true/false.' })
  const errors = new Proxy([] as RowError[], { get(target, key, receiver) { if (key === 'length') return count; if (typeof key === 'string' && /^\d+$/.test(key)) return expected(Number(key)); return Reflect.get(target, key, receiver) } })
  const store = pagedErrors()
  for (const page of errorPages(errors)) store.append(page)
  expect(store.errors.length).toBe(count)
  expect(store.retainedBytes).toBeLessThan(20 * 1024 * 1024)
  for (let index = 0; index < count; index++) {
    const value = store.errors[index], wanted = expected(index)
    if (value.row !== wanted.row || value.column !== wanted.column || value.message !== wanted.message) throw new Error(`Diagnostic ${index} differs`)
  }
  expect(store.errors.slice(-100)).toEqual(Array.from({ length: 100 }, (_, index) => expected(count - 100 + index)))
}, 60000)

contract(['IMPORT-002', 'IMPORT-003'], 'incomplete or malformed streamed reports never become reviewable', async () => {
  const encode = (text: string) => new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new TextEncoder().encode(text)); controller.close() } })
  const header = JSON.stringify({ review: review([]), errorCount: 1 }) + '\n'
  for (const text of [header, header + '{"done":true}\n', header + '{"dictionary":[],"rows":[2,1,0]}\n{"done":true}\n', header + '{"dictionary":[["Column","Error"]],"rows":[2,2,0]}\n{"done":true}\n']) await expect(readReviewStream(encode(text))).rejects.toThrow()
})
