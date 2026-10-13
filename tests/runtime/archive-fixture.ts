import { initializedTable } from '../../scripts/deployment-data-initialized.mjs'
import { insertStatement } from '../../scripts/deployment-data-sql.mjs'
import type { D1Migration } from 'cloudflare:test'
import { readStatement, restoreStatements, schemaQuery, ledger, quote } from '../../scripts/deployment-data-sql.mjs'
import { sanitize } from '../../scripts/deployment-data-policy.mjs'

type Cell = { type: string; value?: string | number; hex?: string }
type Table = { name: string; columns: string[]; rows: Cell[][] }
type SchemaEntry = { type: string; name: string; sql: string }
const toHex = (base64: string) => [...atob(base64)].map(char => char.charCodeAt(0).toString(16).padStart(2, '0')).join('')

// Keep the exact synthetic baseline in memory for cleanup between persistent
// Worker cases. Export scenarios use archiveFixture's privacy normalization.
export async function snapshotFixture(db: D1Database, migrations: D1Migration[]) {
  const schema = (await db.prepare(schemaQuery).all()).results as SchemaEntry[]
  const tables = await Promise.all(schema.filter(row => row.type === 'table').sort((a, b) => a.name.localeCompare(b.name)).map(async row => ({
    name: row.name, columns: (await db.prepare(`PRAGMA table_xinfo(${quote(row.name)})`).all<{ name: string; hidden: number }>()).results.filter(column => column.hidden === 0).map(column => column.name),
  })))
  const descriptors = [ledger, ...tables]
  const result = await db.batch(descriptors.map(table => db.prepare(readStatement(table).sql)))
  const records = descriptors.map((table, index) => ({ ...table, rows: result[index].results.map(row => JSON.parse(String(row.cells)).map((cell: Cell) => cell.type === 'blob'
    ? { type: 'blob', value: btoa(String(cell.hex).match(/../g)?.map(hex => String.fromCharCode(parseInt(hex, 16))).join('') ?? '') } : cell)) })) as Table[]
  return { payload: { schema: JSON.stringify(schema), migrations: migrations.map(row => ({ name: row.name })), d1Migrations: records[0], tables: records.slice(1) } }
}

export async function archiveFixture(db: D1Database, migrations: D1Migration[]) {
  const snapshot = await snapshotFixture(db, migrations)
  return { payload: { ...snapshot.payload, tables: snapshot.payload.tables.map(sanitize) } }
}

export async function restoreFixture(db: D1Database, archive: Awaited<ReturnType<typeof archiveFixture>>) {
  const schema = JSON.parse(archive.payload.schema) as SchemaEntry[], triggers = schema.filter(row => row.type === 'trigger')
  // Only a fixture may clear its database. Production restoration always refuses
  // a populated target, then uses these same guarded statements on an empty one.
  await db.batch([
    db.prepare('PRAGMA defer_foreign_keys = ON'),
    ...triggers.map(row => db.prepare(`DROP TRIGGER ${quote(row.name)}`)),
    ...archive.payload.tables.map((table: Table) => db.prepare(`DELETE FROM ${quote(table.name)}`)),
    ...archive.payload.tables.flatMap((table: Table) => initializedTable(table).rows.map((row: Cell[]) => {
      const statement = insertStatement(table, row, toHex)
      return db.prepare(statement.sql).bind(...statement.params)
    })),
    ...triggers.map(row => db.prepare(row.sql)),
  ])
  await db.batch(restoreStatements(archive, schema, toHex).map(({ sql, params = [] }: { sql: string; params?: unknown[] }) => db.prepare(sql).bind(...params)))
}
