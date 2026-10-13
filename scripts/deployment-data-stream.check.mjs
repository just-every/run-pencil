import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { initialize, exportData, importData } from './deployment-data.mjs';
import { snapshot, schema } from './deployment-data-core.mjs';
import { exportRemote, importRemote, cleanupRemote } from './deployment-data-remote.mjs';
import { schemaEquivalent } from './deployment-data-schema.mjs';
import { assertQueryBudget } from './deployment-data-provider.mjs';
import { fixture, sqliteTransport, stamp } from './deployment-data-test-helpers.mjs';

const wrapped = (transport, run) => Object.assign(run,{bookmark:transport.query.bookmark});
const stages = db => db.prepare("SELECT name FROM sqlite_schema WHERE name GLOB '_pencil_restore_*'").all();

test('stream parser retains legacy JSON with reordered properties, whitespace and chunk-boundary Unicode', () => {
  const f=fixture();
  try {
    f.db.prepare('UPDATE workspaces SET name=?').run('😀\u0000\\"\n'.repeat(17000));f.db.close();
    const expected=exportData(f.source,f.archive);
    const value=JSON.parse(readFileSync(f.archive,'utf8'));
    const reorder=value=>Array.isArray(value)?value.map(reorder):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).reverse().map(([key,entry])=>[key,reorder(entry)])):value;
    writeFileSync(f.archive,JSON.stringify(reorder(value),null,2));
    assert.deepEqual(importData(f.archive,f.target),expected);
    assert.deepEqual(exportData(f.target,join(f.dir,'again.json')),expected);
  } finally {if(f.db.isOpen)f.db.close();rmSync(f.dir,{recursive:true});}
});

test('disk canonical ordering matches earlier UTF-16 archives for supplementary and private-use Unicode', () => {
  const f=fixture();
  try {
    for(const id of ['\ue000','\u{10000}'])f.db.prepare('INSERT INTO local_fixture_initializations VALUES(?,?)').run(id,stamp);
    const expected=snapshot(f.db);f.db.close();
    const result=exportData(f.source,f.archive);assert.equal(result.sha256,expected.sha256);
    const archive=JSON.parse(readFileSync(f.archive,'utf8'));
    assert.deepEqual(archive.payload.tables.find(table=>table.name==='local_fixture_initializations').rows.map(row=>row[0].value),['\u{10000}','\ue000']);
    assert.deepEqual(importData(f.archive,f.target),result);
  } finally {if(f.db.isOpen)f.db.close();rmSync(f.dir,{recursive:true});}
});

test('streaming file export holds its WAL snapshot while another connection commits between tables', () => {
  const f=fixture();let writer,interception;
  try {
    f.db.exec('PRAGMA journal_mode=WAL');writer=new DatabaseSync(f.source);
    let changed=false;const original=DatabaseSync.prototype.prepare;
    interception=mock.method(DatabaseSync.prototype,'prepare',function(sql){
      if(this!==f.db&&this!==writer&&!changed&&sql.startsWith('SELECT name FROM sqlite_schema')) {changed=true;writer.prepare('INSERT INTO local_fixture_initializations VALUES(?,?)').run('concurrent',stamp);}
      return original.call(this,sql);
    });
    exportData(f.source,f.archive);assert.equal(changed,true);
    const archive=JSON.parse(readFileSync(f.archive,'utf8'));
    assert.equal(archive.payload.tables.find(table=>table.name==='local_fixture_initializations').rows.length,0);
    assert.equal(writer.prepare('SELECT count(*) n FROM local_fixture_initializations').get().n,1);
  } finally {interception?.mock.restore();writer?.close();f.db.close();rmSync(f.dir,{recursive:true});}
});

test('paginated remote export rejects concurrent changes and non-primary results before publishing', async () => {
  const f=fixture();
  try {
    let changed=false;
    const transport=sqliteTransport(f.db,batch=>{if(!changed&&batch.some(row=>row.sql.startsWith('WITH page'))){changed=true;f.db.prepare('INSERT INTO local_fixture_initializations VALUES(?,?)').run('concurrent',stamp);}});
    await assert.rejects(()=>exportRemote(f.archive,transport.query),/changed during export/);
    assert.equal(existsSync(f.archive),false);assert.equal(changed,true);
    const plain=sqliteTransport(f.db);
    const replica=wrapped(plain,async batch=>(await plain.query(batch)).map(result=>({...result,meta:{served_by_primary:false}})));
    await assert.rejects(()=>exportRemote(f.archive,replica),/primary reads/);assert.equal(existsSync(f.archive),false);
  } finally {f.db.close();rmSync(f.dir,{recursive:true});}
});

