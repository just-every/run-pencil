import { backupArchive, backupRows, digest, type BackupSummary, type BackupTable } from './model'
import manifest from 'virtual:pencil-backup-manifest'
import { classify, sanitize, refuseAuthorization, refuseDevRows, validateLedger } from '../../../../scripts/deployment-data-browser-shared.mjs'
import { ValidationError } from '../../shared/errors'
import { checkObject, requireObjectReferences } from '../../../../scripts/deployment-data-objects.mjs'

function refuse(message: string): never { throw new ValidationError(message) }
export async function checkBackup(value: unknown) {
  const parsed = backupArchive.safeParse(value)
  if (!parsed.success) refuse('This file is not a Pencil backup. Choose the original .rer download.')
  const archive = parsed.data, { payload } = archive
  try {
    const objects = new Map((payload.objects ?? []).map(object => [object.key,object]))
    if (payload.objects !== undefined && !objects.size) refuse('The backup has an empty attachment inventory.')
    if (objects.size !== (payload.objects?.length ?? 0)) refuse('The backup contains duplicate attachments.')
    let previous = ''
    for (const object of payload.objects ?? []) {
      if (object.key <= previous) refuse('The backup attachments are not in canonical order.')
      await checkObject(object); previous = object.key
    }
    requireObjectReferences(payload.tables,objects)
  } catch { refuse('The backup has a missing or invalid form image. Keep the source deployment and download a complete backup.') }
  if (await digest(payload) !== archive.sha256) refuse('The backup contents do not match its checksum. Download a new copy.')
  if (JSON.stringify(payload.migrations) !== JSON.stringify(manifest.migrations) || payload.schema !== manifest.schema) refuse('This backup needs its matching version of Pencil. Open Backup on the source version, or use that version to test restoration.')
  if (JSON.stringify(payload.tables.map(({name,columns}) => ({name,columns}))) !== JSON.stringify(manifest.tables)) refuse('The backup has a different table or column inventory.')
  validateLedger(payload.d1Migrations, manifest.migrations)
  let records = 0
  for (const table of [payload.d1Migrations, ...payload.tables]) {
    classify(table)
    for (const row of table.rows) {
      if (row.length !== table.columns.length) refuse('The backup contains an incomplete row.')
      for (const value of row) if (value.type === 'integer' && (BigInt(value.value) < -(1n << 63n) || BigInt(value.value) >= (1n << 63n))) refuse('The backup contains an invalid number.')
    }
    refuseAuthorization(table, table.rows); refuseDevRows(table, table.rows)
    if (JSON.stringify(sanitize(table)) !== JSON.stringify(table)) refuse('The backup contains private credentials or unordered rows. Export a new copy from Pencil.')
    records += table.rows.length
    if (records > backupRows) refuse('This archive is too large for the browser checker. Use the restore-test command below.')
  }
  const tables = new Map(payload.tables.map(table => [table.name, table]))
  const indexes = new Map<string, Set<string>>()
  const tuple = (table: BackupTable, columns: string[], row: BackupTable['rows'][number]) => JSON.stringify(columns.map(column => row[table.columns.indexOf(column)]))
  for (const key of manifest.foreignKeys) {
    const source = tables.get(key.from)!, target = tables.get(key.to)!
    const id = JSON.stringify([key.to, key.targetColumns])
    if (!indexes.has(id)) indexes.set(id, new Set(target.rows.map(row => tuple(target,key.targetColumns,row))))
    for (const row of source.rows) {
      if (key.columns.some(column => row[source.columns.indexOf(column)].type === 'null')) continue
      if (!indexes.get(id)!.has(tuple(source,key.columns,row))) refuse('The backup has a missing linked record. Export a new copy before removing your deployment.')
    }
  }
  const summary: BackupSummary = { sha256: archive.sha256, tables: payload.tables.length, records: payload.tables.reduce((sum,table) => sum + table.rows.length,0), checked: 'contents-and-references', restored: false }
  return { archive, summary }
}
