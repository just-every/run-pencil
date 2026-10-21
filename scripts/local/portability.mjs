import { relative } from 'node:path';
import { RerError, refuse } from '@runeditrun/rer/errors';
import { DatabaseSync } from 'node:sqlite';
import { databasePath } from './state.mjs';
import { metadata, readTable } from '../deployment-data-core.mjs';
import { checkedLedger, platformLedger, validateLedger } from '../deployment-data-ledger.mjs';

async function platformSchemaApplied(root) {
 const path = await databasePath(root);
 if (!path) return false;
 const database = new DatabaseSync(path, { readOnly: true });
 try {
  const history = checkedLedger(database);
  if (history !== platformLedger) return false;
  // Platform owns this history. Refuse an incomplete, altered or mixed ledger
  // before Wrangler can create a competing native ledger or replay its SQL.
  validateLedger(readTable(database, history), metadata());
  return true;
 } finally { database.close(); }
}
async function transfer({ root, path, journal, store, signal, operationToken }, direction) {
 if (/^(?:\.wrangler|\.seed|\.rer)(?:\/|$)/.test(relative(root, path)) || /^\.dev\.vars(?:\.|$)/.test(relative(root, path))) throw refuse('Use an archive path outside local data and settings, such as exports/archive.rer.');
 if (direction === 'import') {
  const { readStore } = await import('../deployment-data-stream.mjs');
  // Validate before migrations can create a destination. Restore validates
  // again under the same operation lock before its atomic write transaction.
  let archive;
  try { archive = readStore(path); if (journal) readStore(journal).close(); }
  catch { throw new RerError('invalid_archive', 'Pencil refused the archive before creating a destination. Preserve it and inspect its private source.', 1); }
  finally { archive?.close(); }
 }
 if (!await platformSchemaApplied(root)) await store.run('Applying the current local schema', 'pnpm', ['exec', 'wrangler', 'd1', 'migrations', 'apply', 'DB', '--local', '--persist-to', '.wrangler/state', '--config', 'wrangler.jsonc'], { cwd: root, signal, env: { ...process.env, RER_LOCAL_OPERATION: operationToken, WRANGLER_SEND_METRICS: 'false' } });
 let output = '';
 const child = store.spawn('Moving complete Pencil product data', process.execPath, ['scripts/local/transfer.mjs', direction, path, ...(journal ? [journal] : [])], { cwd: root, signal });
 child.stdout.on('data', bytes => { output += bytes; });
 const code = await new Promise(resolve => child.once('close', resolve));
 let receipt; try { receipt = JSON.parse(output.trim().split('\n').at(-1)); } catch {}
 // The later archive's erasure checkpoint refuses an older archive whole (rer import --journal).
 if (['ERASURE_EPOCH', 'LATER_JOURNAL'].includes(receipt?.reason)) throw new RerError('restore_refused', receipt.reason === 'ERASURE_EPOCH' ? 'Restore refused (erasure_epoch): the archive was made before a later erasure, so restoring it would bring erased data back. Restore the later archive instead.' : 'Restore refused (later_journal): the --journal archive is not a later archive of this installation.', 4);
 if (code !== 0 || !receipt?.ok) throw new RerError('transfer_failed', 'Pencil refused the transfer. Preserve the archive and restore only into an empty destination; inspect the private command capture.', 1);
 if (direction === 'import' && !journal) console.log('After restoring an older archive, erase those people again and record their opt-outs again, or restore it with --journal and a later archive to refuse it if anything was erased since.');
 delete receipt.ok;
 return { target: 'local', ...receipt };
}
export const portability = { export: context => transfer(context, 'export'), import: context => transfer(context, 'import') };
