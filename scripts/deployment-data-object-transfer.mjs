import { DatabaseSync } from 'node:sqlite';
import { dirname } from 'node:path';
import { assertEmpty, failure } from './deployment-data-core.mjs';
import { captureStore, populateStore, readStore, storeDigest, storeSummary, validateStore, writeStore } from './deployment-data-stream.mjs';
import { privateArchivePath } from './deployment-data-paths.mjs';
import { erasureFence } from './deployment-data-journal.mjs';
import { bucketObjects, checkObject } from './deployment-data-objects.mjs';

export async function exportWithObjects(source, output, bucket) {
  privateArchivePath(output);
  const database = new DatabaseSync(source, { readOnly: true });
  let store;
  try {
    store = captureStore(database, dirname(output));
    for await (const object of bucketObjects(bucket)) store.addObject(object);
    if (store.db.prepare('SELECT count(*) n FROM objects').get().n) store.payload.objects = [];
    store.sha256 = storeDigest(store);
    validateStore(store); writeStore(store, output);
    return storeSummary(store);
  } finally { store?.close(); database.close(); }
}
async function verify(bucket, object) {
  const read = await bucket.get(object.key);
  if (!read || read.httpMetadata?.contentType !== object.mime || ['workspaceId','flowId','mime'].some(name => read.customMetadata?.[name] !== object.customMetadata[name])) throw failure('ATTACHMENT_VERIFICATION', 'Restored attachment metadata differs from the archive.');
  const bytes = new Uint8Array(await read.arrayBuffer()), expected = await checkObject(object);
  if (bytes.length !== expected.length || bytes.some((value,index) => value !== expected[index])) throw failure('ATTACHMENT_VERIFICATION', 'Restored attachment bytes differ from the archive.');
}
export async function restoreWithObjects(archivePath, target, bucket, journalPath) {
  privateArchivePath(archivePath);
  const store = readStore(archivePath);
  let database, committed = false;
  const owned = [];
  try {
    if (journalPath) {
      privateArchivePath(journalPath); const later = readStore(journalPath);
      try { erasureFence(store, later); } finally { later.close(); }
    }
    if (!bucket) throw failure('ATTACHMENT_REQUIRED', 'FORM_ASSETS is required for complete restoration.');
    if ((await bucket.list({limit:1})).objects.length) throw failure('NONEMPTY_TARGET', 'Destination FORM_ASSETS contains attachments; nothing was written.');
    database = new DatabaseSync(target);
    database.exec('PRAGMA foreign_keys=OFF; BEGIN IMMEDIATE');
    assertEmpty(database, store);
    for (const object of store.objects()) {
      const bytes = await checkObject(object);
      owned.push(object.key);
      const stored = await bucket.put(object.key,bytes,{onlyIf:{etagDoesNotMatch:'*'},httpMetadata:{contentType:object.mime},customMetadata:object.customMetadata});
      if (!stored) throw failure('NONEMPTY_TARGET', 'An attachment appeared during restoration.');
      await verify(bucket,object);
    }
    populateStore(database,store);
    database.exec('COMMIT; PRAGMA foreign_keys=ON'); committed = true;
    return storeSummary(store);
  } catch (error) {
    if (database?.isTransaction) database.exec('ROLLBACK');
    if (!committed) {
      try {
        for (const key of owned) { await bucket.delete(key); if (await bucket.head(key)) throw Error('Attachment cleanup unconfirmed'); }
      } catch { throw failure('RESTORE_STATE_UNCONFIRMED', 'Attachment cleanup could not be confirmed. Preserve the archive and inspect FORM_ASSETS before recovery.'); }
    }
    throw error;
  } finally { database?.close(); store.close(); }
}
