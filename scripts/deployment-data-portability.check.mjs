import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, rmSync, symlinkSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { initialize, snapshot, exportData, restoreData, importData } from './deployment-data.mjs';
import { inventory, schema, hash } from './deployment-data-core.mjs';
import { classify } from './deployment-data-policy.mjs';
import { cloudflareClient, exportRemote, importRemote } from './deployment-data-remote.mjs';
import { insertStatement, readStatement } from './deployment-data-sql.mjs';
import { readCells } from './deployment-data-values.mjs';
import { fixture, sqliteTransport, stamp } from './deployment-data-test-helpers.mjs';
test('explicit schema classifications cover every migrated column and reject new tables and columns', () => {
  const db = new DatabaseSync(':memory:'); initialize(db);
  try {
    for (const table of inventory(db)) assert.equal(Object.keys(classify(table)).length, table.columns.length);
    assert.throws(() => classify({name:'new_private_records',columns:['id']}), /privacy classification/);
    assert.throws(() => classify({name:'operators',columns:['private_token']}), /privacy classification/);
    for (const table of inventory(db).filter(table => ['oa_tokens','oa_sessions','auth_magic_links','operator_sessions'].includes(table.name))) assert.equal(classify(table).token_hash,'credential-hash');
  } finally { db.close(); }
});
test('legacy inbox metadata and bootstrap survive while private captured mail rows are excluded', () => {
  const f=fixture();
  try {
    f.db.close(); const summary=exportData(f.source,f.archive);
    const bytes=readFileSync(f.archive,'utf8');
    for (const secret of ['planted-inbox-credential','planted-captured-auth-credential','planted-invitation-credential']) assert.equal(bytes.includes(secret),false);
    importData(f.archive,f.target);
    const db=new DatabaseSync(f.target);
    assert.equal(db.prepare('SELECT count(*) n FROM local_dev_inbox').get().n,1);
    assert.equal(db.prepare('SELECT count(*) n FROM local_mail_outbox').get().n,0);
    assert.equal(db.prepare('SELECT magic_link_token FROM local_dev_inbox').get().magic_link_token,'');
    assert.equal(db.prepare('SELECT count(*) n FROM oa_bootstrap').get().n,1);
    assert.equal(db.prepare('SELECT count(*) n FROM oa_operators').get().n,1);
    db.close(); assert.deepEqual(exportData(f.target,join(f.dir,'second.json')),summary);
  } finally { if(f.db.isOpen) f.db.close(); rmSync(f.dir,{recursive:true}); }
});
test('empty migrated local target restores atomically, nonempty refusal performs no database writes', () => {
  const f=fixture();
  try {
    f.db.close(); exportData(f.source,f.archive);
    const target=new DatabaseSync(f.target); initialize(target); target.close();
    restoreData(f.archive,f.target);
    const before=readFileSync(f.target);
    assert.throws(()=>restoreData(f.archive,f.target),/contains application records/);
    assert.deepEqual(readFileSync(f.target),before);
    assert.deepEqual(exportData(f.target,join(f.dir,'second.json')),exportData(f.source,join(f.dir,'third.json')));
  } finally { if(f.db.isOpen)f.db.close(); rmSync(f.dir,{recursive:true}); }
});
test('repository archive paths and symlinked parents are refused without creating output', () => {
  const f=fixture();
  try {
    f.db.close(); const output=resolve('.private-archive-test.json');
    assert.throws(()=>exportData(f.source,output),/outside repositories/); assert.equal(existsSync(output),false);
    symlinkSync(resolve('.'),join(f.dir,'repo'),'dir');
    assert.throws(()=>exportData(f.source,join(f.dir,'repo','archive.json')),/outside repositories/);
  } finally { if(f.db.isOpen)f.db.close(); rmSync(f.dir,{recursive:true}); }
});
test('deployed REST export/import/export preserves exact int64, schema, migration ledger and redacted records', async () => {
  const f=fixture(); const target=new DatabaseSync(':memory:'); initialize(target);
  try {
    const source=sqliteTransport(f.db), destination=sqliteTransport(target);
    const first=await exportRemote(f.archive,source.query);
    assert.deepEqual(await importRemote(f.archive,destination.query),first);
    const second=join(f.dir,'second.json'); await exportRemote(second,destination.query);
    assert.equal(readFileSync(second,'utf8'),readFileSync(f.archive,'utf8'));
    const before=snapshot(target); const callCount=destination.calls.length;
    await assert.rejects(()=>importRemote(f.archive,destination.query),/contains application records/);
    assert.deepEqual(snapshot(target),before);
    assert.equal(destination.calls.length,callCount+1);
    assert.ok(destination.calls.at(-1).every(statement=>statement.sql.startsWith('SELECT')));
  } finally { f.db.close(); target.close(); rmSync(f.dir,{recursive:true}); }
});
test('atomic remote guard catches a concurrent writer and rolls back every restore statement', async () => {
  const f=fixture(), target=new DatabaseSync(':memory:'); initialize(target);
  try {
    f.db.close(); exportData(f.source,f.archive);
    const transport=sqliteTransport(target,(_batch,number)=>{if(number===2)target.prepare('INSERT INTO local_fixture_initializations VALUES(?,?)').run('concurrent-owner',stamp);});
    await assert.rejects(()=>importRemote(f.archive,transport.query));
    assert.equal(target.prepare('SELECT count(*) n FROM workspaces').get().n,0);
    assert.equal(target.prepare('SELECT count(*) n FROM local_fixture_initializations').get().n,1);
    assert.ok(JSON.parse(schema(target)).some(row=>row.type==='trigger'));
  } finally { if(f.db.isOpen)f.db.close(); target.close(); rmSync(f.dir,{recursive:true}); }
});
test('remote typed SQL carries full signed integers, finite reals, embedded null text and binary bytes', () => {
  const db=new DatabaseSync(':memory:'); db.exec('CREATE TABLE values_test(integer_value INTEGER, real_value REAL, text_value TEXT, blob_value BLOB)');
  try {
    const cells=[{type:'integer',value:'9223372036854775807'},{type:'real',value:1.25},{type:'text',value:'exact\u0000😀'},{type:'blob',value:'AP+ACg=='}];
    const statement=insertStatement({name:'values_test',columns:['integer_value','real_value','text_value','blob_value']},cells,value=>Buffer.from(value,'base64').toString('hex'));
    db.prepare(statement.sql).run(...statement.params);
    const row=db.prepare(readStatement({name:'values_test',columns:['integer_value','real_value','text_value','blob_value']}).sql).get();
    assert.deepEqual(readCells(row.cells),cells);
  } finally {db.close();}
});
test('invalid digest, typed cells and plaintext credentials are rejected before remote destination requests', async () => {
  const f=fixture();
  try {
    f.db.close();exportData(f.source,f.archive);const bytes=readFileSync(f.archive,'utf8');let calls=0;
    const query=async()=>{calls++;throw new Error('No request permitted');};
    const corrupt=JSON.parse(bytes);corrupt.payload.tables[0].rows.push([]);writeFileSync(f.archive,JSON.stringify(corrupt));
    await assert.rejects(()=>importRemote(f.archive,query));assert.equal(calls,0);
    for (const mutate of [
      archive => { const table=archive.payload.tables.find(table=>table.name==='local_dev_inbox');table.rows[0][table.columns.indexOf('magic_link_token')]={type:'text',value:'planted-unredacted-credential'}; },
      archive => { archive.payload.d1Migrations.rows[0][0]={type:'integer',value:'9223372036854775808'}; },
      archive => { archive.payload.d1Migrations.rows[0][0]={type:'blob',value:'not-base64'}; },
    ]) {
      const archive=JSON.parse(bytes);mutate(archive);archive.sha256=hash(JSON.stringify(archive.payload));writeFileSync(f.archive,JSON.stringify(archive));
      await assert.rejects(()=>importRemote(f.archive,query));assert.equal(calls,0);
    }
    writeFileSync(f.archive,'{"payload":null}');await assert.rejects(()=>importRemote(f.archive,query));assert.equal(calls,0);
  } finally {if(f.db.isOpen)f.db.close();rmSync(f.dir,{recursive:true});}
});
test('Cloudflare credentials are read only from explicit environment names and provider errors never escape', async () => {
  const token='planted-private-cloudflare-credential';
  const env={CLOUDFLARE_ACCOUNT_ID:'a'.repeat(32),CLOUDFLARE_DATABASE_ID:'11111111-1111-1111-1111-111111111111',CLOUDFLARE_API_TOKEN:token};
  let calls=0;
  const query=cloudflareClient(env,async(url,options)=>{calls++;assert.equal(new URL(url).origin,'https://api.cloudflare.com');assert.equal(options.headers.Authorization,`Bearer ${token}`);assert.equal(options.redirect,'error');return new Response(JSON.stringify({success:false,errors:[{message:token}]}),{status:403});});
  await assert.rejects(()=>query([{sql:'SELECT 1'}]),error=>!String(error).includes(token)&&error.recoveryCode==='PROVIDER_FAILURE');assert.equal(calls,1);
  assert.throws(()=>cloudflareClient({}),/CLOUDFLARE_ACCOUNT_ID/);
});

