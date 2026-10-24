import { sanitize } from './deployment-data-policy.mjs';
import { erasureFence } from './deployment-data-journal.mjs';
import { initializedPredicate } from './deployment-data-initialized.mjs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { metadata, failure, quote, trustedReferenceMetadata } from './deployment-data-core.mjs';
import { privateArchivePath } from './deployment-data-paths.mjs';
import { schemaQuery } from './deployment-data-sql.mjs';
import { assertLedgerShape, ledgerShapeQuery, sameLedger, validateLedger } from './deployment-data-ledger.mjs';
import { createStore, readStore, storeDigest, storeSummary, validateStore, writeStore } from './deployment-data-stream.mjs';
import { cloudflareClient, primaryQuery } from './deployment-data-provider.mjs';
import { remoteRows } from './deployment-data-page.mjs';
import { canonicalSchema } from './deployment-data-schema.mjs';
import { destinationGuards, stagingPlan, stageRows, cleanupStage } from './deployment-data-staging.mjs';
import { bucketObjects } from './deployment-data-objects.mjs';
import { stageObjects, cleanupObjects, verifyObject } from './deployment-data-object-transfer.mjs';
export { cloudflareClient } from './deployment-data-provider.mjs';

async function bookmark(query) {
  if (typeof query.bookmark !== 'function') throw failure('CONSISTENCY_UNCONFIRMED', 'D1 consistency bookmarks are required for paginated data operations.');
  return query.bookmark();
}
async function captureRemote(query, parent, expected, plan, bucket, archiveHistory) {
  const store = createStore(parent);
  try {
    const before = await bookmark(query);
    const [actual, shape, ...occupancy] = await primaryQuery(query, [
      { sql: schemaQuery }, { sql: ledgerShapeQuery },
      ...expected.tables.map(table=>({sql:`SELECT EXISTS(SELECT 1 FROM ${quote(plan?.names[table.name] ?? table.name)}) AS occupied`})),
    ]);
    const history = assertLedgerShape(shape.results);
    canonicalSchema(actual.results, plan ? JSON.stringify(plan.stagedSchema) : expected.schema);
    store.actualSchema = JSON.stringify(actual.results);
    store.payload = { format: 'runeditrun/pencil-local-data.v1', migrations: metadata(), schema: expected.schema, d1Migrations: { ...history, rows: [] }, tables: expected.tables };
    store.db.exec('BEGIN');
    for (const [index, table] of [history,...expected.tables].entries()) {
      let ordinal = 0;
      if (index > 0) {
        const occupied=occupancy[index-1]?.results[0]?.occupied;
        if(occupied!==0&&occupied!==1)throw failure('PROVIDER_FAILURE','D1 returned an invalid table inventory.');
        if(!occupied)continue;
      }
      for await (const row of remoteRows(query, { ...table, name: plan?.names[table.name] ?? table.name })) {
        if (index === 0) store.payload.d1Migrations.rows.push(row);
        else if (!plan && table.name === 'confirmation_deliveries') {
          // SQL paging already applies column exclusions. Confirmation messages additionally
          // redact edit capabilities inside JSON, just like local and browser snapshots.
          // Staged import verification stays byte-exact: never sanitize staged values.
          for (const safe of sanitize({...table,rows:[row]}).rows) store.add(index - 1, ordinal++, safe);
        } else store.add(index - 1, ordinal++, row);
      }
    }
    store.db.exec('COMMIT');
    store.payload.d1Migrations.rows.sort((left,right)=>JSON.stringify(left)<JSON.stringify(right)?-1:JSON.stringify(left)>JSON.stringify(right)?1:0);
    validateLedger(store.payload.d1Migrations, metadata());
    if (archiveHistory) {
      if (!sameLedger(store.payload.d1Migrations, archiveHistory)) throw failure('MIGRATION_MISMATCH', 'Destination uses a different migration controller.');
      validateLedger(archiveHistory, metadata());
      store.payload.d1Migrations = archiveHistory;
    }
    if (bucket) {
      for await (const object of bucketObjects(bucket)) store.addObject(object);
      if (store.db.prepare('SELECT count(*) n FROM objects').get().n) store.payload.objects = [];
    }
    if (await bookmark(query) !== before) throw failure('SOURCE_CHANGED', 'The deployed database changed during export; no archive was published. Stop writers and export again.');
    store.sha256 = storeDigest(store);
    return store;
  } catch (error) { store.close(); throw error; }
}
// Preserve the bounded in-memory convenience API. File export/import never
// materialize this object; they consume the same validated row iterator.
export async function remoteSnapshot(query, directory = tmpdir(), bucket) {
  privateArchivePath(join(directory,'.pencil-snapshot'));
  const expected = trustedReferenceMetadata(); let store;
  try {
    store = await captureRemote(query,directory,expected,undefined,bucket); validateStore(store);
    return {payload:{...store.payload,tables:store.payload.tables.map((table,index)=>({...table,rows:[...store.rows(index)]})),...(store.payload.objects !== undefined ? {objects:[...store.objects()]} : {})},sha256:store.sha256};
  } finally {store?.close();}
}
export async function exportRemote(output, query = cloudflareClient(), bucket) {
  privateArchivePath(output);
  const expected = trustedReferenceMetadata(); let store;
  try {
    store = await captureRemote(query, dirname(output), expected, undefined, bucket);
    validateStore(store); writeStore(store, output); return storeSummary(store);
  } finally { store?.close(); }
}
export async function importRemote(archivePath, query = cloudflareClient(), journalPath, bucket) {
  privateArchivePath(archivePath);
  const store = readStore(archivePath), expected = trustedReferenceMetadata(store.payload.d1Migrations);
  let plan, prepared = false, published = false, publicationAttempted = false;
  const owned = [];
  try {
    if (store.payload.objects !== undefined && !bucket) throw failure('ATTACHMENT_REQUIRED', 'Set CLOUDFLARE_FORM_ASSETS_BUCKET to the destination FORM_ASSETS bucket. No provider writes were made.');
    if (journalPath) { privateArchivePath(journalPath); const later = readStore(journalPath); try { erasureFence(store, later); } finally { later.close(); } }
    // One read-only preflight preserves the no-write refusal. Preparation
    // repeats all guards atomically before creating any inert staging schema.
    const preflight = await query([{ sql: schemaQuery }, { sql: ledgerShapeQuery }, ...expected.tables.map(table=>{ const expected = initializedPredicate(table); return { sql: `SELECT CASE WHEN (${expected.sql}) THEN 0 ELSE 1 END AS occupied`, params: expected.params }; })]);
    const destinationHistory = assertLedgerShape(preflight[1].results);
    if (!sameLedger(destinationHistory, store.payload.d1Migrations)) throw failure('MIGRATION_MISMATCH', 'Destination uses a different migration controller.'); canonicalSchema(preflight[0].results, expected.schema);
    if (preflight.slice(2).some(result=>result.results[0]?.occupied !== 0)) throw failure('NONEMPTY_TARGET', 'Destination contains application records; nothing was written.');
    if (bucket && (await bucket.list({limit:1})).objects.length) throw failure('NONEMPTY_TARGET', 'Destination FORM_ASSETS contains attachments; nothing was written.');
    plan = stagingPlan(store, expected.trusted);
    await query([...destinationGuards(store, JSON.stringify(preflight[0].results), destinationHistory),...plan.create]);
    prepared = true;
    await stageRows(query, store, plan);
    if (bucket) await stageObjects(store,bucket,owned);
    const staged = await captureRemote(query, store.directory, expected, plan, bucket, store.payload.d1Migrations);
    let stagedSchema;
    try {
      if (staged.sha256 !== store.sha256) throw failure('CONTENT_MISMATCH', 'Staged contents differ from the archive; application records were not published.');
      stagedSchema = staged.actualSchema;
    } finally { staged.close(); }
    publicationAttempted = true;
    await query([...destinationGuards(store, stagedSchema, destinationHistory),...plan.publish]);
    published = true;
    const verified = await captureRemote(query, store.directory, expected, undefined, bucket, store.payload.d1Migrations);
    try { if (verified.sha256 !== store.sha256) throw failure('CONTENT_MISMATCH', 'Destination verification differs; keep the runtime stopped and inspect the target.'); }
    finally { verified.close(); }
    return storeSummary(store);
  } catch (error) {
    if (published) throw failure('RESTORE_VERIFICATION_UNCONFIRMED', 'Installation publication completed, but final verification could not be confirmed. Keep the runtime stopped and re-export to compare with the archive before retrying.');
    if (publicationAttempted && owned.length) throw failure('RESTORE_STATE_UNCONFIRMED', 'Database publication could not be confirmed. Attachments were preserved; keep writers stopped and inspect the database and FORM_ASSETS before recovery.');
    if (plan && (prepared || error.recoveryCode === 'PROVIDER_UNCONFIRMED') && !published) {
      try { await cleanupStage(query, plan); }
      catch { throw failure('RESTORE_STATE_UNCONFIRMED', 'Restore cleanup could not be confirmed. Keep the target stopped; inert restore tables must be inspected before recovery.'); }
    }
    if (bucket) await cleanupObjects(bucket,owned);
    throw error;
  } finally { store.close(); }
}

