import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { initialize, snapshot, migrations } from './deployment-data.mjs';
import { unstable_splitSqlQuery } from 'wrangler';
import { exportRemote, importRemote } from './deployment-data-remote.mjs';
import { fixture, sqliteTransport, stamp } from './deployment-data-test-helpers.mjs';

test('the deployment CLI and native loader produce the same complete reporting trigger schema', () => {
  const deployed=new DatabaseSync(':memory:'),native=new DatabaseSync(':memory:');initialize(native);
  try {
    for(const migration of migrations()) for(const statement of unstable_splitSqlQuery(migration.sql)) deployed.exec(statement);
    const triggers=db=>db.prepare("SELECT name,sql FROM sqlite_schema WHERE type='trigger' ORDER BY name").all();
    assert.deepEqual(triggers(deployed),triggers(native));
  } finally {deployed.close();native.close();}
});

test('remote archives retain every anonymous reporting scope across bounded capture and restoration', async () => {
  const f=fixture(),target=new DatabaseSync(':memory:');initialize(target);
  try {
    const insert=f.db.prepare('INSERT INTO reporting_changes VALUES(?,?,?,?)');
    for(let index=0;index<1025;index++) insert.run('workspace',`historical-flow-${index}`,stamp,index+1);
    f.db.prepare('UPDATE reporting_generations SET generation=1025').run();
    const expected=snapshot(f.db),source=sqliteTransport(f.db),destination=sqliteTransport(target);
    await exportRemote(f.archive,source.query);
    await importRemote(f.archive,destination.query);
    assert.deepEqual(snapshot(target),expected);
    assert.equal(target.prepare('SELECT count(*) AS n FROM reporting_changes').get().n,1025);
    const again=await exportRemote(join(f.dir,'again.json'),destination.query);
    assert.equal(again.sha256,expected.sha256);
    assert.ok(source.calls.filter(batch=>batch.some(row=>row.sql.startsWith('WITH page')&&row.sql.includes('"reporting_changes"'))).length>=3);
  } finally {f.db.close();target.close();rmSync(f.dir,{recursive:true});}
});
