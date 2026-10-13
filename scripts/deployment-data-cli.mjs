import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { exportRemote, importRemote, cleanupRemote } from './deployment-data-remote.mjs';
import { cloudflareClient } from './deployment-data-provider.mjs';
import { failure } from './deployment-data-errors.mjs';

// This separate owner command uses explicit provider resource IDs. It does not
// infer a deployment from local Wrangler state or change the public rer contract.
export async function recoveryCommand(args, { env = process.env, fetch = globalThis.fetch } = {}) {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, options: {
    output: { type:'string' }, input: { type:'string' }, journal: { type:'string' },
    yes: { type:'boolean' }, 'writers-stopped': { type:'boolean' },
  } });
  const [verb] = positionals;
  if (positionals.length !== 1 || !['export','import','cleanup'].includes(verb)) throw failure('USAGE', 'Use export --output FILE, import --input FILE --yes [--journal FILE], or cleanup --input FILE --yes; all require --writers-stopped.');
  if (!values['writers-stopped']) throw failure('WRITERS_ACTIVE', 'Stop every Worker route, schedule and other database writer, then confirm --writers-stopped.');
  if (verb !== 'export' && !values.yes) throw failure('CONFIRMATION_REQUIRED', 'Restore or cleanup requires --yes.');
  const file = verb === 'export' ? values.output : values.input;
  if (!file || (verb === 'export' && (values.input || values.journal || values.yes)) || (verb !== 'export' && values.output) || (verb === 'cleanup' && values.journal)) throw failure('USAGE', 'Provide only the flags for this recovery operation.');
  const query = cloudflareClient(env, fetch);
  if (verb === 'export') return exportRemote(resolve(file), query);
  if (verb === 'cleanup') return cleanupRemote(resolve(file), query);
  return importRemote(resolve(file), query, values.journal && resolve(values.journal));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { console.log(JSON.stringify(await recoveryCommand(process.argv.slice(2)))); }
  catch (error) { console.error(`[${error.recoveryCode ?? 'RECOVERY_FAILED'}] ${error.recoveryCode ? error.message : 'Recovery failed; keep writers stopped and inspect the target before retrying.'}`); process.exitCode = 1; }
}