export async function cleanupRemote(archivePath, query = cloudflareClient(), bucket) {
  privateArchivePath(archivePath);
  const store = readStore(archivePath), expected = trustedReferenceMetadata(store.payload.d1Migrations);
  try {
    if (store.payload.objects !== undefined && !bucket) throw failure('ATTACHMENT_REQUIRED', 'Set CLOUDFLARE_FORM_ASSETS_BUCKET to clean up database and attachment staging together.');
    const [result] = await query([{sql:"SELECT name FROM sqlite_schema WHERE type='table' AND name GLOB '_pencil_restore_*_state'"}]);
    if (result.results.length !== 1 || !/^_pencil_restore_[a-f0-9]{24}_state$/.test(result.results[0].name)) throw failure('RESTORE_STATE_UNCONFIRMED', 'Exactly one recognized staged restore is required for cleanup.');
    const prefix = result.results[0].name.slice(0,-5);
    const plan = stagingPlan(store, expected.trusted, prefix);
    const owned = [];
    if (bucket) for (const object of store.objects()) { if (await bucket.head(object.key)) { await verifyObject(bucket,object); owned.push(object.key); } }
    await cleanupStage(query, plan);
    if (bucket) await cleanupObjects(bucket,owned);
    return { ...storeSummary(store), stagedRestoreRemoved:true };
  } finally { store.close(); }
}
