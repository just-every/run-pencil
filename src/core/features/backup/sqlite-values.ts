import type { Database, SqlValue, Statement } from 'sql.js'
import type { BackupCell, BackupTable } from './model'
import { quote, sanitize } from '../../../../scripts/deployment-data-browser-shared.mjs'

function decode(value: BackupCell): SqlValue {
  if (value.type === 'null') return null
  if (value.type === 'blob') return Uint8Array.from(atob(value.value), character => character.charCodeAt(0))
  return value.value
}
function encode(type: string, value: SqlValue | bigint): BackupCell {
  if (type === 'null') return {type: 'null'}
  if (type === 'integer' && typeof value === 'bigint') return {type, value: value.toString()}
  if (type === 'real' && typeof value === 'number') return {type, value}
  if (type === 'text' && typeof value === 'string') return {type, value}
  if (type === 'blob' && value instanceof Uint8Array) {
    let binary = ''
    for (const byte of value) binary += String.fromCharCode(byte)
    return {type, value: btoa(binary)}
  }
  throw new Error('The restored database returned an unsupported value.')
}
// sql.js supports useBigInt at runtime; its published types omit the option.
// Reading integer cells as BigInt preserves all signed 64-bit SQLite integers.
function exactValues(statement: Statement) {
  return (statement.get as (params: null, options: {useBigInt: true}) => Array<SqlValue | bigint>)(null, {useBigInt:true})
}
export function insertRows(db: Database, table: BackupTable) {
  // Bind decimal strings and CAST inside SQLite; binding an integer through a
  // JavaScript Number would round values above 2^53. Other types bind natively.
  const expression = "CASE ? WHEN 'integer' THEN CAST(? AS INTEGER) ELSE ? END"
  const statement = db.prepare(`INSERT INTO ${quote(table.name)} (${table.columns.map(quote).join(',')}) VALUES (${table.columns.map(() => expression).join(',')})`)
  try {
    for (const row of table.rows) {
      const values = row.flatMap(cell => {const value = decode(cell); return [cell.type,value,value]})
      statement.run(values)
    }
  } finally { statement.free() }
}
export function readRows(db: Database, table: {name: string; columns: string[]}): BackupTable {
  const columns = table.columns.flatMap(column => [`typeof(${quote(column)})`,quote(column)])
  const statement = db.prepare(`SELECT ${columns.join(',')} FROM ${quote(table.name)}`)
  const rows: BackupCell[][] = []
  try {
    while (statement.step()) {
      const values = exactValues(statement)
      rows.push(table.columns.map((_,index) => encode(values[index*2] as string, values[index*2+1])))
    }
  } finally { statement.free() }
  return sanitize({...table,rows})
}
