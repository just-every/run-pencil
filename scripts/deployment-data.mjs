import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { closeSync, linkSync, lstatSync, mkdtempSync, openSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { z } from 'zod';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const hash = value => createHash('sha256').update(value).digest('hex');
const failure = (code, message) => Object.assign(new Error(message), { recoveryCode: code });
const quote = name => `"${name.replaceAll('"', '""')}"`;
const cell = z.discriminatedUnion('type', [
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
const archiveSchema = z.object({ payload: payloadSchema, sha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict();

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

function metadata() { return migrations().map(({ name, sql }) => ({ name, sha256: hash(sql) })); }
function schema(database) {
  return JSON.stringify(database.prepare("SELECT type, name, tbl_name, sql FROM sqlite_schema WHERE sql IS NOT NULL AND name NOT GLOB 'sqlite_*' AND name != '_cf_METADATA' AND name != 'd1_migrations' ORDER BY type, name").all());
}
function inventory(database) {
  return database.prepare("SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT GLOB 'sqlite_*' AND name != '_cf_METADATA' AND name != 'd1_migrations' ORDER BY name").all().map(({ name }) => ({ name, columns: database.prepare(`PRAGMA table_xinfo(${quote(name)})`).all().filter(column => column.hidden === 0).map(column => column.name) }));
}
function encode(value) {
  if (value === null) return { type: 'null' };
  if (typeof value === 'bigint') return { type: 'integer', value: value.toString() };
  if (typeof value === 'number' && Number.isFinite(value)) return { type: 'real', value };
  if (typeof value === 'string') return { type: 'text', value };
  if (value instanceof Uint8Array) return { type: 'blob', value: Buffer.from(value).toString('base64') };
  throw failure('UNSUPPORTED_VALUE', 'Unsupported SQLite value in deployment data.');
}
function decode(value) {
  if (value.type === 'null') return null;
  if (value.type === 'integer') {
    const number = BigInt(value.value);
    if (number < -(1n << 63n) || number > (1n << 63n) - 1n) throw failure('INVALID_VALUE', 'Integer exceeds SQLite range.');
    return number;
  }
  if (value.type === 'blob') return Buffer.from(value.value, 'base64');
  return value.value;
}
function readTable(database, table) {
  const statement = database.prepare(`SELECT ${table.columns.map(quote).join(',')} FROM ${quote(table.name)}`);
  statement.setReadBigInts(true);
  const rows = statement.all().map(row => table.columns.map(name => encode(row[name])));
  rows.sort((a, b) => { const left = JSON.stringify(a), right = JSON.stringify(b); return left < right ? -1 : left > right ? 1 : 0; });
  return { ...table, rows };
}

function populate(database, archive) {
  database.exec('PRAGMA foreign_keys = OFF; BEGIN IMMEDIATE; DELETE FROM d1_migrations');
  try {
    const triggers = database.prepare("SELECT name,sql FROM sqlite_schema WHERE type='trigger'").all();
    for (const trigger of triggers) database.exec(`DROP TRIGGER ${quote(trigger.name)}`);
    for (const table of [archive.payload.d1Migrations, ...archive.payload.tables]) {
      const insert = database.prepare(`INSERT INTO ${quote(table.name)} (${table.columns.map(quote).join(',')}) VALUES (${table.columns.map(() => '?').join(',')})`);
      for (const row of table.rows) insert.run(...row.map(decode));
    }
    for (const trigger of triggers) database.exec(trigger.sql);
    integrity(database);
    database.exec('COMMIT; PRAGMA foreign_keys = ON');
  } catch (error) { database.exec('ROLLBACK'); throw error; }
}

function integrity(database) {
  if (database.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok' || database.prepare('PRAGMA foreign_key_check').all().length) throw failure('INTEGRITY_FAILURE', 'Database integrity or foreign-key check failed.');
}
export function snapshot(database) {
  database.exec('BEGIN');
  try {
    integrity(database);
    const tables = inventory(database).map(table => readTable(database, table));
    const d1Migrations = readTable(database, { name: 'd1_migrations', columns: ['id', 'name', 'applied_at'] });
    const payload = { format: 'runeditrun/pencil-local-data.v1', migrations: metadata(), schema: schema(database), d1Migrations, tables };
    database.exec('COMMIT');
    return { payload, sha256: hash(JSON.stringify(payload)) };
  } catch (error) { database.exec('ROLLBACK'); throw error; }
}

function validate(archive) {
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
    populate(expected, parsed);
    if (snapshot(expected).sha256 !== parsed.sha256) throw failure('CONTENT_MISMATCH', 'Archive values do not round-trip through the committed schema.');
    return parsed;
  } finally { expected.close(); }
}

export function exportData(source, output) {
  const database = new DatabaseSync(source, { readOnly: true });
  try {
    const archive = validate(snapshot(database));
    writeFileSync(output, JSON.stringify(archive) + '\n', { flag: 'wx', mode: 0o600 });
    return summary(archive);
  } finally { database.close(); }
}

export function importData(archivePath, target) {
  const archive = validate(JSON.parse(readFileSync(archivePath, 'utf8')));
  // Fully verify before creating anything. A private staged database is published
  // with an atomic exclusive hard link only after its contents have been checked.
  try {
    lstatSync(target);
    const error = new Error('Target already exists.'); error.code = 'EEXIST'; throw error;
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const staging = mkdtempSync(join(dirname(target), '.pencil-restore-'));
  const temporary = join(staging, 'database.sqlite');
  closeSync(openSync(temporary, 'wx', 0o600));
  let database;
  try {
    database = new DatabaseSync(temporary);
    initialize(database);
    populate(database, archive);
    if (snapshot(database).sha256 !== archive.sha256) throw failure('CONTENT_MISMATCH', 'Restored contents differ from the archive.');
    database.close(); database = undefined;
    linkSync(temporary, target);
    return summary(archive);
  } finally {
    database?.close();
    rmSync(staging, { recursive: true });
  }
}

function summary(archive) {
  return { format: archive.payload.format, sha256: archive.sha256, tables: archive.payload.tables.length, records: archive.payload.tables.reduce((total, table) => total + table.rows.length, 0), effectsDispatched: false };
}

export function main(args) {
  const [command, ...options] = args.filter(value => value !== '--');
  if (options.length !== 4 || !['export', 'import'].includes(command)) throw failure('USAGE', 'Use export --database SOURCE.sqlite --output ARCHIVE.json or import --archive ARCHIVE.json --database NEW.sqlite');
  const values = new Map();
  for (let index = 0; index < options.length; index += 2) {
    if (!options[index + 1] || values.has(options[index])) throw failure('USAGE', 'Missing or duplicate argument.');
    values.set(options[index], resolve(options[index + 1]));
  }
  const expected = command === 'export' ? ['--database', '--output'] : ['--archive', '--database'];
  if ([...values.keys()].some(key => !expected.includes(key))) throw failure('USAGE', 'Unknown argument.');
  const result = command === 'export' ? exportData(values.get('--database'), values.get('--output')) : importData(values.get('--archive'), values.get('--database'));
  process.stdout.write(JSON.stringify(result) + '\n');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { main(process.argv.slice(2)); } catch (error) {
    // SQLite errors can include row values. Never print data or credentials.
    const system = { EEXIST: 'Output path already exists.', ENOENT: 'Input file or output parent directory is missing.', EACCES: 'Filesystem access is denied.', EPERM: 'Filesystem access is denied.' };
    const code = error.recoveryCode ?? (error instanceof z.ZodError || error instanceof SyntaxError ? 'INVALID_ARCHIVE' : error.code in system ? error.code : 'VALIDATION_FAILURE');
    const message = error.recoveryCode ? error.message : code === 'INVALID_ARCHIVE' ? 'Archive format is invalid.' : system[code] ?? 'Database constraints or archive compatibility could not be verified.';
    process.stderr.write(`Pencil local data operation failed [${code}]: ${message} No existing target was overwritten.\n`);
    process.exitCode = 1;
  }
}
