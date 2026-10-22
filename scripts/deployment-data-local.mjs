import { DatabaseSync } from 'node:sqlite';
import { linkSync, lstatSync, copyFileSync, constants, mkdtempSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { assertEmpty } from './deployment-data-core.mjs';
import { captureStore, readStore, validateStore, populateStore, writeStore, storeSummary } from './deployment-data-stream.mjs';
import { privateArchivePath } from './deployment-data-paths.mjs';
import { erasureFence } from './deployment-data-journal.mjs';

export function exportData(source, output) {
  privateArchivePath(output);
  const database = new DatabaseSync(source, { readOnly: true });
  let store;
  try {
    store = captureStore(database, dirname(output));
    validateStore(store);
    writeStore(store, output);
    return storeSummary(store);
  } finally { store?.close(); database.close(); }
}
export function importData(archivePath, target) {
  privateArchivePath(archivePath);
  const store = readStore(archivePath);
  let staging;
  try {
    if (store.payload.objects !== undefined) throw Error('This archive includes FORM_ASSETS. Use rer import to restore the database and attachments together.');
    // The verified private database is published exclusively. A concurrent
    // creator is never replaced, and a malformed archive never opens target.
    staging = mkdtempSync(join(dirname(target), '.pencil-restore-'));
    const staged = join(staging, 'database.sqlite');
    copyFileSync(store.validated, staged, constants.COPYFILE_EXCL);
    linkSync(staged, target);
    return storeSummary(store);
  } finally { if (staging) rmSync(staging, { recursive:true }); store.close(); }
}
export function restoreData(archivePath, target, journalPath) {
  privateArchivePath(archivePath);
  if (journalPath) privateArchivePath(journalPath);
  const store = readStore(archivePath);
  let database;
  try {
    if (store.payload.objects !== undefined) throw Error('This archive includes FORM_ASSETS. Use rer import to restore the database and attachments together.');
    if (journalPath) { const later = readStore(journalPath); try { erasureFence(store, later); } finally { later.close(); } }
    lstatSync(target);
    database = new DatabaseSync(target);
    database.exec('PRAGMA foreign_keys=OFF; BEGIN IMMEDIATE');
    assertEmpty(database, { payload: store.payload });
    populateStore(database, store);
    database.exec('COMMIT; PRAGMA foreign_keys=ON');
    return storeSummary(store);
  } catch (error) { if (database?.isTransaction) database.exec('ROLLBACK'); throw error; }
  finally { database?.close(); store.close(); }
}
