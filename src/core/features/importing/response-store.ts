import { deflateRawSync, inflateRawSync } from 'node:zlib'
import { Buffer } from 'node:buffer'
import type { ParsedResponse } from './model'
/** A bounded shared dictionary shares common IDs and immutable statements
 * across pages. Strings beyond either cache bound stay in their own page.
 * Only decoded safe records enter custody. */
export function responseStore<T = ParsedResponse>() {
  const sharedLimit = 4096, sharedByteLimit = 1024 * 1024
  const sharedStrings: string[] = [], sharedIndexes = new Map<string, number>()
  let sharedBytes = 0
  let strings: string[] = []
  const indexes = new Map<string, number>(), chunks: string[] = []
  let rows: string[] = [], length = 0, current = -1, cached: { strings: string[]; rows: unknown[] } = { strings: [], rows: [] }
  const intern = (value: string) => {
    const shared = sharedIndexes.get(value)
    if (shared !== undefined) return shared
    const bytes = Buffer.byteLength(value)
    if (sharedStrings.length < sharedLimit && sharedBytes + bytes <= sharedByteLimit) {
      const id = sharedStrings.length; sharedStrings.push(value); sharedIndexes.set(value, id); sharedBytes += bytes; return id
    }
    const prior = indexes.get(value)
    if (prior !== undefined) return sharedLimit + prior
    const id = strings.length; strings.push(value); indexes.set(value, id); return sharedLimit + id
  }
  const encode = (value: unknown): unknown => {
    if (typeof value === 'string') return -1 - intern(value)
    if (typeof value === 'number') return ['n', value]
    if (Array.isArray(value)) return ['a', ...value.map(encode)]
    if (value && typeof value === 'object') return ['o', ...Object.entries(value).flatMap(([key, item]) => [intern(key), encode(item)])]
    return value
  }
  const decode = (value: any, dictionary = strings): any => {
    const string = (index: number) => index < sharedLimit ? sharedStrings[index] : dictionary[index - sharedLimit]
    if (typeof value === 'number') return string(-1 - value)
    if (!Array.isArray(value)) return value
    if (value[0] === 'n') return value[1]
    if (value[0] === 'a') return value.slice(1).map(item => decode(item, dictionary))
    const object: Record<string, unknown> = {}
    for (let i = 1; i < value.length; i += 2) Object.defineProperty(object, string(value[i]), { value: decode(value[i + 1], dictionary), enumerable: true, configurable: true, writable: true })
    return object
  }
  return {
    get length() { return length },
    add(response: T) {
      rows.push(JSON.stringify(encode(response))); length++
      if (rows.length === 100) {
        // Each row already contains complete JSON. Joining those exact bytes
        // avoids reparsing every safe answer solely to serialize it again.
        const compressed = deflateRawSync(`{"strings":${JSON.stringify(strings)},"rows":[${rows.join(',')}]}`)
        chunks.push(Buffer.from(compressed.buffer, compressed.byteOffset, compressed.byteLength).toString('base64'))
        rows = []; strings = []; indexes.clear()
      }
    },
    get(index: number): T {
      const page = Math.floor(index / 100), offset = index % 100
      if (page === chunks.length) return decode(JSON.parse(rows[offset]))
      if (page !== current) {
        cached = { strings: [], rows: [] }
        const decoded = inflateRawSync(Buffer.from(chunks[page], 'base64'))
        cached = JSON.parse(Buffer.from(decoded.buffer, decoded.byteOffset, decoded.byteLength).toString('utf8')); current = page
      }
      return decode(cached.rows[offset], cached.strings)
    },
  }
}
export type ResponseStore = ReturnType<typeof responseStore<ParsedResponse>>
