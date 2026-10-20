import { ValidationError } from '../../shared/errors'
import type { SavValue, SavVariable } from './savDictionary'

/**
 * An SPSS system file (.sav) writer: bytecode-compressed, UTF-8, little-endian. Strings wider than
 * 255 bytes use very long string segments of 252 bytes' width each (255 allocated), as SPSS and
 * ReadStat write them. An unfinished command block is the only writer state an export part carries.
 */
const encoder = new TextEncoder()
const bias = 100, sysmis = -Number.MAX_VALUE
const labelLimit = 255, valueLabelLimit = 120
type Writer = { bytes: number[]; int: (value: number) => void; double: (value: number) => void; raw: (value: Uint8Array) => void; text: (value: string, length: number) => void }
function writer(): Writer {
  const bytes: number[] = [], scratch = new DataView(new ArrayBuffer(8))
  return {
    bytes,
    int(value) { scratch.setInt32(0, value, true); for (let i = 0; i < 4; i++) bytes.push(scratch.getUint8(i)) },
    double(value) { scratch.setFloat64(0, value, true); for (let i = 0; i < 8; i++) bytes.push(scratch.getUint8(i)) },
    raw(value) { for (const byte of value) bytes.push(byte) },
    text(value, length) { const encoded = encoder.encode(value); for (let i = 0; i < length; i++) bytes.push(i < encoded.length ? encoded[i] : 0x20) },
  }
}
/** Cut at a UTF-8 boundary so a label never ends in half a character. */
function clip(value: string, limit: number) {
  const encoded = encoder.encode(value)
  if (encoded.length <= limit) return encoded
  let end = limit - 3
  while (end > 0 && (encoded[end] & 0xc0) === 0x80) end--
  return new Uint8Array([...encoded.slice(0, end), 0xe2, 0x80, 0xa6])
}
type Segment = { short: string; width: number }
export type SavColumn = SavVariable & { width: number; segments: Segment[]; slot: number }
/** Short names, segments and dictionary slots for each variable. */
export function savLayout(variables: SavVariable[], widths: number[]): SavColumn[] {
  let serial = 0, slot = 1
  return variables.map((variable, index) => {
    const width = widths[index]
    const count = !variable.string || width < 256 ? 1 : Math.ceil(width / 252)
    const segments = Array.from({ length: count }, (_, k) => ({ short: `V${++serial}`, width: !variable.string ? 0 : count === 1 ? width : k < count - 1 ? 255 : width - 252 * (count - 1) }))
    const column = { ...variable, width, segments, slot }
    slot += segments.reduce((sum, segment) => sum + (segment.width ? Math.ceil(segment.width / 8) : 1), 0)
    return column
  })
}
const format = (column: SavColumn, segment: Segment) => column.string ? (1 << 16) | (Math.min(segment.width, 255) << 8) : (5 << 16) | (8 << 8) | 2

