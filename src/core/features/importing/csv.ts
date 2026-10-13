import type { RowError } from './model'
export type CsvRow = { cells: string[]; row: number; errors: RowError[] }
/** Parse one row at a time, retaining quoted Unicode and line breaks exactly. */
export function* csvRows(text: string): Generator<CsvRow> {
  if (!text) return
  let row: string[] = [], cell = '', quoted = false, closed = false, number = 1, width: number | undefined
  let errors: RowError[] = [], reported = new Set<string>()
  const error = (message: string) => { const column = String(row.length + 1), key = `${column}:${message}`; if (!reported.has(key)) { errors.push({ row: number, column, message }); reported.add(key) } }
  const finishCell = () => { row.push(cell); cell = ''; closed = false }
  const finishRow = (): CsvRow => {
    finishCell()
    if (width === undefined) width = row.length
    else if (row.length !== width) errors.push({ row: number, column: 'row', message: `Expected ${width} columns, received ${row.length}.` })
    const result = { cells: row, row: number++, errors }; row = []; errors = []; reported = new Set(); return result
  }
  for (let i = text.charCodeAt(0) === 0xfeff ? 1 : 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++ } else { quoted = false; closed = true } }
      else cell += c
    } else if (c === ',') finishCell()
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; yield finishRow() }
    else if (c === '"' && cell === '' && !closed) quoted = true
    else { if (c === '"' || closed) error('Malformed CSV quoting.'); cell += c }
  }
  if (quoted) error('Unterminated quoted cell.')
  if (cell || row.length || closed) yield finishRow()
  else if (errors.length) yield { cells: row, row: number, errors }
}
export function parseCsv(text: string): { rows: string[][]; errors: RowError[] } {
  const rows: string[][] = [], errors: RowError[] = []
  for (const row of csvRows(text)) { rows.push(row.cells); errors.push(...row.errors) }
  return { rows, errors }
}
