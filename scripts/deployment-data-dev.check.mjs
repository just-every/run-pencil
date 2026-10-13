import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { exportData, importData } from './deployment-data.mjs';
import { hash } from './deployment-data-core.mjs';
import { fixture } from './deployment-data-test-helpers.mjs';

const later = 4102444800000;
const operator = (db, id, email, status = 'active') => db.prepare("INSERT INTO oa_operators(id,email,display_name,role,status,version,created_at) VALUES(?,?,?,'admin',?,1,1)").run(id, email, id, status);
const session = (db, id, operatorId, kind) => db.prepare('INSERT INTO oa_sessions(id,token_hash,operator_id,operator_version,kind,created_at,expires_at) VALUES(?,?,?,1,?,1,?)').run(id, `hash-${id}`, operatorId, kind, later);
const token = (db, id, operatorId) => db.prepare("INSERT INTO oa_tokens(id,token_hash,kind,operator_id,operator_version,return_to,created_at,expires_at) VALUES(?,?,'magic',?,1,'/app',1,?)").run(id, `hash-${id}`, operatorId, later);

test('sign-in authorization and dev identity never travel: export drops every session and credential and suspends personas; import refuses an archive that holds them', () => {
  const f = fixture(db => {
    operator(db, 'colleague', 'colleague@example.test'); operator(db, 'persona', 'operator@dev.localhost');
    session(db, 'ordinary', 'colleague', 'native'); session(db, 'dev-session', 'persona', 'dev');
    token(db, 'ordinary-link', 'colleague'); token(db, 'dev-minted-link', 'colleague');
    db.prepare("INSERT INTO oa_dev_credentials(credential,id,created_at) VALUES('oa_tokens','dev-minted-link',1)").run();
    db.prepare('INSERT INTO oa_credentials(id,token_hash,operator_id,operator_version,kind,expires_at) VALUES(?,?,?,1,?,?)').run('api-key', 'hash-api-key', 'colleague', 'native', later);
  });
  try {
    f.db.close(); exportData(f.source, f.archive);
    importData(f.archive, f.target);
    const db = new DatabaseSync(f.target);
    for (const table of ['oa_sessions', 'oa_tokens', 'oa_credentials', 'oa_dev_credentials']) assert.equal(db.prepare(`SELECT count(*) n FROM ${table}`).get().n, 0, table);
    assert.equal(db.prepare("SELECT status FROM oa_operators WHERE email='operator@dev.localhost'").get().status, 'inactive');
    assert.equal(db.prepare("SELECT status FROM oa_operators WHERE email='colleague@example.test'").get().status, 'active');
    db.close();
    // Archives that still hold a session or a dev credential record are refused, even with a matching digest.
    const plant = (name, row, code) => {
      const archive = JSON.parse(readFileSync(f.archive, 'utf8')), table = archive.payload.tables.find(table => table.name === name);
      table.rows.push(table.columns.map(column => ({ type: 'text', value: row[column] ?? `planted-${column}` })));
      archive.sha256 = hash(JSON.stringify(archive.payload));
      const planted = join(f.dir, `planted-${name}.json`); writeFileSync(planted, JSON.stringify(archive) + '\n');
      assert.throws(() => importData(planted, join(f.dir, `refused-${name}.sqlite`)), { recoveryCode: code });
    };
    plant('oa_sessions', { kind: 'native' }, 'LIVE_AUTHORIZATION');
    plant('oa_dev_credentials', { credential: 'oa_tokens' }, 'DEV_DATA');
  } finally { if (f.db.isOpen) f.db.close(); rmSync(f.dir, { recursive: true }); }
});