test('late publication failure and concurrent original writes preserve exact original schema and remove all inert staging', async () => {
  for(const concurrent of [false,true]) {
    const f=fixture(),target=new DatabaseSync(':memory:');initialize(target);
    try {
      f.db.close();exportData(f.source,f.archive);const before=snapshot(target),transport=sqliteTransport(target);
      let reached=false;
      const query=wrapped(transport,async batch=>{
        assertQueryBudget(batch);
        if(batch.some(row=>row.sql.startsWith('ALTER TABLE'))) {
          reached=true;
          if(concurrent)target.prepare('INSERT INTO local_fixture_initializations VALUES(?,?)').run('concurrent',stamp);
          else batch=[...batch,{sql:"SELECT json('publication failure')"}];
        }
        return transport.query(batch);
      });
      await assert.rejects(()=>importRemote(f.archive,query));assert.equal(reached,true);assert.equal(stages(target).length,0);
      assert.equal(schema(target),before.payload.schema);assert.equal(target.prepare('SELECT count(*) n FROM workspaces').get().n,0);
      if(concurrent)assert.equal(target.prepare('SELECT count(*) n FROM local_fixture_initializations').get().n,1);
      else assert.deepEqual(snapshot(target),before);
    } finally {if(f.db.isOpen)f.db.close();target.close();rmSync(f.dir,{recursive:true});}
  }
});

test('interrupted inert staging is explicitly cleanable with the matching validated archive and preserves a concurrent writer', async () => {
  const f=fixture(),target=new DatabaseSync(':memory:');initialize(target);
  try {
    f.db.close();exportData(f.source,f.archive);const originalSchema=schema(target),transport=sqliteTransport(target);
    let disconnected=false;
    const query=wrapped(transport,async batch=>{
      if(disconnected)throw Object.assign(new Error('Unconfirmed test transport'),{recoveryCode:'PROVIDER_UNCONFIRMED'});
      if(batch.some(row=>row.sql.startsWith('INSERT INTO')&&!row.sql.includes('_state'))) {disconnected=true;throw Object.assign(new Error('Unconfirmed test transport'),{recoveryCode:'PROVIDER_UNCONFIRMED'});}
      return transport.query(batch);
    });
    await assert.rejects(()=>importRemote(f.archive,query),/cleanup could not be confirmed/);
    assert.ok(stages(target).length>0);assert.equal(target.prepare('SELECT count(*) n FROM workspaces').get().n,0);
    target.prepare('INSERT INTO local_fixture_initializations VALUES(?,?)').run('concurrent',stamp);
    assert.equal((await cleanupRemote(f.archive,transport.query)).stagedRestoreRemoved,true);
    assert.equal(stages(target).length,0);assert.equal(schema(target),originalSchema);
    assert.equal(target.prepare('SELECT count(*) n FROM local_fixture_initializations').get().n,1);
  } finally {if(f.db.isOpen)f.db.close();target.close();rmSync(f.dir,{recursive:true});}
});

test('lost publication acknowledgment leaves a complete equivalent installation and never deletes its records', async () => {
  const f=fixture(),target=new DatabaseSync(':memory:');initialize(target);
  try {
    f.db.close();const expected=exportData(f.source,f.archive),transport=sqliteTransport(target);
    const query=wrapped(transport,async batch=>{const result=await transport.query(batch);if(batch.some(row=>row.sql.startsWith('ALTER TABLE')))throw Object.assign(new Error('Unknown commit outcome'),{recoveryCode:'PROVIDER_UNCONFIRMED'});return result;});
    await assert.rejects(()=>importRemote(f.archive,query),{recoveryCode:'PROVIDER_UNCONFIRMED'});
    assert.equal(stages(target).length,0);assert.deepEqual(await exportRemote(join(f.dir,'verified.json'),transport.query),expected);
  } finally {if(f.db.isOpen)f.db.close();target.close();rmSync(f.dir,{recursive:true});}
});

