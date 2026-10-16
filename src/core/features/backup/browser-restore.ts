import initSqlJs from 'sql.js'
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'
import { backupBytes, type BackupArchive } from './model'
import { checkBackup } from './check'
import { erasureFence } from '../../../../scripts/deployment-data-browser-shared.mjs'
import { restoreInDatabase } from './sqlite-restore'

let sqlite: ReturnType<typeof initSqlJs> | undefined
async function readArchive(file: File) {
  if (file.size > backupBytes) throw new Error('This file exceeds the 8 MiB browser limit. Use the advanced restore-test command.')
  let value: unknown
  try { value = JSON.parse(await file.text()) }
  catch { throw new Error('Choose the original Pencil .rer backup file. This file is not valid JSON.') }
  return checkBackup(value)
}
const store = (archive: BackupArchive) => ({payload: archive.payload, rows(index: number) { return archive.payload.tables[index].rows }})
export async function testBrowserRestore(file: File, laterFile?: File) {
  const { archive, summary } = await readArchive(file)
  if (laterFile) {
    const later = await readArchive(laterFile)
    erasureFence(store(archive),store(later.archive))
  }
  // Both JavaScript and WASM come from this installation. The selected archive
  // stays in the browser; no database binding, network writer or mail exists.
  sqlite ??= initSqlJs({locateFile: () => wasmUrl})
  const SQL = await sqlite, db = new SQL.Database()
  try {
    const reexportSha256 = await restoreInDatabase(db,archive)
    return {...summary, restored: true as const, reexportSha256}
  } finally { db.close() }
}
export type BrowserRestoreResult = Awaited<ReturnType<typeof testBrowserRestore>>
