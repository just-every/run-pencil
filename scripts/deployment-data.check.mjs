import { mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { exportData, importData, initialize, snapshot, migrations, readTable } from './deployment-data.mjs';

const stamp = '2026-10-02T00:00:00.000Z';
function fixture() {
  const directory = mkdtempSync(join(process.env.PENCIL_VERIFICATION_TMPDIR ?? tmpdir(), 'pencil-data-test-'));
  const source = join(directory, 'source.sqlite');
  const database = new DatabaseSync(source);
  initialize(database);
  const insert = (table, row) => {
    const keys = Object.keys(row);
    database.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...Object.values(row));
  };
  insert('workspaces', { id: 'workspace', name: 'Synthetic recovery', time_zone: 'Australia/Brisbane', created_at: stamp, updated_at: stamp });
  insert('operators', { id: 'operator', workspace_id: 'workspace', email: 'review@example.test', display_name: 'Review', created_at: stamp, updated_at: stamp, is_setup_operator: 1 });
  insert('operator_sessions', { id: 'revoked', operator_id: 'operator', token_hash: 'synthetic-session-hash', expires_at: stamp, last_active_at: stamp, revoked_at: stamp, created_at: stamp, updated_at: stamp });
  insert('auth_magic_links', { id: 'consumed', operator_id: 'operator', token_hash: 'synthetic-link-hash', expires_at: stamp, consumed_at: stamp, revoked_at: stamp, created_at: stamp });
  insert('oa_tokens', { id: 'native-consumed', token_hash: 'synthetic-native-hmac-link', kind: 'magic', operator_id: 'operator', operator_version: 1, return_to: '/app', created_at: 1790899200000, expires_at: 1790900100000, consumed_at: 1790899260000 });
  insert('oa_sessions', { id: 'native-session', token_hash: 'native-hmac-session', operator_id: 'operator', operator_version: 1, kind: 'native', source_token_id: 'native-consumed', created_at: 1790899260000, expires_at: 1790985660000 });
  insert('oa_external_identities', { issuer: 'https://historical.example.test', subject: 'preserved-owner-association', operator_id: 'operator' });
  insert('local_fixture_initializations', { id: 'sample-data', initialized_at: stamp });
  insert('integration_connections', { kind: 'analysis', sealed: 'synthetic-private-ciphertext', updated_at: stamp });
  insert('flows', { id: 'flow', workspace_id: 'workspace', slug: 'recovery-review', title: 'Synthetic recovery', status: 'closed', draft_version: 3, last_activity_at: stamp, created_at: stamp, updated_at: stamp });
  for (const [id, number, current] of [['old-revision', 1, 0], ['revision', 2, 1]]) {
    insert('flow_revisions', { id, flow_id: 'flow', number, state: 'published', title: `Revision ${number}`, published_at: stamp, created_at: stamp, updated_at: stamp, is_current: current, admission_closed_at: stamp, admission_close_reason: 'manual', policy_snapshot_json: '{"rule":"synthetic"}' });
    insert('flow_steps', { id: `${id}-question`, revision_id: id, position: 0, kind: 'question', question_type: 'long_text', prompt: `Question ${number}`, required: 1, stable_id: 'stable-question', created_at: stamp, updated_at: stamp });
    insert('flow_steps', { id: `${id}-end`, revision_id: id, position: 1, kind: 'completion', prompt: 'Recorded', required: 0, stable_id: 'stable-end', created_at: stamp, updated_at: stamp });
  }
  for (const [id, state, revision] of [['completed', 'released', 'old-revision'], ['suspected', 'quarantined', 'revision']]) {
    // Completed session rows are intentionally absent after privacy folding.
    insert('responses', { id, workspace_id: 'workspace', flow_id: 'flow', revision_id: revision, session_id: `${id}-removed-session`, session_token_hash: `${id}-hash`, idempotency_key: `${id}-receipt`, state, quarantine_reason: state === 'quarantined' ? 'minimum-fill-time' : null, released_at: state === 'released' ? stamp : null, completed_at: stamp, created_at: stamp, updated_at: stamp, source: 'direct', started_at: stamp });
    insert('response_answers', { id: `${id}-answer`, response_id: id, step_id: 'stable-question', value_json: JSON.stringify('  Exact 😀 line\n=literal,"quote"\u0000\t  '), created_at: stamp, updated_at: stamp });
  }
  for (const state of ['pending', 'dispatched', 'failed']) insert('response_outbox', { id: `effect-${state}`, workspace_id: 'workspace', response_id: 'completed', kind: `synthetic.effect.${state}`, idempotency_key: `effect-${state}`, payload_json: '{"responseId":"completed"}', status: state, available_at: stamp, dispatched_at: state === 'dispatched' ? stamp : null, failure_reason: state === 'failed' ? 'synthetic failure' : null, created_at: stamp, updated_at: stamp });
  insert('audit_entries', { id: 'removed-actor', workspace_id: 'workspace', kind: 'synthetic.audit', actor_operator_id: 'operator-removed-earlier', subject_type: 'flow', subject_id: 'flow', details_json: '{}', created_at: stamp });
  insert('revision_metric_counters', { id: 'metric', revision_id: 'revision', starts: 9223372036854775807n, completions: 0, total_completion_milliseconds: 0, mobile_starts: 0, tablet_starts: 0, desktop_starts: 0, created_at: stamp, updated_at: stamp });
  database.close();
  return { directory, source, archive: join(directory, 'archive.json'), restored: join(directory, 'restored.sqlite') };
}
function rewritten(path, mutate) {
  const archive = JSON.parse(readFileSync(path, 'utf8'));
  mutate(archive);
  archive.sha256 = createHash('sha256').update(JSON.stringify(archive.payload)).digest('hex');
  writeFileSync(path, JSON.stringify(archive));
}

