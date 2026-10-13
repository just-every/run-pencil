import { databasePath } from './state.mjs';
import { exportData, restoreData } from '../deployment-data-local.mjs';
try {
 const [direction, path] = process.argv.slice(2);
 if (!['export', 'import'].includes(direction) || !path) throw Error('Invalid transfer arguments');
 const database = await databasePath(process.cwd());
 if (!database) throw Error('Local database is missing');
 const result = direction === 'export' ? exportData(database, path) : restoreData(path, database);
 console.log(JSON.stringify({ ok: true, ...result }));
} catch (error) {
 console.log(JSON.stringify({ ok: false, reason: /^[A-Z_]+$/.test(error.recoveryCode ?? '') ? error.recoveryCode : 'TRANSFER_FAILED' }));
 process.exitCode = 1;
}
