import { Buffer } from 'node:buffer'
import type { NativeRow } from './native-tables'
/** Values stay below D1's bound-value ceiling without separating the native
 * entity's transaction. Exact guards cover every chunk and the scoped count. */
export function* nativeRowChunks(rows: NativeRow[]): Generator<string> {
  let parts: string[] = [], bytes = 2
  for (const row of rows) {
    const part = JSON.stringify(row), size = Buffer.byteLength(part) + 1
    if (parts.length && bytes + size > 512 * 1024) { yield `[${parts.join(',')}]`; parts = []; bytes = 2 }
    parts.push(part); bytes += size
  }
  if (parts.length) yield `[${parts.join(',')}]`
}