test('full current-data roundtrip preserves stable revisions, quarantine, receipts, historical actors, auth, effects, exact text and int64', () => {
  const f = fixture();
  try {
    const exported = exportData(f.source, f.archive);
    assert.deepEqual(JSON.parse(readFileSync(f.archive, 'utf8')).payload.tables.find(table => table.name === 'integration_connections').rows, []);
    assert.equal(statSync(f.archive).mode & 0o777, 0o600);
    assert.deepEqual(importData(f.archive, f.restored), exported);
    assert.equal(statSync(f.restored).mode & 0o777, 0o600);
    const second = join(f.directory, 'second.json');
    assert.deepEqual(exportData(f.restored, second), exported);
    assert.equal(readFileSync(second, 'utf8'), readFileSync(f.archive, 'utf8'));
    const database = new DatabaseSync(f.restored, { readOnly: true });
    assert.equal(database.prepare("SELECT count(*) AS n FROM respondent_sessions").get().n, 0);
    assert.equal(database.prepare("SELECT count(*) AS n FROM responses WHERE state='quarantined'").get().n, 1);
    assert.equal(database.prepare('SELECT COUNT(*) AS n FROM d1_migrations').get().n, migrations().length);
    assert.deepEqual(database.prepare('SELECT name FROM d1_migrations ORDER BY id').all().map(row => row.name), migrations().map(row => row.name));
    assert.deepEqual(JSON.parse(readFileSync(f.archive, 'utf8')).payload.migrations, migrations().map(row => ({ name: row.name, sha256: createHash('sha256').update(row.sql).digest('hex') })));
    for (const table of ['operator_sessions', 'auth_magic_links', 'oa_tokens', 'oa_sessions']) assert.equal(database.prepare(`SELECT count(*) AS n FROM ${table}`).get().n, 0, table);
    assert.equal(database.prepare('SELECT operator_id FROM oa_external_identities').get().operator_id, 'operator');
    assert.equal(database.prepare('SELECT initialized_at FROM local_fixture_initializations').get().initialized_at, stamp);
    database.close();
  } finally { rmSync(f.directory, { recursive: true }); }
});

