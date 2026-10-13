import { relative } from 'node:path';
import { RerError, refuse } from '@runeditrun/rer/errors';
async function transfer({ root, path, store, signal, operationToken }, direction) {
 if (/^(?:\.wrangler|\.seed|\.rer)(?:\/|$)/.test(relative(root, path)) || /^\.dev\.vars(?:\.|$)/.test(relative(root, path))) throw refuse('Use an archive path outside local data and settings, such as exports/archive.rer.');
 if (direction === 'import') {
  const { readStore } = await import('../deployment-data-stream.mjs');
  // Validate before migrations can create a destination. Restore validates
  // again under the same operation lock before its atomic write transaction.
  let archive;
  try { archive = readStore(path); }
  catch { throw new RerError('invalid_archive', 'Pencil refused the archive before creating a destination. Preserve it and inspect its private source.', 1); }
  finally { archive?.close(); }
 }
 await store.run('Applying the current local schema', 'pnpm', ['exec', 'wrangler', 'd1', 'migrations', 'apply', 'DB', '--local', '--persist-to', '.wrangler/state', '--config', 'wrangler.jsonc'], { cwd: root, signal, env: { ...process.env, RER_LOCAL_OPERATION: operationToken, WRANGLER_SEND_METRICS: 'false' } });
 let output = '';
 const child = store.spawn('Moving complete Pencil product data', process.execPath, ['scripts/local/transfer.mjs', direction, path], { cwd: root, signal });
 child.stdout.on('data', bytes => { output += bytes; });
 const code = await new Promise(resolve => child.once('close', resolve));
 let receipt; try { receipt = JSON.parse(output.trim().split('\n').at(-1)); } catch {}
 if (code !== 0 || !receipt?.ok) throw new RerError('transfer_failed', 'Pencil refused the transfer. Preserve the archive and restore only into an empty destination; inspect the private command capture.', 1);
 if (direction === 'import') console.log('After restoring an older archive, erase those people again and record their opt-outs again.');
 delete receipt.ok;
 return { target: 'local', ...receipt };
}
export const portability = { export: context => transfer(context, 'export'), import: context => transfer(context, 'import') };
