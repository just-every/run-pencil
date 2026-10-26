import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { initialize, migrations, inventory, snapshot, populate, readTable } from './deployment-data-core.mjs';
import { initializedRows, initializedTable } from './deployment-data-initialized.mjs';
import { exportData, importData } from './deployment-data.mjs';
import { importRemote } from './deployment-data-remote.mjs';
import { destinationGuards } from './deployment-data-staging.mjs';
import { restoreStatements } from './deployment-data-sql.mjs';
import { fixture, sqliteTransport } from './deployment-data-test-helpers.mjs';
const toHex = value => Buffer.from(value, 'base64').toString('hex');

test('[DATA-001,BASE-OPS-002,IMPORT-004,BASE-OPS-003] initialized restore replaces source-bound monotonic state exactly and refuses changed initialization or owner rows without writes', async () => {
  const f = fixture(), core = new DatabaseSync(':memory:'), direct = new DatabaseSync(':memory:'), remote = new DatabaseSync(':memory:');
  let file;
  try {
    for (const db of [core, direct, remote]) initialize(db);
    const migration = migrations().find(row => row.name === '0019_import_custody.sql');
    assert.ok(migration);
    assert.ok(migration.sql.includes('INSERT OR IGNORE INTO form_import_native_clock(id,revision) VALUES(1,1);'));
    for (const [name, seed] of Object.entries(initializedRows)) {
      const descriptor = inventory(core).find(table => table.name === name);
      assert.ok(descriptor);
      assert.deepEqual(readTable(core, descriptor), { name, ...seed });
      assert.throws(() => initializedTable({ name, columns: [...seed.columns, 'unreviewed'] }));
    }
    f.db.prepare('UPDATE form_import_native_clock SET revision=7 WHERE id=1').run();
    const expected = snapshot(f.db);
    populate(core, expected, { existing: true });
    await sqliteTransport(direct).query(restoreStatements(expected, JSON.parse(expected.payload.schema), toHex));
    exportData(f.source, f.archive); importData(f.archive, f.target); file = new DatabaseSync(f.target);
    await importRemote(f.archive, sqliteTransport(remote).query);
    for (const db of [core, direct, file, remote]) {
      assert.deepEqual(snapshot(db), expected);
      assert.equal(db.prepare('SELECT revision FROM form_import_native_clock WHERE id=1').get().revision, 7);
      assert.equal(db.prepare('SELECT count(*) n FROM response_outbox WHERE notification_eligible<>0').get().n, 0);
    }
    // The exported source has non-default monotonic state; every refused
    // target must retain its own exact state rather than partially importing it.
    const archive = expected;
    for (const mutation of [
      'DELETE FROM form_import_native_clock',
      'UPDATE form_import_native_clock SET revision=2',
      'UPDATE form_import_native_clock SET revision=1.5',
      "INSERT INTO local_fixture_initializations VALUES('owned','2026-10-01T00:00:00Z')",
    ]) for (const path of ['core', 'direct', 'staged', 'remote']) {
      const db = new DatabaseSync(':memory:');
      try {
        initialize(db); db.exec(mutation);
        const before = snapshot(db), changes = db.prepare('SELECT total_changes() n').get().n;
        const transport = sqliteTransport(db);
        if (path === 'core') assert.throws(() => populate(db, archive, { existing: true }), /contains application records/);
        if (path === 'direct') await assert.rejects(transport.query(restoreStatements(archive, JSON.parse(archive.payload.schema), toHex)));
        if (path === 'staged') await assert.rejects(transport.query(destinationGuards(archive, archive.payload.schema)));
        if (path === 'remote') {
          await assert.rejects(importRemote(f.archive, transport.query), /contains application records/);
          assert.ok(transport.calls.flat().every(statement => statement.sql.startsWith('SELECT')));
        }
        assert.deepEqual(snapshot(db), before);
        assert.equal(db.prepare('SELECT total_changes() n').get().n, changes);
      } finally { db.close(); }
    }
  } finally { f.db.close(); core.close(); direct.close(); remote.close(); file?.close(); }
});
