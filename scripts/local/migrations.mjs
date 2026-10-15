import { execFile } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { promisify } from 'node:util';
import { databasePath } from './state.mjs';

const run = promisify(execFile);

async function pendingMigrations(root, path) {
 const files = (await readdir(join(root, 'migrations', 'core'))).filter(name => name.endsWith('.sql')).sort();
 const db = new DatabaseSync(path, { readOnly: true });
 try {
  const ledger = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='d1_migrations'").get();
  const applied = new Set(ledger ? db.prepare('SELECT name FROM d1_migrations').all().map(row => row.name) : []);
  return files.filter(name => !applied.has(name));
 } finally { db.close(); }
}

// rer dev serves an existing install without its setup step, so a pulled source's new migrations are applied here,
// before the app answers anyone. Returning false makes rer refuse to start with "Run rer setup first".
export async function applyPendingMigrations({ root, demo }) {
 if (demo) return true;
 const path = await databasePath(root);
 if (!path) return true;
 const pending = await pendingMigrations(root, path);
 if (!pending.length) return true;
 process.stderr.write(`Applying ${pending.length} pending migration${pending.length === 1 ? '' : 's'} to this install before serving: ${pending.join(', ')}\n`);
 try {
  await run(process.execPath, [join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js'), 'd1', 'migrations', 'apply', 'DB', '--local', '--persist-to', '.wrangler/state', '--config', 'wrangler.jsonc'],
   { cwd: root, env: { ...process.env, CI: 'true', WRANGLER_SEND_METRICS: 'false' }, maxBuffer: 16 * 1024 * 1024 });
 } catch (error) {
  process.stderr.write(`The pending migrations could not be applied (${String(error.stderr || error.message).trim().split('\n').at(-1)}). Export, then run rer setup.\n`);
  return false;
 }
 return (await pendingMigrations(root, path)).length === 0;
}
