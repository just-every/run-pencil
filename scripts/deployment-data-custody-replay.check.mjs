import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { initialize, snapshot, validate, populate, schema, canonicalDatabaseSchema } from './deployment-data-core.mjs';
import { exportData, importData, restoreData } from './deployment-data.mjs';
import { exportRemote, importRemote } from './deployment-data-remote.mjs';
import { fixture, sqliteTransport } from './deployment-data-test-helpers.mjs';
import { sqliteD1 } from './custody-test-transport.mjs';
import { custodyGraph } from './custody-test-graph.mjs';
import { verifyCustodyReadback, custodyTriggerCanaries } from './custody-test-canaries.mjs';

test('[DATA-001,BASE-DATA-001,IMPORT-004] real typed custody replays through core, file and remote SQL without capture or seal invalidation', async () => {
  const f = fixture(), core = new DatabaseSync(':memory:'), remote = new DatabaseSync(':memory:');
  let file;
  try {
    f.db.exec('PRAGMA foreign_keys=ON');
    const graph = await custodyGraph(sqliteD1(f.db));
    const expected = snapshot(f.db), originalSchema = schema(f.db);
    assert.deepEqual(validate(expected), expected);
    initialize(core); populate(core, expected);
    assert.deepEqual(snapshot(core), expected);
    exportData(f.source, f.archive);
    importData(f.archive, f.target); file = new DatabaseSync(f.target);
    assert.deepEqual(snapshot(file), expected);
    initialize(remote); remote.exec('PRAGMA foreign_keys=ON');
    const deployed = join(f.dir, 'deployed.json');
    await exportRemote(deployed, sqliteTransport(f.db).query);
    await importRemote(deployed, sqliteTransport(remote).query);
    assert.deepEqual(snapshot(remote), expected);
    for (const database of [core, file, remote]) {
      assert.equal(canonicalDatabaseSchema(database), originalSchema);
      assert.equal(database.prepare('PRAGMA foreign_key_check').get(), undefined);
      await verifyCustodyReadback(sqliteD1(database), graph);
      await custodyTriggerCanaries(sqliteD1(database), graph);
    }
  } finally { core.close(); remote.close(); file?.close(); f.db.close(); rmSync(f.dir, { recursive: true }); }
});

test('[DATA-001,BASE-OPS-003] custody restore refuses populated and incompatible targets without destination writes', async () => {
  const f = fixture(), target = new DatabaseSync(':memory:');
  try {
    await custodyGraph(sqliteD1(f.db)); exportData(f.source, f.archive);
    const sourceBytes = readFileSync(f.source);
    assert.throws(() => restoreData(f.archive, f.source), /contains application records/);
    assert.deepEqual(readFileSync(f.source), sourceBytes);
    initialize(target); target.prepare('INSERT INTO local_fixture_initializations VALUES(?,?)').run('already-owned', '2026-10-01T00:00:00Z');
    const before = snapshot(target), transport = sqliteTransport(target);
    await assert.rejects(importRemote(f.archive, transport.query), /contains application records/);
    assert.deepEqual(snapshot(target), before);
    assert.ok(transport.calls.flat().every(statement => statement.sql.startsWith('SELECT')));
    target.exec('ALTER TABLE ik_d1_staging ADD COLUMN unreviewed_value TEXT');
    const prior = target.prepare('SELECT total_changes() n').get().n, invalid = sqliteTransport(target);
    await assert.rejects(importRemote(f.archive, invalid.query));
    assert.equal(target.prepare('SELECT total_changes() n').get().n, prior);
    assert.ok(invalid.calls.flat().every(statement => statement.sql.startsWith('SELECT')));
  } finally { target.close(); f.db.close(); rmSync(f.dir, { recursive: true }); }
});