export function savHeader(columns: SavColumn[], cases: number, created: Date) {
  const out = writer()
  const slots = columns.reduce((sum, column) => sum + column.segments.reduce((n, segment) => n + (segment.width ? Math.ceil(segment.width / 8) : 1), 0), 0)
  const date = created.toUTCString().split(' ') // e.g. Tue, 20 Oct 2026 15:06:00 GMT
  out.text('$FL2', 4); out.text('@(#) SPSS DATA FILE Pencil LEDG-005 export', 60)
  out.int(2); out.int(slots); out.int(1); out.int(0); out.int(cases); out.double(bias)
  out.text(`${date[1]} ${date[2]} ${date[3].slice(2)}`, 9); out.text(date[4], 8); out.text('Pencil responses', 64); out.text('', 3)
  for (const column of columns) column.segments.forEach((segment, index) => {
    const label = index === 0 ? clip(column.label, labelLimit) : undefined
    out.int(2); out.int(column.string ? segment.width : 0); out.int(label ? 1 : 0); out.int(0); out.int(format(column, segment)); out.int(format(column, segment)); out.text(segment.short, 8)
    if (label) { out.int(label.length); out.raw(label); for (let pad = label.length; pad % 4; pad++) out.bytes.push(0x20) }
    for (let n = 1; n < Math.ceil(segment.width / 8); n++) { out.int(2); out.int(-1); out.int(0); out.int(0); out.int(0); out.int(0); out.text('', 8) }
  })
  for (const column of columns) if (column.valueLabels?.length) {
    out.int(3); out.int(column.valueLabels.length)
    for (const [value, label] of column.valueLabels) { const encoded = clip(label, valueLabelLimit); out.double(value); out.bytes.push(encoded.length); out.raw(encoded); for (let pad = encoded.length + 1; pad % 8; pad++) out.bytes.push(0x20) }
    out.int(4); out.int(1); out.int(column.slot)
  }
  const info = (subtype: number, size: number, data: number[]) => { out.int(7); out.int(subtype); out.int(size); out.int(data.length / size); out.bytes.push(...data) }
  const ints = (...values: number[]) => { const w = writer(); values.forEach(w.int); return w.bytes }
  const doubles = (...values: number[]) => { const w = writer(); values.forEach(w.double); return w.bytes }
  const lowest = new DataView(new ArrayBuffer(8)); lowest.setBigUint64(0, 0xffeffffffffffffen, true)
  info(3, 4, ints(1, 0, 0, -1, 1, 1, 2, 65001))
  info(4, 8, doubles(sysmis, Number.MAX_VALUE, lowest.getFloat64(0, true)))
  info(13, 1, [...encoder.encode(columns.map(column => `${column.segments[0].short}=${column.name}`).join('\t'))])
  const long = columns.filter(column => column.segments.length > 1)
  if (long.length) info(14, 1, [...encoder.encode(long.map(column => `${column.segments[0].short}=${column.width}\0\t`).join(''))])
  info(20, 1, [...encoder.encode('UTF-8')])
  out.int(999); out.int(0)
  return new Uint8Array(out.bytes)
}

/** An unfinished command block (fewer than eight codes) carried to the next export part. */
export type SavPending = { commands: number[]; data: number[] }
/** Bytecode-compress cases; blocks run on across cases, and only the last part pads its final block. */
export function savCases(columns: SavColumn[], cases: SavValue[][], pending: SavPending, last: boolean) {
  const commands = [...pending.commands], data = [...pending.data], out: number[] = []
  const flush = () => { while (commands.length % 8) commands.push(0); out.push(...commands, ...data); commands.length = 0; data.length = 0 }
  const block = (code: number, bytes?: number[]) => { commands.push(code); if (bytes) data.push(...bytes); if (commands.length === 8) flush() }
  for (const values of cases) columns.forEach((column, index) => {
    const value = values[index]
    if (!column.string) {
      if (value === null) return block(255)
      if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`SPSS variable ${column.name} needs a finite number.`)
      if (Number.isInteger(value) && value >= 1 - bias && value <= 251 - bias) return block(value + bias)
      const w = writer(); w.double(value); return block(253, w.bytes)
    }
    const encoded = encoder.encode(String(value ?? ''))
    if (encoded.length > column.width) throw new ValidationError(`${column.name} holds ${encoded.length} bytes, more than its ${column.width}-byte SPSS width. Export CSV, JSON or XLSX for this selection.`)
    let offset = 0
    for (const segment of column.segments) {
      const slots = Math.ceil(segment.width / 8), take = column.segments.length > 1 && segment !== column.segments.at(-1) ? 255 : segment.width
      const piece = encoded.slice(offset, offset + take); offset += take
      for (let s = 0; s < slots; s++) {
        const chunk = Array.from({ length: 8 }, (_, i) => piece[s * 8 + i] ?? 0x20)
        if (chunk.every(byte => byte === 0x20)) block(254)
        else block(253, chunk)
      }
    }
  })
  if (last && commands.length) flush()
  return { bytes: new Uint8Array(out), pending: { commands, data } }
}
