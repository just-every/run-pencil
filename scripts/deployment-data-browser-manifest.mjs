import { DatabaseSync } from 'node:sqlite';
import { initialize, inventory, metadata, schema, quote } from './deployment-data-core.mjs';
import { classify } from './deployment-data-policy.mjs';

export function createBackupManifest() {
  const db = new DatabaseSync(':memory:');
  try {
    initialize(db);
    const tables = inventory(db);
    tables.forEach(classify);
    const keys = Object.fromEntries(tables.map(table => [table.name, db.prepare(`PRAGMA table_info(${quote(table.name)})`).all().filter(column => column.pk).sort((a,b) => a.pk-b.pk).map(column => column.name)]));
    return { schema: schema(db), migrations: metadata(), tables,
      foreignKeys: tables.flatMap(table => {
        const grouped = new Map();
        for (const row of db.prepare(`PRAGMA foreign_key_list(${quote(table.name)})`).all()) {
          if (!grouped.has(row.id)) grouped.set(row.id, []);
          grouped.get(row.id).push(row);
        }
        return [...grouped.values()].map(rows => {
          rows.sort((a,b) => a.seq-b.seq);
          return { from: table.name, to: rows[0].table, columns: rows.map(row => row.from), targetColumns: rows.map((row,index) => row.to ?? keys[row.table][index]) };
        });
      }),
    };
  } finally { db.close(); }
}

// SQLite and migration source remain in the build process; the Worker receives
// only trusted data. A changed migration always rebuilds this manifest.
export function backupManifest() {
  const name = 'virtual:pencil-backup-manifest', resolved = '\0' + name;
  return {
    name: 'pencil-backup-manifest',
    resolveId(id) { if (id === name) return resolved; },
    load(id) {
      if (id !== resolved) return;
      return `export default ${JSON.stringify(createBackupManifest())};`;
    },
    handleHotUpdate(context) {
      if (!/\/migrations\/core\/.*\.sql$/.test(context.file)) return;
      const module = context.server.moduleGraph.getModuleById(resolved);
      if (module) context.server.moduleGraph.invalidateModule(module);
    },
  };
}
