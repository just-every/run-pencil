import { assertInitialized, initializedReplacement } from './deployment-data-initialized.mjs';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { classify, sanitize } from './deployment-data-policy.mjs';
import { refuseDevRows } from './deployment-data-dev.mjs';
import { checkedLedger } from './deployment-data-ledger.mjs';
import { failure } from './deployment-data-errors.mjs';
import { canonicalSchema } from './deployment-data-schema.mjs';
import { tableRows } from './deployment-data-values.mjs';
export { failure } from './deployment-data-errors.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const hash = value => createHash('sha256').update(value).digest('hex');
export const quote = name => `"${name.replaceAll('"', '""')}"`;
export const cell = z.discriminatedUnion('type', [
  z.object({ type: z.literal('null') }).strict(),
  z.object({ type: z.literal('integer'), value: z.string().regex(/^-?(?:0|[1-9]\d*)$/) }).strict(),
  z.object({ type: z.literal('real'), value: z.number().finite() }).strict(),
  z.object({ type: z.literal('text'), value: z.string() }).strict(),
  z.object({ type: z.literal('blob'), value: z.string().regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/) }).strict(),
]);
const tableSchema = z.object({ name: z.string(), columns: z.array(z.string()), rows: z.array(z.array(cell)) }).strict();
const payloadSchema = z.object({
  format: z.literal('runeditrun/pencil-local-data.v1'),
  migrations: z.array(z.object({ name: z.string(), sha256: z.string() }).strict()),
  schema: z.string(),
  d1Migrations: tableSchema,
  tables: z.array(tableSchema),
}).strict();
export const archiveSchema = z.object({ payload: payloadSchema, sha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict();

export function migrations() {
  const directory = join(root, 'migrations/core');
  return readdirSync(directory).filter(name => name.endsWith('.sql')).sort().map(name => ({ name, sql: readFileSync(join(directory, name), 'utf8') }));
}

export function initialize(database) {
  database.exec('CREATE TABLE d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL)');
  for (const migration of migrations()) {
    database.exec(migration.sql);
    database.prepare('INSERT INTO d1_migrations (name) VALUES (?)').run(migration.name);
  }
}

export function metadata() { return migrations().map(({ name, sql }) => ({ name, sha256: hash(sql) })); }
export function schema(database) {
  return JSON.stringify(database.prepare("SELECT type, name, tbl_name, sql FROM sqlite_schema WHERE sql IS NOT NULL AND name NOT GLOB 'sqlite_*' AND name != '_cf_METADATA' AND name != 'd1_migrations' ORDER BY type, name").all());
}
export function canonicalDatabaseSchema(database) {
  const expected = new DatabaseSync(':memory:');
  try { initialize(expected); return canonicalSchema(JSON.parse(schema(database)), schema(expected)); }
  finally { expected.close(); }
}
export function inventory(database) {
  return database.prepare("SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT GLOB 'sqlite_*' AND name != '_cf_METADATA' AND name != 'd1_migrations' ORDER BY name").all().map(({ name }) => ({ name, columns: database.prepare(`PRAGMA table_xinfo(${quote(name)})`).all().filter(column => column.hidden === 0).map(column => column.name) }));
}
export function encode(value) {
  if (value === null) return { type: 'null' };
  if (typeof value === 'bigint') return { type: 'integer', value: value.toString() };
  if (typeof value === 'number' && Number.isFinite(value)) return { type: 'real', value };
  if (typeof value === 'string') return { type: 'text', value };
  if (value instanceof Uint8Array) return { type: 'blob', value: Buffer.from(value).toString('base64') };
  throw failure('UNSUPPORTED_VALUE', 'Unsupported SQLite value in deployment data.');
}
export function decode(value) {
  if (value.type === 'null') return null;
  if (value.type === 'integer') {
    const number = BigInt(value.value);
    if (number < -(1n << 63n) || number > (1n << 63n) - 1n) throw failure('INVALID_VALUE', 'Integer exceeds SQLite range.');
    return number;
  }
  if (value.type === 'blob') return Buffer.from(value.value, 'base64');
  return value.value;
}
export function readTable(database, table) {
  const rows = [...tableRows(database, table)];
  rows.sort((a, b) => { const left = JSON.stringify(a), right = JSON.stringify(b); return left < right ? -1 : left > right ? 1 : 0; });
  return { ...table, rows };
}

export function populate(database, archive, { existing = false } = {}) {
  database.exec('PRAGMA foreign_keys = OFF; BEGIN IMMEDIATE');
  try {
    checkedLedger(database);
    if (existing) assertEmpty(database, archive);
    else assertInitialized(database, inventory(database));
    database.exec('DELETE FROM d1_migrations');
    const triggers = database.prepare("SELECT name,sql FROM sqlite_schema WHERE type='trigger'").all();
    for (const trigger of triggers) database.exec(`DROP TRIGGER ${quote(trigger.name)}`);
    for (const statement of initializedReplacement(archive.payload.tables)) database.exec(statement.sql);
    for (const table of [archive.payload.d1Migrations, ...archive.payload.tables]) {
      const insert = database.prepare(`INSERT INTO ${quote(table.name)} (${table.columns.map(quote).join(',')}) VALUES (${table.columns.map(() => '?').join(',')})`);
      for (const row of table.rows) insert.run(...row.map(decode));
    }
    for (const trigger of triggers) database.exec(trigger.sql);
    integrity(database);
    database.exec('COMMIT; PRAGMA foreign_keys = ON');
  } catch (error) { database.exec('ROLLBACK'); throw error; }
}

export function integrity(database) {
  if (database.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok' || database.prepare('PRAGMA foreign_key_check').get()) throw failure('INTEGRITY_FAILURE', 'Database integrity or foreign-key check failed.');
}
export function snapshot(database) {
  database.exec('BEGIN');
  try {
    const ledger = checkedLedger(database);
    integrity(database);
    const tables = inventory(database).map(table => { classify(table); return sanitize(readTable(database, table)); });
    const d1Migrations = readTable(database, ledger);
    const payload = { format: 'runeditrun/pencil-local-data.v1', migrations: metadata(), schema: canonicalDatabaseSchema(database), d1Migrations, tables };
    database.exec('COMMIT');
    return { payload, sha256: hash(JSON.stringify(payload)) };
  } catch (error) { database.exec('ROLLBACK'); throw error; }
}

export function validate(archive) {
  const parsed = archiveSchema.parse(archive);
  if (hash(JSON.stringify(parsed.payload)) !== parsed.sha256) throw failure('CONTENT_MISMATCH', 'Archive content digest mismatch.');
  if (JSON.stringify(parsed.payload.migrations) !== JSON.stringify(metadata())) throw failure('MIGRATION_MISMATCH', 'Archive requires a different committed migration history.');
  const expected = new DatabaseSync(':memory:');
  try {
    initialize(expected);
    if (parsed.payload.schema !== schema(expected)) throw failure('SCHEMA_MISMATCH', 'Archive schema differs from the committed Pencil schema.');
    if (JSON.stringify(parsed.payload.tables.map(({ name, columns }) => ({ name, columns }))) !== JSON.stringify(inventory(expected))) throw failure('INVENTORY_MISMATCH', 'Archive table/column inventory differs from the committed Pencil schema.');
    const ledger = parsed.payload.d1Migrations;
    if (ledger.name !== 'd1_migrations' || JSON.stringify(ledger.columns) !== JSON.stringify(['id', 'name', 'applied_at'])) throw failure('MIGRATION_MISMATCH', 'Invalid D1 migration ledger inventory.');
    const names = ledger.rows.map(row => row[1]?.type === 'text' ? row[1].value : null).sort();
    if (JSON.stringify(names) !== JSON.stringify(metadata().map(entry => entry.name))) throw failure('MIGRATION_MISMATCH', 'D1 migration ledger differs from the committed migration history.');
    for (const table of [ledger, ...parsed.payload.tables]) for (const row of table.rows) {
      if (row.length !== table.columns.length) throw failure('INVALID_ROW', 'Archive row width differs from its table.');
      row.forEach(decode);
    }
    parsed.payload.tables.forEach(table => { classify(table); refuseDevRows(table, table.rows); if (JSON.stringify(sanitize(table)) !== JSON.stringify(table)) throw failure('PRIVATE_CREDENTIAL', 'Archive contains excluded plaintext credentials.'); });
    populate(expected, parsed);
    if (snapshot(expected).sha256 !== parsed.sha256) throw failure('CONTENT_MISMATCH', 'Archive values do not round-trip through the committed schema.');
    return parsed;
  } finally { expected.close(); }
}

export function assertEmpty(database, archive) {
  const ledger = checkedLedger(database);
  if (canonicalDatabaseSchema(database) !== archive.payload.schema) throw failure('SCHEMA_MISMATCH', 'Destination schema differs; apply all migrations first.');
  if (JSON.stringify(readTable(database, ledger).rows.map(row => row[1].value).sort()) !== JSON.stringify(metadata().map(row => row.name))) throw failure('MIGRATION_MISMATCH', 'Destination migration ledger differs.');
  assertInitialized(database, inventory(database));
}
export function summary(archive) {
  return { format: archive.payload.format, sha256: archive.sha256, tables: archive.payload.tables.length, records: archive.payload.tables.reduce((total, table) => total + table.rows.length, 0), effectsDispatched: false };
}
