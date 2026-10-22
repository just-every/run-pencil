import type { Database } from 'sql.js'
import manifest from 'virtual:pencil-backup-manifest'
import type { BackupArchive } from './model'
import { digest } from './model'
import { canonicalSchema, hashedLedgerSQL, kitLedgerSQL, ledgerDefinition, platformLedger, platformLedgerSQL, schemaQuery } from '../../../../scripts/deployment-data-browser-shared.mjs'
import { insertRows, readRows } from './sqlite-values'
import { checkObject, type ArchiveObject } from '../../../../scripts/deployment-data-objects.mjs'

type SchemaEntry = {type: string; name: string; tbl_name: string; sql: string}
export async function restoreInDatabase(db: Database, archive: BackupArchive) {
  // The restore test owns a new attachment store alongside its new SQLite DB.
  // Copy and verify bytes, then reconstruct the archive from both restored stores.
  const restoredObjects = new Map<string, { metadata: Omit<ArchiveObject,'data'>; bytes: Uint8Array }>()
  for (const object of archive.payload.objects ?? []) {
    const {data: _data,...metadata} = object
    restoredObjects.set(object.key,{metadata,bytes:(await checkObject(object)).slice()})
  }
  const schema = JSON.parse(manifest.schema) as SchemaEntry[]
  const ledger = ledgerDefinition(archive.payload.d1Migrations).table
  // Only the application's build-time schema is executed. Uploaded archive
  // SQL is compared against that schema by checkBackup and never executed.
  const ledgerSQL = ledger.name === platformLedger.name ? platformLedgerSQL : ledger.name === '_rer_deploy_migrations' ? kitLedgerSQL : ledger.columns.includes('sha256') ? hashedLedgerSQL : 'CREATE TABLE d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL)'
  db.run('PRAGMA foreign_keys=OFF; BEGIN IMMEDIATE')
  try {
    db.run(ledgerSQL)
    for (const type of ['table','index','view']) for (const entry of schema.filter(entry => entry.type === type)) db.run(entry.sql)
    // As in the file restore, initialization rows are replaced by archive rows
    // and triggers remain absent during insertion, so no history is replayed.
    for (const table of [archive.payload.d1Migrations, ...archive.payload.tables]) {
      insertRows(db,table)
      await new Promise<void>(resolve => setTimeout(resolve,0))
    }
    for (const entry of schema.filter(entry => entry.type === 'trigger')) db.run(entry.sql)
    const integrity = db.exec('PRAGMA integrity_check')
    if (integrity[0]?.values[0]?.[0] !== 'ok' || db.exec('PRAGMA foreign_key_check').length) throw new Error('The restored database failed integrity or linked-record checks.')
    db.run('COMMIT; PRAGMA foreign_keys=ON')
  } catch (error) { db.run('ROLLBACK'); throw error }
  const actual = db.exec(schemaQuery)[0]
  canonicalSchema(actual.values.map(values => Object.fromEntries(actual.columns.map((column,index) => [column,values[index]]))), manifest.schema)
  const payload: BackupArchive['payload'] = {
    format: archive.payload.format, migrations: manifest.migrations, schema: manifest.schema,
    d1Migrations: readRows(db,ledger), tables: manifest.tables.map(table => readRows(db,table)),
  }
  if (archive.payload.objects !== undefined) payload.objects = [...restoredObjects.values()].map(({metadata,bytes}) => {
    let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte)
    return {...metadata,data:btoa(binary)}
  })
  const reexportSha256 = await digest(payload)
  if (reexportSha256 !== archive.sha256) throw new Error('The restored database did not re-export with the original checksum. Keep the original deployment and archive.')
  return reexportSha256
}
