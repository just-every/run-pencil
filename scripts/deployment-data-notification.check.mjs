import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { rmSync } from 'node:fs';
import { initialize, snapshot, validate, populate } from './deployment-data-core.mjs';
import { exportRemote, importRemote } from './deployment-data-remote.mjs';
import { fixture, sqliteTransport, stamp } from './deployment-data-test-helpers.mjs';

test('local and REST restoration clear explicit retry authorization while retaining every delivery state and receipt', async () => {
  const f = fixture(), local = new DatabaseSync(':memory:'), remote = new DatabaseSync(':memory:');
  initialize(local); initialize(remote);
  const insert = (table, row) => f.db.prepare(`INSERT INTO ${table} (${Object.keys(row).join(',')}) VALUES (${Object.keys(row).map(() => '?').join(',')})`).run(...Object.values(row));
  try {
    insert('flows', { id: 'flow', workspace_id: 'workspace', slug: 'restored', title: 'Restored', status: 'closed', draft_version: 1, last_activity_at: stamp, created_at: stamp, updated_at: stamp });
    insert('flow_revisions', { id: 'revision', flow_id: 'flow', number: 1, state: 'published', title: 'Restored', created_at: stamp, updated_at: stamp });
    for (const status of ['pending','sending','sent','failed','unknown','cancelled']) {
      insert('responses', { id: status, workspace_id: 'workspace', flow_id: 'flow', revision_id: 'revision', session_id: `session:${status}`, session_token_hash: `hash:${status}`, idempotency_key: `response:${status}`, state: 'released', completed_at: stamp, created_at: stamp, updated_at: stamp, notification_eligible: 1 });
      insert('notification_deliveries', { id: status, response_id: status, operator_id: 'operator', status, idempotency_key: `key:${status}`, attempts: 2, explicit_retry_authorized: 1, available_at: stamp, provider: 'sendgrid', provider_code: 'RATE_LIMITED', provider_id: `receipt:${status}`, reason: 'Retained provider reason', created_at: stamp, updated_at: stamp });
      insert('notification_attempts', { id: status, delivery_id: status, ordinal: 2, event: status, provider: 'sendgrid', provider_code: 'RATE_LIMITED', created_at: stamp });
    }
    const archive = validate(snapshot(f.db));
    populate(local, archive, { existing: true });
    await exportRemote(f.archive, sqliteTransport(f.db).query);
    await importRemote(f.archive, sqliteTransport(remote).query);
    for (const destination of [local, remote]) {
      assert.deepEqual(snapshot(destination), archive);
      assert.equal(destination.prepare('SELECT count(*) n FROM notification_deliveries WHERE explicit_retry_authorized<>0').get().n, 0);
      assert.equal(destination.prepare('SELECT count(*) n FROM responses WHERE notification_eligible<>0').get().n, 0);
      assert.deepEqual(destination.prepare('SELECT id,status,idempotency_key,attempts,provider,provider_code,provider_id,reason FROM notification_deliveries ORDER BY id').all(), f.db.prepare('SELECT id,status,idempotency_key,attempts,provider,provider_code,provider_id,reason FROM notification_deliveries ORDER BY id').all());
      assert.deepEqual(destination.prepare('SELECT * FROM notification_attempts ORDER BY id').all(), f.db.prepare('SELECT * FROM notification_attempts ORDER BY id').all());
    }
  } finally { f.db.close(); local.close(); remote.close(); rmSync(f.dir, { recursive: true }); }
});
