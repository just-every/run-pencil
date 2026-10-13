import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initialize } from './deployment-data.mjs';
export const stamp = '2026-10-01T00:00:00Z';
export function fixture(beforeOwner = () => {}) {
  const dir = mkdtempSync(join(process.env.PENCIL_VERIFICATION_TMPDIR ?? tmpdir(), 'pencil-portability-'));
  const source = join(dir, 'source.sqlite'), archive = join(dir, 'archive.json'), target = join(dir, 'target.sqlite');
  const db = new DatabaseSync(source); initialize(db); beforeOwner(db);
  db.prepare('INSERT INTO workspaces(id,name,time_zone,created_at,updated_at) VALUES(?,?,?,?,?)').run('workspace','Recovery','UTC',stamp,stamp);
  db.prepare('INSERT INTO operators(id,workspace_id,email,display_name,created_at,updated_at,is_setup_operator) VALUES(?,?,?,?,?,?,1)').run('operator','workspace','operator@example.test','Operator',stamp,stamp);
  db.prepare('INSERT INTO local_dev_inbox VALUES(?,?,?,?,?)').run('inbox','operator@example.test','planted-inbox-credential',stamp,stamp);
  db.prepare('INSERT INTO local_mail_outbox VALUES(?,?,?)').run('mail',JSON.stringify({ text: 'planted-captured-auth-credential', url: 'https://example.test/auth?token=planted-invitation-credential' }),stamp);
  return { dir, source, archive, target, db };
}
// A test-only REST transport backed by real SQLite executes the exact generated
// statements transactionally. Native D1 checks exercise the same planner too.
export function sqliteTransport(db, beforeBatch = () => {}) {
  const calls = [];
  const query = async batch => {
    calls.push(batch); beforeBatch(batch, calls.length);
    db.exec('BEGIN');
    try {
      const result = batch.map(({sql,params = []}) => ({ success: true, meta: { served_by_primary: true }, results: db.prepare(sql).all(...params) }));
      db.exec('COMMIT'); return result;
    } catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
  };
  query.bookmark = async () => `${db.prepare('SELECT total_changes() n').get().n}:${db.prepare('PRAGMA schema_version').get().schema_version}`;
  return { query, calls };
}
