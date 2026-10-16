import manifest from 'virtual:pencil-backup-manifest'
import { backupBytes, backupRows, digest, type BackupArchive, type BackupCell } from './model'
import { checkBackup } from './check'
import { assertLedgerShape, canonicalSchema, quote, rowExpression, rowsNeverTravel, sanitize, schemaQuery } from '../../../../scripts/deployment-data-browser-shared.mjs'
import { ValidationError } from '../../shared/errors'

function readCells(json: string): BackupCell[] {
  return (JSON.parse(json) as Array<BackupCell | {type: 'blob'; hex: string}>).map(cell => {
    if (cell.type !== 'blob' || !('hex' in cell)) return cell as BackupCell
    let binary = ''
    for (let offset = 0; offset < cell.hex.length; offset += 2) binary += String.fromCharCode(parseInt(cell.hex.slice(offset, offset + 2), 16))
    return { type: 'blob', value: btoa(binary) }
  })
}
// A balanced sum stays below hosted D1's expression-depth limit even when
// the workspace schema contains more tables than that limit.
function sumTerms(terms: string[]): string {
  if (!terms.length) return '0'
  if (terms.length === 1) return terms[0]
  const middle = Math.floor(terms.length/2)
  return `(${sumTerms(terms.slice(0,middle))}+${sumTerms(terms.slice(middle))})`
}
const ledgerShapeSQL = "SELECT name FROM sqlite_schema WHERE type='table' AND name IN ('d1_migrations','_rer_deploy_migrations') ORDER BY name"
const shapes: Record<string, string[]> = { d1_migrations: ['id','name','applied_at'], _rer_deploy_migrations: ['name','sha256','state'] }

export async function exportBackup(db: D1Database) {
  // Discovery selects only a controller name, never product data. The actual
  // schema, controller columns, history and all rows are read in ONE atomic
  // D1 batch below. Any intervening schema change fails closed.
  const discovered = await db.prepare(ledgerShapeSQL).all<{name: string}>()
  if (discovered.results.length !== 1) throw new ValidationError('The database migration history is ambiguous. Keep this deployment and ask its maintainer to check it.')
  const ledgerName = discovered.results[0].name
  const shape = (await db.prepare(`PRAGMA table_xinfo(${quote(ledgerName)})`).all<{name:string}>()).results.map(row => row.name)
  if (!(ledgerName in shapes)) throw new ValidationError('The database migration history is unsupported.')
  const history = {name: ledgerName, columns: shape}
  const retained = manifest.tables.filter(table => !rowsNeverTravel(table.name))
  // JSON escaping needs at most six bytes per source byte; the fixed allowance
  // covers cell wrappers and numeric representations. The guard fails before
  // any large result can cross the Worker boundary, in the same transaction.
  // Hosted D1 restricts compound SELECT terms more tightly than local SQLite.
  // Independent scalar subqueries keep all table budgets in this same guard
  // without a UNION per table or weakening the transaction's size bound.
  const bytes = sumTerms(retained.map(table => `(SELECT coalesce(sum(${sumTerms(table.columns.map(column => `coalesce(length(CAST(${quote(column)} AS BLOB)),0)*6+64`))}+16),0) FROM ${quote(table.name)})`))
  const count = sumTerms(retained.map(table => `(SELECT count(*) FROM ${quote(table.name)})`))
  const guard = `SELECT CASE WHEN (${bytes})<=${backupBytes - new TextEncoder().encode(manifest.schema).length - 256_000} AND (${count})<=${backupRows - 1000} THEN 1 ELSE json('PENCIL_BROWSER_BACKUP_LIMIT') END AS checked`
  const queries = [guard, schemaQuery,
    `SELECT cid,name,upper(type) AS type,"notnull",dflt_value,pk,hidden FROM pragma_table_xinfo('${ledgerName}') ORDER BY cid`,
    `SELECT ${rowExpression(history)} AS cells FROM ${quote(history.name)}`,
    ...manifest.tables.map(table => `SELECT ${rowExpression(table)} AS cells FROM ${quote(table.name)}${rowsNeverTravel(table.name) ? ' WHERE 0' : ''}`),
  ]
  let results: D1Result<Record<string, unknown>>[]
  try { results = await db.batch(queries.map(sql => db.prepare(sql))) }
  catch (error) {
    if (String(error).includes('PENCIL_BROWSER_BACKUP_LIMIT') || String(error).includes('malformed JSON')) throw new ValidationError('This workspace exceeds the browser backup size limit. No archive was created. Use the large-workspace export instructions in Backup and restore, or ask your hosting maintainer to help.')
    throw error
  }
  if (results.some(result => !result.success)) throw new ValidationError('Pencil could not read a complete backup. No archive was created.')
  canonicalSchema(results[1].results, manifest.schema)
  const ledger = assertLedgerShape(results[2].results)
  const rows = (index: number) => results[index].results.map(record => readCells(record.cells as string)).sort((a,b) => JSON.stringify(a) < JSON.stringify(b) ? -1 : JSON.stringify(a) > JSON.stringify(b) ? 1 : 0)
  const payload: BackupArchive['payload'] = {
    format: 'runeditrun/pencil-local-data.v1', migrations: manifest.migrations, schema: manifest.schema,
    d1Migrations: {...ledger, rows: rows(3)},
    tables: manifest.tables.map((table,index) => sanitize({...table, rows: rows(index+4)})),
  }
  const archive = {payload, sha256: await digest(payload)}
  const { summary } = await checkBackup(archive)
  const body = JSON.stringify(archive) + '\n'
  if (new TextEncoder().encode(body).length > backupBytes) throw new ValidationError('This archive exceeds the browser backup size limit. Use the large-workspace instructions in Backup and restore.')
  return {body, summary}
}