test('WAL export holds one snapshot while a second connection commits', () => {
  const f=fixture();let intercept;let writer;
  try {
    f.db.exec('PRAGMA journal_mode=WAL'); writer=new DatabaseSync(f.source);
    const original=DatabaseSync.prototype.prepare;let changed=false;
    intercept=mock.method(DatabaseSync.prototype,'prepare',function(sql){
      if(this===f.db && sql.startsWith('SELECT name FROM sqlite_schema') && !changed){changed=true;writer.prepare('INSERT INTO local_fixture_initializations VALUES(?,?)').run('later-commit',stamp);}
      return original.call(this,sql);
    });
    const archive=snapshot(f.db);
    assert.equal(changed,true);
    assert.equal(archive.payload.tables.find(table=>table.name==='local_fixture_initializations').rows.length,0);
    assert.equal(f.db.prepare('SELECT count(*) n FROM local_fixture_initializations').get().n,1);
  } finally {intercept?.mock.restore();writer?.close();f.db.close();rmSync(f.dir,{recursive:true});}
});
test('a failing restore batch rolls back data and schema, including temporarily removed triggers', async () => {
  const f=fixture(), target=new DatabaseSync(':memory:'); initialize(target);
  try {
    f.db.close(); exportData(f.source,f.archive);
    const before=snapshot(target), transport=sqliteTransport(target);
    const query=async batch=>transport.query(batch.some(row=>row.sql.startsWith('INSERT INTO'))?[...batch,{sql:"SELECT json('fail the transaction')"}]:batch);
    await assert.rejects(()=>importRemote(f.archive,query));
    assert.deepEqual(snapshot(target),before);
  } finally {if(f.db.isOpen)f.db.close();target.close();rmSync(f.dir,{recursive:true});}
});
test('extension classifications retain branding and mail facts while suppressing credentials and historical notification eligibility', async () => {
  const {sanitize}=await import('./deployment-data-policy.mjs');
  const text=value=>({type:'text',value}), integer=value=>({type:'integer',value:String(value)});
  const logo=Buffer.from([0,255,128,10]).toString('base64');
  const brand={name:'workspaces',columns:['id','brand_logo_base64','brand_logo_mime','brand_logo_version'],rows:[[text('workspace'),text(logo),text('image/png'),text('version')]]};
  assert.deepEqual(sanitize(brand),brand);
  assert.deepEqual(Buffer.from(sanitize(brand).rows[0][1].value,'base64'),Buffer.from([0,255,128,10]));
  for (const name of ['local_mail_outbox','rer_mail_development_outbox']) {
    const columns=name==='local_mail_outbox'?['delivery_id','message_json','created_at']:['id','message','created_at'];
    const result=sanitize({name,columns,rows:[[text('capture'),text('{"url":"https://example.test/?token=planted-private-token"}'),text(stamp)]]});
    assert.equal(result.rows.length,0);assert.equal(JSON.stringify(result).includes('planted-private-token'),false);
    assert.deepEqual(result.columns,columns);
  }
  for (const status of ['pending','sent','failed','unknown']) {
    const delivery={name:'notification_deliveries',columns:['id','status','idempotency_key','attempts'],rows:[[text('delivery'),text(status),text('fixed-key'),integer(3)]]};
    assert.deepEqual(sanitize(delivery),delivery);
  }
  for (const name of ['responses','response_outbox']) {
    const result=sanitize({name,columns:['id','notification_eligible'],rows:[[text('historic'),integer(1)]]});
    assert.deepEqual(result.rows,[[text('historic'),integer(0)]]);assert.deepEqual(sanitize(result),result);
  }
});
