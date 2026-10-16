import { parseArgs } from 'node:util';
import { resolve, dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdtempSync, rmSync } from 'node:fs';
import { importData, exportData } from './deployment-data-local.mjs';
import { readStore } from './deployment-data-stream.mjs';
import { privateArchivePath } from './deployment-data-paths.mjs';
import { erasureFence } from './deployment-data-journal.mjs';
import { failure } from './deployment-data-errors.mjs';

// Hosted and local archives intentionally keep their own migration controller.
// importData creates a brand-new SQLite database from the validated archive's
// exact history. No local rer migration ledger is substituted or rewritten.
export function testRestore(args) {
  const { values, positionals } = parseArgs({args, allowPositionals:true, options:{input:{type:'string'},output:{type:'string'},journal:{type:'string'}}});
  if (positionals.length || !values.input || !values.output) throw failure('USAGE','Use --input BACKUP.rer --output NEW-DATABASE.sqlite [--journal LATER.rer]. The output file must not exist.');
  const input = privateArchivePath(resolve(values.input)), output = privateArchivePath(resolve(values.output));
  if (values.journal) {
    const original = readStore(input); let later;
    try { later = readStore(privateArchivePath(resolve(values.journal))); erasureFence(original,later); }
    finally { original.close(); later?.close(); }
  }
  const restored = importData(input,output);
  const directory = mkdtempSync(join(dirname(output),'.pencil-restore-test-'));
  try {
    const exported = exportData(output,join(directory,'check.rer'));
    if (restored.sha256 !== exported.sha256) throw failure('CONTENT_MISMATCH','Restored data did not re-export with the original checksum. Keep the original deployment.');
    return {ok:true, restored:true, ...restored, reexportSha256:exported.sha256, database:output, hostedDeploymentReplaced:false};
  } finally { rmSync(directory,{recursive:true}); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { console.log(JSON.stringify(testRestore(process.argv.slice(2)))); }
  catch (error) { console.error(`[${error.recoveryCode ?? error.code ?? 'RESTORE_TEST_FAILED'}] ${error.recoveryCode || error.code === 'EEXIST' ? error.message : 'The restore test failed. Keep the original deployment and check that source version and dependencies match the archive.'}`); process.exitCode = 1; }
}
