import { databasePath } from './state.mjs';
import { exportWithObjects, restoreWithObjects } from '../deployment-data-object-transfer.mjs';
import { getPlatformProxy } from 'wrangler';
import { join } from 'node:path';
let proxy;
try {
 const [direction, path, journal] = process.argv.slice(2);
 if (!['export', 'import'].includes(direction) || !path || (journal && direction !== 'import')) throw Error('Invalid transfer arguments');
 const database = await databasePath(process.cwd());
 if (!database) throw Error('Local database is missing');
 proxy = await getPlatformProxy({ configPath: join(process.cwd(),'wrangler.jsonc'), persist: {path:join(process.cwd(),'.wrangler/state/v3')}, remoteBindings: false });
 const bucket = proxy.env.FORM_ASSETS;
 const result = direction === 'export' ? await exportWithObjects(database, path, bucket) : await restoreWithObjects(path, database, bucket, journal);
 console.log(JSON.stringify({ ok: true, ...result }));
} catch (error) {
 console.log(JSON.stringify({ ok: false, reason: /^[A-Z_]+$/.test(error.recoveryCode ?? '') ? error.recoveryCode : 'TRANSFER_FAILED' }));
 process.exitCode = 1;
} finally { await proxy?.dispose(); }
