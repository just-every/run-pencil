import { assertInitialized, initializedReplacement } from './deployment-data-initialized.mjs';
import { DatabaseSync } from 'node:sqlite';
import { rowExpression } from './deployment-data-sql.mjs';
import { tableRows, readCells } from './deployment-data-values.mjs';
import { createHash } from 'node:crypto';
import { closeSync, openSync, mkdtempSync, rmSync, writeSync, fsyncSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { archiveSchema, canonicalDatabaseSchema, cell, decode, failure, initialize, integrity, inventory, keptHistory, metadata, quote, readTable, schema, trustedReferenceMetadata } from './deployment-data-core.mjs';
import { checkedLedger, keepsHistory, validateLedger } from './deployment-data-ledger.mjs';
import { classify, sanitize, rowsNeverTravel, refuseAuthorization } from './deployment-data-policy.mjs';
import { refuseDevRows } from './deployment-data-dev.mjs';
import { readArchiveJSON } from './deployment-data-json.mjs';
import { objectBytes, objectReferences } from './deployment-data-objects.mjs';

export function privateDatabase(path) {
  closeSync(openSync(path, 'wx', 0o600));
  const db = new DatabaseSync(path);
  db.exec('PRAGMA cache_size=-4096; PRAGMA temp_store=FILE');
  return db;
}
export function createStore(parent) {
  const directory = mkdtempSync(join(parent, '.pencil-restore-'));
  let db;
  try {
    db = privateDatabase(join(directory, 'rows.sqlite'));
    db.exec('CREATE TABLE rows(table_number INTEGER NOT NULL, ordinal INTEGER NOT NULL, cells TEXT NOT NULL, sort_key BLOB NOT NULL, PRIMARY KEY(table_number,sort_key,ordinal)) WITHOUT ROWID');
    db.exec('CREATE TABLE objects(key TEXT PRIMARY KEY, value TEXT NOT NULL) WITHOUT ROWID');
    const insert = db.prepare('INSERT INTO rows VALUES(?,?,?,?)');
    return {
      directory, db,
      add(table, ordinal, row, cells = JSON.stringify(row)) {
        const key = Buffer.from(cells, 'utf16le'); key.swap16();
        insert.run(table, ordinal, cells, key);
      },
      *strings(table) {
        for (const row of db.prepare('SELECT cells FROM rows WHERE table_number=? ORDER BY sort_key,ordinal').iterate(table)) yield row.cells;
      },
      *rows(table) { for (const value of this.strings(table)) yield JSON.parse(value); },
      addObject(object) {
        const bytes = objectBytes(object);
        if (!object.key.endsWith('/' + createHash('sha256').update(object.mime + '\0').update(bytes).digest('hex'))) throw failure('CONTENT_MISMATCH', 'Archive attachment checksum mismatch.');
        // Canonical field order is shared by the Worker and local exporter.
        const canonical = {bucket:object.bucket,key:object.key,mime:object.mime,customMetadata:{workspaceId:object.customMetadata.workspaceId,flowId:object.customMetadata.flowId,mime:object.mime},data:object.data};
        db.prepare('INSERT INTO objects VALUES(?,?)').run(object.key, JSON.stringify(canonical));
      },
      *objects() { for (const row of db.prepare('SELECT value FROM objects ORDER BY key').iterate()) yield JSON.parse(row.value); },
      close() { db.close(); rmSync(directory, { recursive: true }); },
    };
  } catch (error) { db?.close(); rmSync(directory, { recursive: true }); throw error; }
}
function tableParts(table, rows, emit) {
  emit(`{"name":${JSON.stringify(table.name)},"columns":${JSON.stringify(table.columns)},"rows":[`);
  let first = true;
  for (const row of rows) { if (!first) emit(','); emit(row); first = false; }
  emit(']}');
}
export function payloadParts(store, emit) {
  const p = store.payload;
  emit(`{"format":${JSON.stringify(p.format)},"migrations":${JSON.stringify(p.migrations)},"schema":${JSON.stringify(p.schema)},"d1Migrations":${JSON.stringify(p.d1Migrations)},"tables":[`);
  p.tables.forEach((table, index) => { if (index) emit(','); tableParts(table, store.strings(index), emit); });
  emit(']');
  if (p.objects !== undefined) {
    emit(',"objects":['); let first = true;
    for (const object of store.objects()) { if (!first) emit(','); emit(JSON.stringify(object)); first = false; }
    emit(']');
  }
  emit('}');
}
export function storeDigest(store) {
  const digest = createHash('sha256'); payloadParts(store, part => digest.update(part)); return digest.digest('hex');
}
export function storeSummary(store) {
  return { format: store.payload.format, sha256: store.sha256, tables: store.payload.tables.length, records: store.db.prepare('SELECT count(*) n FROM rows').get().n, effectsDispatched: false };
}
export function writeStore(store, output) {
  const fd = openSync(output, 'wx', 0o600);
  try {
    // Buffer only a small prefix; writeSync may perform a partial write.
    let pending = '';
    const flush = () => { const bytes = Buffer.from(pending); for (let offset = 0; offset < bytes.length;) offset += writeSync(fd, bytes, offset, bytes.length - offset); pending = ''; };
    const emit = part => { pending += part; if (pending.length >= 65536) flush(); };
    emit('{"payload":'); payloadParts(store, emit); emit(`,"sha256":${JSON.stringify(store.sha256)}}\n`); flush(); fsyncSync(fd);
  } catch (error) { closeSync(fd); rmSync(output); throw error; }
  closeSync(fd);
}
export function captureStore(database, parent) {
  const store = createStore(parent);
  database.exec('BEGIN'); store.db.exec('BEGIN');
  try {
    const ledger = checkedLedger(database); integrity(database);
    const tables = inventory(database); tables.forEach(classify);
    store.payload = { format: 'runeditrun/pencil-local-data.v1', migrations: metadata(), schema: canonicalDatabaseSchema(database), d1Migrations: readTable(database, ledger), tables };
    tables.forEach((table, index) => {
      if (rowsNeverTravel(table.name)) return;
      let ordinal = 0;
      for (const value of tableRows(database, table)) {
        const rows = sanitize({ ...table, rows: [value] }).rows;
        for (const row of rows) store.add(index, ordinal++, row);
      }
    });
    database.exec('COMMIT'); store.db.exec('COMMIT');
    store.sha256 = storeDigest(store);
    return store;
  } catch (error) { if (database.isTransaction) database.exec('ROLLBACK'); store.close(); throw error; }
}
function checkHeader(store, expected) {
  const p = store.payload;
  if (JSON.stringify(p.migrations) !== JSON.stringify(metadata())) throw failure('MIGRATION_MISMATCH', 'Archive requires a different committed migration history.');
  if (p.schema !== schema(expected)) throw failure('SCHEMA_MISMATCH', 'Archive schema differs from the committed Pencil schema.');
  if (JSON.stringify(p.tables.map(({ name, columns }) => ({ name, columns }))) !== JSON.stringify(inventory(expected))) throw failure('INVENTORY_MISMATCH', 'Archive table/column inventory differs from the committed Pencil schema.');
  const ledger = p.d1Migrations;
  validateLedger(ledger, metadata());
  if (ledger.rows.some((row,index)=>index>0&&JSON.stringify(ledger.rows[index-1])>JSON.stringify(row))) throw failure('CONTENT_MISMATCH', 'Archive migration rows are not in canonical order.');
  p.tables.forEach(classify);
}
export function populateStore(database, store) {
  assertInitialized(database, inventory(database));
  const triggers = database.prepare("SELECT name,sql FROM sqlite_schema WHERE type='trigger'").all();
  for (const trigger of triggers) database.exec(`DROP TRIGGER ${quote(trigger.name)}`);
  const kept = keepsHistory(store.payload.d1Migrations);
  if (kept) keptHistory(database, checkedLedger(database), store);
  else database.exec(`DELETE FROM ${quote(store.payload.d1Migrations.name)}`);
  for (const statement of initializedReplacement(store.payload.tables)) database.exec(statement.sql);
  for (const [index, table] of [store.payload.d1Migrations, ...store.payload.tables].entries()) {
    if (kept && index === 0) continue;
    const insert = database.prepare(`INSERT INTO ${quote(table.name)} (${table.columns.map(quote).join(',')}) VALUES (${table.columns.map(() => '?').join(',')}) RETURNING ${rowExpression(table)} AS cells`);
    for (const row of index === 0 ? table.rows : store.rows(index - 1)) {
      if (row.length !== table.columns.length) throw failure('INVALID_ROW', 'Archive row width differs from its table.');
      if (index) { refuseAuthorization(table, [row]); refuseDevRows(table, [row]); }
      if (index && JSON.stringify(sanitize({ ...table, rows: [row] }).rows) !== JSON.stringify([row])) throw failure('PRIVATE_CREDENTIAL', 'Archive contains excluded plaintext credentials.');
      const stored = insert.get(...row.map(decode));
      if (JSON.stringify(readCells(stored.cells)) !== JSON.stringify(row)) throw failure('CONTENT_MISMATCH', 'Archive values do not round-trip through the committed schema.');
    }
  }
  for (const trigger of triggers) database.exec(trigger.sql);
  integrity(database);
}
export function validateStore(store) {
  const path = join(store.directory, 'validated.sqlite'), database = privateDatabase(path);
  try {
    requireStoreObjects(store);
    initialize(database, store.payload.d1Migrations); checkHeader(store, database);
    database.exec('PRAGMA foreign_keys=OFF; BEGIN IMMEDIATE');
    populateStore(database, store); database.exec('COMMIT');
    // Every INSERT returns its actual typed storage values. Together with
    // canonical row ordering and the integrity check, equality proves a full
    // roundtrip without retaining or sorting a second copy of all records.
    return path;
  } finally { database.close(); }
}
export function readStore(path) {
  const store = createStore(dirname(path)); store.db.exec('BEGIN');
  try {
    const reference = trustedReferenceMetadata();
    const limits = {migrations:reference.migrations.length,columns:reference.tables.map(table=>table.columns.length)};
    let previousTable = -1, previousRow;
    let previousObject;
    const parsed = archiveSchema.parse(readArchiveJSON(path, (table, ordinal, row) => {
      if (!Array.isArray(row)) throw failure('INVALID_ROW', 'Archive row must be an array.');
      const checked = row.map(value => cell.parse(value)), serialized = JSON.stringify(checked);
      if (previousTable === table && previousRow > serialized) throw failure('CONTENT_MISMATCH', 'Archive rows are not in canonical order.');
      previousTable = table; previousRow = serialized; store.add(table, ordinal, checked, serialized);
    }, limits, object => {
      if (previousObject !== undefined && previousObject >= object.key) throw failure('CONTENT_MISMATCH', 'Archive attachments are not in canonical order.');
      store.addObject(object); previousObject = object.key;
    }));
    store.payload = parsed.payload; store.sha256 = parsed.sha256;
    if (store.payload.objects !== undefined && !store.db.prepare('SELECT count(*) n FROM objects').get().n) throw failure('CONTENT_MISMATCH', 'An empty attachment inventory must be omitted.');
    store.db.exec('COMMIT');
    if (storeDigest(store) !== store.sha256) throw failure('CONTENT_MISMATCH', 'Archive content digest mismatch.');
    store.validated = validateStore(store);
    return store;
  } catch (error) { store.close(); throw error; }
}

export function requireStoreObjects(store) {
  for (const [index,table] of store.payload.tables.entries()) for (const reference of objectReferences(table, store.rows(index))) {
    const found = store.db.prepare('SELECT value FROM objects WHERE key=?').get(reference.key);
    if (!found || JSON.parse(found.value).mime !== reference.mime) throw failure('ATTACHMENT_REQUIRED', 'Backup is missing a referenced form image. Export with FORM_ASSETS before removing the deployment.');
  }
}
