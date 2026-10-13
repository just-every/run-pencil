import type { RowError } from './model'
import { responseStore } from './response-store'

type RejectedRow = { row: number; errors: RowError[] }
export type RejectedRows = { readonly length: number; get(index: number): RejectedRow }

/** The report and rejected source records share one compressed diagnostic store.
 * Only the current CSV row and one decoded page need mutable containers. */
export function rowErrorStore() {
  const rejected = responseStore<RejectedRow>(), starts: number[] = []
  let length = 0, current: RejectedRow | undefined, finished = false, cachedIndex = -1, cached: RejectedRow | undefined
  const flush = () => { if (current) { rejected.add(current); current = undefined } }
  const at = (index: number) => {
    let low = 0, high = starts.length - 1
    while (low < high) { const middle = Math.ceil((low + high) / 2); if (starts[middle] <= index) low = middle; else high = middle - 1 }
    if (!cached || cachedIndex !== low) { cached = rejected.get(low); cachedIndex = low }
    return { ...cached.errors[index - starts[low]] }
  }
  // An empty array target avoids allocating a slot for every error. Array
  // iteration and JSON traversal read the complete logical length and values.
  const rowErrors = new Proxy([] as RowError[], {
    get(target, key, receiver) {
      if (key === 'length') return length
      if (typeof key === 'string' && /^(0|[1-9][0-9]*)$/.test(key)) return Number(key) < length ? at(Number(key)) : undefined
      return Reflect.get(target, key, receiver)
    },
    has(target, key) { return typeof key === 'string' && /^(0|[1-9][0-9]*)$/.test(key) && Number(key) < length || Reflect.has(target, key) },
    set() { throw new Error('Reviewed row errors are immutable.') },
  })
  return {
    get length() { return length },
    push(...errors: RowError[]) {
      if (finished) throw new Error('Row error collection is complete.')
      for (const error of errors) {
        if (current && error.row < current.row) throw new Error('CSV diagnostics must retain row order.')
        if (!current || current.row !== error.row) { flush(); starts.push(length); current = { row: error.row, errors: [] } }
        current.errors.push({ ...error }); length++
      }
      return length
    },
    finish() { flush(); finished = true; return { rejected, rowErrors } },
  }
}
