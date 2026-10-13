import { readdir, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { selectLocalState } from '@runeditrun/rer/local/state';
import { privateDirectory } from '@runeditrun/rer/private-files';

export async function databasePath(root) {
 let directory = root;
 for (const part of ['.wrangler', 'state', 'v3', 'd1', 'miniflare-D1DatabaseObject']) {
  directory = join(directory, part);
  const status = await lstat(directory).catch(error => { if (error.code !== 'ENOENT') throw error; });
  if (!status) return;
  if (!status.isDirectory() || status.isSymbolicLink()) throw Error('Unsafe local database placement. Preserve it and recover explicitly.');
 }
 const files = (await readdir(directory, { withFileTypes: true })).filter(file => file.name.endsWith('.sqlite'));
 if (files.some(file => !file.isFile())) throw Error('Unsafe local database placement. Preserve it and recover explicitly.');
 const databases = [];
 for (const file of files) {
  const path = join(directory, file.name), db = new DatabaseSync(path, { readOnly: true });
  try {
   const tables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row => row.name));
   // Miniflare may also persist an unused binding with only its own metadata.
   // It holds no application data and does not establish another installation.
   const applicationTables = [...tables].filter(name => !name.startsWith('_cf_') && !name.startsWith('sqlite_'));
   if (!applicationTables.length) continue;
   if (!tables.has('workspaces') || !tables.has('operators')) throw Error('Unrecognized local database. Preserve it and recover explicitly.');
   databases.push(path);
  } finally { db.close(); }
 }
 if (databases.length > 1) throw Error('Ambiguous local databases. Preserve them and recover explicitly.');
 return databases[0];
}
export async function localOwners(root) {
 const path = await databasePath(root);
 if (!path) return [];
 const db = new DatabaseSync(path, { readOnly: true });
 try {
  const tables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row => row.name));
  const owners = tables.has('oa_operators') ? db.prepare("SELECT email FROM oa_operators WHERE role='owner' AND status='active'").all() : [];
  if (!owners.length && tables.has('operators')) owners.push(...db.prepare('SELECT email FROM operators WHERE is_setup_operator=1').all());
  return [...new Set(owners.map(row => row.email))];
 } finally { db.close(); }
}
export async function prepare({ root }) {
 await selectLocalState(root);
 await databasePath(root);
 await privateDirectory(root, ['.wrangler', 'state']);
}
