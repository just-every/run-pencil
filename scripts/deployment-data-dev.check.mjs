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

test('dev identity never travels: export drops dev sessions and dev-minted credentials and suspends personas; import refuses an archive that holds them', () => {
  const f = fixture(db => {
    operator(db, 'colleague', 'colleague@example.test'); operator(db, 'persona', 'operator@dev.localhost');
    session(db, 'ordinary', 'colleague', 'native'); session(db, 'dev-session', 'persona', 'dev');
    token(db, 'ordinary-link', 'colleague'); token(db, 'dev-minted-link', 'colleague');
    db.prepare("INSERT INTO oa_dev_credentials(credential,id,created_at) VALUES('oa_tokens','dev-minted-link',1)").run();
  });
  try {
    f.db.close(); exportData(f.source, f.archive);
    importData(f.archive, f.target);
    const db = new DatabaseSync(f.target);
    assert.deepEqual(db.prepare('SELECT id FROM oa_sessions ORDER BY id').all().map(row => row.id), ['ordinary'], 'ordinary sessions travel, the dev session does not');
    assert.deepEqual(db.prepare('SELECT id FROM oa_tokens ORDER BY id').all().map(row => row.id), ['ordinary-link'], 'the credential minted in a dev session does not travel');
    assert.equal(db.prepare('SELECT count(*) n FROM oa_dev_credentials').get().n, 0);
    assert.equal(db.prepare("SELECT status FROM oa_operators WHERE email='operator@dev.localhost'").get().status, 'inactive');
    assert.equal(db.prepare("SELECT status FROM oa_operators WHERE email='colleague@example.test'").get().status, 'active');
    db.close();
    // An archive that still holds a dev session is refused, even with a matching digest.
    const archive = JSON.parse(readFileSync(f.archive, 'utf8')), sessions = archive.payload.tables.find(table => table.name === 'oa_sessions');
    const dev = sessions.rows.find(row => row[sessions.columns.indexOf('id')].value === 'ordinary').map(cell => ({ ...cell }));
    dev[sessions.columns.indexOf('id')].value = 'planted-dev-session'; dev[sessions.columns.indexOf('kind')].value = 'dev';
    sessions.rows.push(dev); sessions.rows.sort((a, b) => JSON.stringify(a) < JSON.stringify(b) ? -1 : 1);
    archive.sha256 = hash(JSON.stringify(archive.payload));
    const planted = join(f.dir, 'planted.json'); writeFileSync(planted, JSON.stringify(archive) + '\n');
    assert.throws(() => importData(planted, join(f.dir, 'refused.sqlite')), { recoveryCode: 'DEV_DATA' });
  } finally { if (f.db.isOpen) f.db.close(); rmSync(f.dir, { recursive: true }); }
});
