import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { exportData, restoreData } from './deployment-data.mjs';
import { initialize, snapshot } from './deployment-data-core.mjs';
import { exportRemote, importRemote } from './deployment-data-remote.mjs';
import { fixture, sqliteTransport } from './deployment-data-test-helpers.mjs';

const driftCases = [
  ['additional stored column', "ALTER TABLE d1_migrations ADD COLUMN owner_metadata TEXT; UPDATE d1_migrations SET owner_metadata='retained migration annotation'"],
  ['additional generated column', "ALTER TABLE d1_migrations ADD COLUMN annotation TEXT GENERATED ALWAYS AS ('retained migration annotation') VIRTUAL"],
  ['renamed column', 'ALTER TABLE d1_migrations RENAME COLUMN applied_at TO installed_at'],
  ['changed column type', `ALTER TABLE d1_migrations RENAME TO previous_migrations;
    CREATE TABLE d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL);
    INSERT INTO d1_migrations SELECT * FROM previous_migrations; DROP TABLE previous_migrations`],
];
const state = db => ({
  schema: db.prepare('SELECT type,name,tbl_name,sql FROM sqlite_schema ORDER BY type,name').all(),
  ledger: db.prepare('SELECT * FROM d1_migrations ORDER BY id').all(),
  records: db.prepare('SELECT count(*) n FROM workspaces').get(),
});
// A renamed required column can make SQLite reject the typed read while
// preparing the single snapshot batch, before its shape result is returned.
const ledgerReadFailure = /migration ledger|no such column/i;

for (const [description, drift] of driftCases) {
  test(`local and REST export refuse migration ledger ${description} without losing its values`, async () => {
    const f = fixture();
    try {
      f.db.exec(drift);
      const before = state(f.db);
      assert.throws(() => snapshot(f.db), /migration ledger/i);
      const remote = join(f.dir, 'remote.json');
      await assert.rejects(() => exportRemote(remote, sqliteTransport(f.db).query), ledgerReadFailure);
      assert.equal(existsSync(remote), false);
      f.db.close();
      assert.throws(() => exportData(f.source, f.archive), /migration ledger/i);
      assert.equal(existsSync(f.archive), false);
      const checked = new DatabaseSync(f.source);
      try { assert.deepEqual(state(checked), before); } finally { checked.close(); }
    } finally { if (f.db.isOpen) f.db.close(); rmSync(f.dir, { recursive: true }); }
  });

  test(`local and REST restore refuse migration ledger ${description} before writes`, async () => {
    const f = fixture(), target = new DatabaseSync(f.target);
    try {
      f.db.close(); exportData(f.source, f.archive); initialize(target); target.exec(drift);
      const before = state(target), transport = sqliteTransport(target);
      await assert.rejects(() => importRemote(f.archive, transport.query), ledgerReadFailure);
      assert.equal(transport.calls.length, 1);
      assert.ok(transport.calls[0].every(statement => statement.sql.startsWith('SELECT')));
      assert.deepEqual(state(target), before);
      assert.throws(() => restoreData(f.archive, f.target), /migration ledger/i);
      assert.deepEqual(state(target), before);
    } finally { if (f.db.isOpen) f.db.close(); target.close(); rmSync(f.dir, { recursive: true }); }
  });

  test(`atomic REST restore refuses migration ledger ${description} introduced after preflight`, async () => {
    const f = fixture(), target = new DatabaseSync(':memory:'); initialize(target);
    try {
      f.db.close(); exportData(f.source, f.archive);
      let before;
      const transport = sqliteTransport(target, (_batch, number) => {
        if (number === 2) { target.exec(drift); before = state(target); }
      });
      await assert.rejects(() => importRemote(f.archive, transport.query));
      assert.equal(transport.calls.length, 2);
      assert.deepEqual(state(target), before);
    } finally { if (f.db.isOpen) f.db.close(); target.close(); rmSync(f.dir, { recursive: true }); }
  });
}
