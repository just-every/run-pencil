import type { RowError } from './model'

/** Diagnostics are ordered by their original CSV row. Binary lookup reaches
 * any row without expanding the complete lazy diagnostic array. */
export function errorPageForRow(errors: RowError[], row: number, pageSize = 100): number | undefined {
  if (!Number.isSafeInteger(row) || row < 1 || !Number.isSafeInteger(pageSize) || pageSize < 1) return undefined
  let low = 0, high = errors.length
  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    if (errors[middle].row < row) low = middle + 1
    else high = middle
  }
  return low < errors.length && errors[low].row === row ? Math.floor(low / pageSize) : undefined
}
