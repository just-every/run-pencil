import type { RowError } from './model'

export type ErrorPage = { dictionary: [string, string][]; rows: number[] }

/** The transport retains strings once and packs ordered row diagnostics into
 * integer pages. Neither endpoint expands the complete report into objects. */
export function* errorPages(errors: RowError[]): Generator<ErrorPage> {
  const indexes = new Map<string, number>()
  for (let start = 0; start < errors.length; start += 500) {
    const dictionary: [string, string][] = [], rows: number[] = []
    let row = -1, countAt = -1
    for (let index = start; index < Math.min(start + 500, errors.length); index++) {
      const error = errors[index], key = JSON.stringify([error.column, error.message])
      let code = indexes.get(key)
      if (code === undefined) { code = indexes.size; indexes.set(key, code); dictionary.push([error.column, error.message]) }
      if (row !== error.row) { row = error.row; rows.push(row, 0); countAt = rows.length - 1 }
      rows[countAt]++; rows.push(code)
    }
    yield { dictionary, rows }
  }
}

export function pagedErrors() {
  const dictionary: [string, string][] = [], pages: { start: number; rows: Uint32Array }[] = []
  let length = 0, bytes = 0, lastRow = 0
  const at = (index: number): RowError => {
    let low = 0, high = pages.length - 1
    while (low < high) { const middle = Math.ceil((low + high) / 2); if (pages[middle].start <= index) low = middle; else high = middle - 1 }
    const page = pages[low], rows = page.rows
    let offset = index - page.start
    for (let cursor = 0; cursor < rows.length;) {
      const row = rows[cursor++], count = rows[cursor++]
      if (offset < count) { const [column, message] = dictionary[rows[cursor + offset]]; return { row, column, message } }
      offset -= count; cursor += count
    }
    throw new Error('The review diagnostic page is incomplete.')
  }
  const errors = new Proxy([] as RowError[], {
    get(target, key, receiver) {
      if (key === 'length') return length
      if (typeof key === 'string' && /^(0|[1-9][0-9]*)$/.test(key)) return Number(key) < length ? at(Number(key)) : undefined
      return Reflect.get(target, key, receiver)
    },
    has(target, key) { return typeof key === 'string' && /^(0|[1-9][0-9]*)$/.test(key) && Number(key) < length || Reflect.has(target, key) },
    set() { throw new Error('Reviewed row errors are immutable.') },
  })
  return {
    errors,
    get retainedBytes() { return bytes },
    append(page: ErrorPage) {
      if (!page || Object.keys(page).sort().join(',') !== 'dictionary,rows' || !Array.isArray(page.dictionary) || page.dictionary.length > 500 || !Array.isArray(page.rows) || page.rows.length > 1500) throw new Error('The review diagnostic page is invalid.')
      for (const pair of page.dictionary) {
        if (!Array.isArray(pair) || pair.length !== 2 || pair.some(value => typeof value !== 'string')) throw new Error('The review diagnostic dictionary is invalid.')
        dictionary.push([pair[0], pair[1]]); bytes += new TextEncoder().encode(pair[0] + pair[1]).byteLength
      }
      for (const value of page.rows) if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) throw new Error('The review diagnostic vector is invalid.')
      let count = 0
      for (let cursor = 0; cursor < page.rows.length;) {
        const row = page.rows[cursor++], size = page.rows[cursor++]
        if (row < 1 || row < lastRow || !size || cursor + size > page.rows.length) throw new Error('The review diagnostic row is invalid.')
        lastRow = row; count += size
        for (let end = cursor + size; cursor < end; cursor++) if (page.rows[cursor] >= dictionary.length) throw new Error('The review diagnostic reference is invalid.')
      }
      if (!count || count > 500) throw new Error('The review diagnostic count is invalid.')
      const rows = Uint32Array.from(page.rows)
      pages.push({ start: length, rows }); length += count; bytes += rows.byteLength
    },
  }
}
