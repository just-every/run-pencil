import { canonicalJson, sha256, type ImportPlan, type Json } from '../../../base/import-kit/src/d1/index'
import { cloneJson } from '../../../base/import-kit/src/provenance/canonical-stream'
import { copyArray, copyWithField } from './codec-copy'
// Version one stores every native field and row order. Only derived row IDs use
// a fixed SHA-256 expression; decoding never reruns file parsing or mapping.
const derivedIds = new Map<string, string>()
const derivedId = (scope: string, key: string) => {
  const input = scope + ':' + key, cached = derivedIds.get(input)
  if (cached) return cached
  // Repeated encode/decode checks share deterministic row IDs within a bounded
  // working set. This cache contains no answers or database snapshots.
  if (derivedIds.size === 4096) derivedIds.clear()
  const id = `i_${sha256(input).slice(0, 28)}`
  derivedIds.set(input, id)
  return id
}
const derivedColumns: Record<string, [string, string]> = { response_answers: ['response_id', 'step_id'], flow_steps: ['revision_id', 'stable_id'], choice_options: ['step_id', 'stable_id'] }
// Native rows repeat most columns. Column vectors preserve row order and every
// value while retaining each constant once, independently within this page.
function encodeTable(name: string, rows: any[]) {
  const keys = Object.keys(rows[0] ?? {}).sort(), keySet = new Set(keys), derived = derivedColumns[name]
  for (const row of rows) {
    const rowKeys = Object.keys(row)
    if (rowKeys.length !== keys.length || rowKeys.some(key => !keySet.has(key))) throw new Error('IMPORT_PLAN_CODEC_MISMATCH')
    if (derived && (typeof row[derived[0]] !== 'string' || typeof row[derived[1]] !== 'string' || row.id !== derivedId(row[derived[0]], row[derived[1]]))) throw new Error('IMPORT_PLAN_CODEC_MISMATCH')
  }
  return { length: rows.length, columns: keys.map(key => {
    if (key === 'id' && derived) return [key, { derived: 1 }]
    const values = rows.map(row => row[key]), first = values[0]
    const primitive = (value: unknown) => value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value)
    const firstPrimitive = primitive(first), encodedFirst = firstPrimitive ? undefined : canonicalJson(first)
    const constant = values.every(value => firstPrimitive && primitive(value) ? value === first : canonicalJson(value) === (encodedFirst ?? canonicalJson(first)))
    return [key, constant ? { constant: first } : { values }]
  }) }
}
function decodeTable(name: string, table: any) {
  if (!Number.isSafeInteger(table.length) || table.length < 0 || !Array.isArray(table.columns) || canonicalJson(Object.keys(table).sort()) !== '["columns","length"]') throw new Error('IMPORT_PLAN_CODEC_MISMATCH')
  const rows = Array.from({ length: table.length }, () => ({} as Record<string, any>)), seen = new Set<string>()
  for (const tuple of table.columns) {
    if (!Array.isArray(tuple) || tuple.length !== 2) throw new Error('IMPORT_PLAN_CODEC_MISMATCH')
    const [key, column] = tuple
    if (typeof key !== 'string' || seen.has(key) || !column || typeof column !== 'object' || Array.isArray(column) || Object.keys(column).length !== 1) throw new Error('IMPORT_PLAN_CODEC_MISMATCH')
    seen.add(key)
    if (key === 'id' && derivedColumns[name]) {
      if (column.derived !== 1) throw new Error('IMPORT_PLAN_CODEC_MISMATCH')
      continue
    }
    if (!Object.hasOwn(column, 'constant') && (!Array.isArray(column.values) || column.values.length !== rows.length)) throw new Error('IMPORT_PLAN_CODEC_MISMATCH')
    rows.forEach((row, i) => Object.defineProperty(row, key, { value: cloneJson(Object.hasOwn(column, 'constant') ? column.constant : column.values[i]), enumerable: true, configurable: true, writable: true }))
  }
  const derived = derivedColumns[name]
  if (derived && rows.length) {
    if (!seen.has('id')) throw new Error('IMPORT_PLAN_CODEC_MISMATCH')
    for (const row of rows) {
      if (typeof row[derived[0]] !== 'string' || typeof row[derived[1]] !== 'string') throw new Error('IMPORT_PLAN_CODEC_MISMATCH')
      row.id = derivedId(row[derived[0]], row[derived[1]])
    }
  }
  return rows
}
export const importPlanCodec = {
  id: 'native-form-ids-v1',
  encode(plan: ImportPlan): Json {
    return { ...plan, entries: plan.entries.map(entry => ({ ...entry, effects: entry.effects.map(effect => {
      const value = effect.value as any
      const tables = Object.fromEntries(Object.entries(value.tables).map(([name, rows]) => [name, encodeTable(name, rows as any[])]))
      return { ...effect, value: { ...value, tables } }
    }) })) } as unknown as Json
  },
  decode(payload: Json): ImportPlan {
    const tables = (value: any) => {
      if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new Error('IMPORT_PLAN_CODEC_MISMATCH')
      return Object.fromEntries(Object.keys(value).sort().map(name => [name, decodeTable(name, cloneJson(value[name]))]))
    }
    const nativeValue = (value: any) => copyWithField(value, 'tables', tables)
    const effect = (value: any) => copyWithField(value, 'value', nativeValue)
    const entry = (value: any) => copyWithField(value, 'effects', values => copyArray(values, effect))
    return copyWithField(payload, 'entries', values => copyArray(values, entry)) as ImportPlan
  },
}