test('existing archive/database files are untouched; malformed and foreign-key-invalid archives create no target', () => {
  const f = fixture();
  try {
    exportData(f.source, f.archive);
    const original = readFileSync(f.source);
    assert.throws(() => importData(f.archive, f.source), { code: 'EEXIST' });
    assert.deepEqual(readFileSync(f.source), original);
    const archiveBytes = readFileSync(f.archive);
    assert.throws(() => exportData(f.source, f.archive), /EEXIST/);
    assert.deepEqual(readFileSync(f.archive), archiveBytes);
    rewritten(f.archive, archive => {
      const table = archive.payload.tables.find(table => table.name === 'responses');
      table.rows[0][table.columns.indexOf('workspace_id')] = { type: 'text', value: 'missing-workspace' };
    });
    assert.throws(() => importData(f.archive, f.restored), /foreign-key/);
    assert.equal(existsSync(f.restored), false);
    writeFileSync(f.archive, archiveBytes);
    rewritten(f.archive, archive => { archive.payload.tables.push({ name: 'malicious; DROP TABLE flows', columns: [], rows: [] }); });
    assert.throws(() => importData(f.archive, f.restored), /inventory/);
    assert.equal(existsSync(f.restored), false);
    writeFileSync(f.archive, archiveBytes);
    rewritten(f.archive, archive => { archive.payload.d1Migrations.rows.pop(); });
    assert.throws(() => importData(f.archive, f.restored), /migration ledger/);
    assert.equal(existsSync(f.restored), false);
    for (const mutate of [
      rows => rows.push(structuredClone(rows[0])),
      rows => { rows[0][1] = { type: 'text', value: 'unknown.sql' }; },
      rows => rows.push([{ type: 'integer', value: '999' }, { type: 'text', value: 'extra.sql' }, { type: 'text', value: stamp }]),
    ]) {
      writeFileSync(f.archive, archiveBytes);
      rewritten(f.archive, archive => mutate(archive.payload.d1Migrations.rows));
      assert.throws(() => importData(f.archive, f.restored), /migration ledger/);
      assert.equal(existsSync(f.restored), false);
    }
    writeFileSync(f.archive, '{"payload":null}');
    assert.throws(() => importData(f.archive, f.restored));
    assert.equal(existsSync(f.restored), false);
  } finally { rmSync(f.directory, { recursive: true }); }
});

test('snapshot preserves blob and real storage types without executing archive SQL', () => {
  const database = new DatabaseSync(':memory:');
  try {
    initialize(database);
    // This exploratory source cannot be imported: added schema has no committed migration.
    database.exec('CREATE TABLE extra_values (binary BLOB, amount REAL)');
    database.prepare('INSERT INTO extra_values VALUES (?, ?)').run(Buffer.from([0, 255, 128, 10]), 1.25);
    assert.throws(() => snapshot(database), /explicit table\/column privacy classification/);
    const table = readTable(database, { name: 'extra_values', columns: ['binary','amount'] });
    assert.deepEqual(table.rows, [[{ type: 'blob', value: 'AP+ACg==' }, { type: 'real', value: 1.25 }]]);
  } finally { database.close(); }
});


test('unknown non-provider source tables cannot hide behind provider/reserved prefix matching', () => {
  const f = fixture();
  try {
    const database = new DatabaseSync(f.source);
    database.exec("CREATE TABLE acfx_records (id TEXT PRIMARY KEY, value TEXT); INSERT INTO acfx_records VALUES ('important', 'synthetic retained data')");
    database.close();
    assert.throws(() => exportData(f.source, f.archive), /schema differs/);
    assert.equal(existsSync(f.archive), false);
  } finally { rmSync(f.directory, { recursive: true }); }
});

test('a target appearing during private staging is never overwritten and only owned staging is removed', () => {
  const f = fixture();
  let interception;
  try {
    exportData(f.source, f.archive);
    const originalClose = DatabaseSync.prototype.close;
    let closes = 0;
    interception = mock.method(DatabaseSync.prototype, 'close', function () {
      originalClose.call(this);
      if (++closes === 2) writeFileSync(f.restored, 'Existing target appeared during staging', { flag: 'wx' });
    });
    assert.throws(() => importData(f.archive, f.restored), { code: 'EEXIST' });
    assert.equal(readFileSync(f.restored, 'utf8'), 'Existing target appeared during staging');
    assert.deepEqual(readdirSync(f.directory).filter(name => name.startsWith('.pencil-restore-')), []);
  } finally { interception?.mock.restore(); rmSync(f.directory, { recursive: true }); }
});
