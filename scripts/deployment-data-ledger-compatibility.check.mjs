import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initialize, metadata, hash } from './deployment-data-core.mjs';
import { kitLedger, ledger } from './deployment-data-ledger.mjs';
import { kitDatabase, migrateKit } from './deployment-data-hosted-test-helpers.mjs';
import { exportData, importData, restoreData } from './deployment-data-local.mjs';
import { exportRemote, importRemote } from './deployment-data-remote.mjs';
import { sqliteTransport, stamp } from './deployment-data-test-helpers.mjs';

const directory = () => mkdtempSync(join(process.env.PENCIL_VERIFICATION_TMPDIR ?? tmpdir(), 'pencil-ledger-compatibility-'));
const workspace = db => db.prepare('SELECT * FROM workspaces').all();

test('legacy kit recovery remains portable and the installed kit transitions its ledger without changing application records', async () => {
  const dir = directory(), path = join(dir, 'legacy.sqlite'), source = new DatabaseSync(path);
  const target = new DatabaseSync(':memory:');
  try {
    initialize(source, kitLedger); initialize(target, kitLedger);
    source.prepare('INSERT INTO workspaces(id,name,time_zone,created_at,updated_at) VALUES(?,?,?,?,?)').run('retained','Retained owner data','UTC',stamp,stamp);
    const records = workspace(source), archive = join(dir, 'legacy.rer');
    const first = exportData(path, archive);
    assert.deepEqual(await importRemote(archive, sqliteTransport(target).query), first);
    assert.deepEqual(workspace(target), records);
    assert.deepEqual(await exportRemote(join(dir,'legacy-remote.rer'), sqliteTransport(target).query), first);
    const restored = join(dir, 'legacy-restored.sqlite');
    assert.deepEqual(importData(archive, restored), first);
    assert.deepEqual(exportData(restored, join(dir,'legacy-local.rer')), first);
    // Execute the installed controller's actual transition against a populated
    // local legacy database. No history or migration bytes are rewritten here.
    await migrateKit(source);
    assert.deepEqual(workspace(source), records);
    assert.deepEqual(source.prepare('SELECT name,sha256,state FROM d1_migrations ORDER BY id').all().map(row=>({...row})), metadata().map(row=>({...row,state:'applied'})));
    assert.equal(source.prepare("SELECT count(*) n FROM sqlite_schema WHERE name='_rer_deploy_migrations'").get().n, 0);
    const currentArchive = join(dir,'current.rer'), current = exportData(path, currentArchive);
    const currentPath = join(dir,'current-target.sqlite'), currentTarget = await kitDatabase(currentPath);
    try {
      assert.deepEqual(restoreData(currentArchive, currentPath), current);
      assert.deepEqual(workspace(currentTarget), records);
      assert.deepEqual(exportData(currentPath, join(dir,'current-after.rer')), current);
      assert.equal(readFileSync(currentArchive,'utf8'),readFileSync(join(dir,'current-after.rer'),'utf8'));
    } finally { currentTarget.close(); }
    // The same table name is not the same controller: plain Wrangler must not
    // silently adopt hashed history in either direction, locally or remotely.
    const plainPath = join(dir,'plain.sqlite'), plain = new DatabaseSync(plainPath), plainArchive = join(dir,'plain.rer');
    try { initialize(plain); exportData(plainPath,plainArchive); } finally { plain.close(); }
    for (const [sourcePath, history] of [[currentArchive, ledger], [archive, ledger], [plainArchive, null]]) {
      const destinationPath = join(dir,'other.sqlite'), destination = history ? new DatabaseSync(destinationPath) : await kitDatabase(destinationPath);
      try {
        if (history) initialize(destination, history);
        const before = readFileSync(destinationPath), edge = sqliteTransport(destination);
        assert.throws(()=>restoreData(sourcePath, destinationPath), {recoveryCode:'MIGRATION_MISMATCH'});
        await assert.rejects(importRemote(sourcePath, edge.query), {recoveryCode:'MIGRATION_MISMATCH'});
        assert.deepEqual(readFileSync(destinationPath), before);
        assert.ok(edge.calls.flat().every(row=>row.sql.startsWith('SELECT')));
      } finally { destination.close(); rmSync(destinationPath); }
    }
  } finally { source.close(); target.close(); rmSync(dir, {recursive:true}); }
});

test('hashed recovery refuses forged history and checks history again in the atomic publication batch', async () => {
  const dir = directory(), sourcePath = join(dir,'source.sqlite'), source = await kitDatabase(sourcePath);
  try {
    source.prepare('INSERT INTO workspaces(id,name,time_zone,created_at,updated_at) VALUES(?,?,?,?,?)').run('retained','Never partially published','UTC',stamp,stamp);
    const archive = join(dir,'valid.rer'); exportData(sourcePath, archive);
    for (const column of ['name','sha256','state','id']) {
      const forged = JSON.parse(readFileSync(archive,'utf8'));
      forged.payload.d1Migrations.rows[0][forged.payload.d1Migrations.columns.indexOf(column)] = column === 'id' ? {type:'integer',value:'1000'} : {type:'text',value:'untrusted'};
      forged.sha256 = hash(JSON.stringify(forged.payload));
      const file = join(dir,`forged-${column}.rer`), target = join(dir,`forged-${column}.sqlite`);
      writeFileSync(file,JSON.stringify(forged),{mode:0o600});
      assert.throws(()=>importData(file,target),{recoveryCode:'MIGRATION_MISMATCH'});
      assert.equal(existsSync(target),false);
      const empty = await kitDatabase(':memory:'), edge = sqliteTransport(empty);
      try {
        await assert.rejects(importRemote(file,edge.query),{recoveryCode:'MIGRATION_MISMATCH'});
        assert.equal(edge.calls.length,0);
      } finally { empty.close(); }
    }
    for (const phase of ['preparation','publication']) {
      const target = await kitDatabase(':memory:'); let injected = false;
      try {
        const edge = sqliteTransport(target, batch => {
          if (!injected && batch.some(row=>phase==='preparation' ? row.sql.startsWith('CREATE TABLE "_pencil_restore_') : row.sql.startsWith('ALTER TABLE "_pencil_restore_'))) {
            target.exec(phase === 'preparation' ? "UPDATE d1_migrations SET state='applying' WHERE id=1" : 'UPDATE d1_migrations SET id=1000 WHERE id=1'); injected = true;
          }
        });
        await assert.rejects(importRemote(archive,edge.query));
        assert.equal(injected,true);
        assert.deepEqual(workspace(target),[]);
        if (phase === 'preparation') assert.equal(target.prepare('SELECT state FROM d1_migrations WHERE id=1').get().state,'applying');
        else assert.equal(target.prepare('SELECT count(*) n FROM d1_migrations WHERE id=1000').get().n,1);
        assert.equal(target.prepare("SELECT count(*) n FROM sqlite_schema WHERE name GLOB '_pencil_restore_*'").get().n,0);
        assert.deepEqual(target.prepare('PRAGMA foreign_key_check').all(),[]);
      } finally { target.close(); }
    }
  } finally { source.close(); rmSync(dir,{recursive:true}); }
});