test('schema quote normalization never erases constraint, trigger, collation or literal differences', () => {
  const row=sql=>[{type:'table',name:'items',tbl_name:'items',sql}];
  const original=row("CREATE TABLE items(id TEXT PRIMARY KEY, value TEXT COLLATE NOCASE CHECK(value <> 'private'))");
  assert.equal(schemaEquivalent(row('CREATE TABLE "items"("id" TEXT PRIMARY KEY, "value" TEXT COLLATE NOCASE CHECK("value" <> \'private\'))'),original),true);
  assert.equal(schemaEquivalent(row('CREATE TABLE items(ok INTEGER CHECK(ok="TRUE"))'),row('CREATE TABLE items(ok INTEGER CHECK(ok=TRUE))')),false);
  for(const changed of ['COLLATE BINARY','CHECK(value = \'private\')',"CHECK(value <> 'other')",'id TEXT']) {
    const sql=original[0].sql.replace(changed.startsWith('COLLATE')?'COLLATE NOCASE':changed.startsWith('CHECK')?"CHECK(value <> 'private')":'id TEXT PRIMARY KEY',changed);
    assert.equal(schemaEquivalent(row(sql),original),false);
  }
});


test('local file export and bounded snapshots preserve the original digest after atomic remote table renaming', async () => {
  const f=fixture(),target=new DatabaseSync(f.target);initialize(target);
  try {
    const expected=snapshot(f.db);f.db.close();
    exportData(f.source,f.archive);
    await importRemote(f.archive,sqliteTransport(target).query);
    assert.deepEqual(snapshot(target),expected);
    assert.equal(exportData(f.target,join(f.dir,'local-after-remote.json')).sha256,expected.sha256);
  } finally {if(f.db.isOpen)f.db.close();target.close();rmSync(f.dir,{recursive:true});}
});


test('storage exhaustion during inert loading preserves the empty target and restores its complete original schema', async () => {
  const f=fixture(),target=new DatabaseSync(':memory:');initialize(target);
  try {
    f.db.prepare('UPDATE workspaces SET brand_logo_base64=?').run('a'.repeat(349524));f.db.close();
    exportData(f.source,f.archive);
    const before=snapshot(target),transport=sqliteTransport(target);let capped=false;
    const query=wrapped(transport,async batch=>{
      if(!capped&&batch.some(row=>row.sql.startsWith('INSERT INTO')&&!row.sql.includes('_state'))) {
        capped=true;
        const pages=target.prepare('PRAGMA page_count').get().page_count;
        target.exec(`PRAGMA max_page_count=${pages+4}`);
      }
      return transport.query(batch);
    });
    await assert.rejects(()=>importRemote(f.archive,query),error=>error.errcode===13);
    assert.equal(capped,true);assert.equal(stages(target).length,0);
    assert.deepEqual(snapshot(target),before);
    assert.equal(schema(target),before.payload.schema);
  } finally {if(f.db.isOpen)f.db.close();target.close();rmSync(f.dir,{recursive:true});}
});


test('failure after confirmed publication reports the published state and preserves every restored record', async () => {
  const f=fixture(),target=new DatabaseSync(':memory:');initialize(target);
  try {
    f.db.close();const expected=exportData(f.source,f.archive),transport=sqliteTransport(target);let published=false;
    const query=wrapped(transport,async batch=>{
      if(published)throw new Error('Verification connection unavailable');
      const result=await transport.query(batch);
      if(batch.some(row=>row.sql.startsWith('ALTER TABLE')))published=true;
      return result;
    });
    await assert.rejects(()=>importRemote(f.archive,query),error=>error.recoveryCode==='RESTORE_VERIFICATION_UNCONFIRMED'&&/publication completed/.test(error.message));
    assert.equal(stages(target).length,0);
    assert.deepEqual(await exportRemote(join(f.dir,'published.json'),transport.query),expected);
  } finally {if(f.db.isOpen)f.db.close();target.close();rmSync(f.dir,{recursive:true});}
});
