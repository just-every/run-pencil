import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { initialize, importData, exportData, exportRemote, importRemote } from './deployment-data.mjs';
import { fixture, sqliteTransport, stamp } from './deployment-data-test-helpers.mjs';
test('fully migrated install roundtrips provider receipts, immutable import publication times, branding, Base ownership and kit provenance', async () => {
  const claim = {singleton:1,jti:'synthetic-consumed-claim',installation_id:'synthetic-installation',email:'operator@example.test',issued_at:100,expires_at:300,consumed_at:200,operator_id:'operator',session_id:'native-session',completed:1};
  const f=fixture(db=>{
    db.prepare('INSERT INTO oc_owner_claims('+Object.keys(claim).join(',')+') VALUES('+Object.keys(claim).map(()=>'?').join(',')+')').run(...Object.values(claim));
    db.prepare('INSERT INTO oa_bootstrap VALUES(1,?,?)').run(claim.jti,claim.consumed_at);
  }); const restored=new DatabaseSync(':memory:'); initialize(restored);
  const insert=(table,row)=>f.db.prepare(`INSERT INTO ${table} (${Object.keys(row).join(',')}) VALUES (${Object.keys(row).map(()=>'?').join(',')})`).run(...Object.values(row));
  const logo=Buffer.from(Array.from({length:256},(_,index)=>index));
  try {
    insert('oa_sessions',{id:claim.session_id,token_hash:'synthetic-session-digest',operator_id:claim.operator_id,operator_version:1,kind:'native',created_at:200,expires_at:300});
    f.db.prepare('UPDATE workspaces SET brand_configured=1,brand_logo_base64=?,brand_logo_mime=?,brand_logo_version=?').run(logo.toString('base64'),'image/png','stored-logo');
    insert('rer_mail_development_outbox',{id:'capture',created_at:Date.now(),message:JSON.stringify({text:'planted-base-outbox-private-token'})});
    insert('flows',{id:'flow',workspace_id:'workspace',slug:'restored-flow',title:'Restored',status:'closed',draft_version:1,last_activity_at:stamp,created_at:stamp,updated_at:stamp});
    insert('flow_revisions',{id:'revision',flow_id:'flow',number:1,state:'published',title:'Restored',created_at:stamp,updated_at:stamp});
    insert('form_import_targets',{target_id:'target',workspace_id:'workspace',kind:'form',revision:'1',flow_id:'flow'});
    const committed=f.db.prepare('SELECT committed_at FROM form_import_targets').get().committed_at;
    assert.notEqual(committed,stamp);
    insert('form_import_revisions',{revision_id:'revision',flow_id:'flow',source_digest:'source-digest',mapping_version:'1'});
    insert('notification_preferences',{flow_id:'flow',operator_id:'operator',mode:'immediately',updated_at:stamp});
    for(const status of ['pending','sent','failed','unknown']) {
      insert('responses',{id:`response-${status}`,workspace_id:'workspace',flow_id:'flow',revision_id:'revision',session_id:`session-${status}`,session_token_hash:`hash-${status}`,idempotency_key:`receipt-${status}`,state:'released',completed_at:stamp,created_at:stamp,updated_at:stamp,notification_eligible:1});
      insert('response_outbox',{id:`effect-${status}`,workspace_id:'workspace',response_id:`response-${status}`,kind:'response.completed',idempotency_key:`effect-key-${status}`,payload_json:'{}',status:'pending',available_at:stamp,created_at:stamp,updated_at:stamp,notification_eligible:1});
      insert('notification_deliveries',{id:`delivery-${status}`,response_id:`response-${status}`,operator_id:'operator',status,idempotency_key:`delivery-key-${status}`,attempts:2,available_at:stamp,provider:'sendgrid',provider_code:'RATE_LIMITED',created_at:stamp,updated_at:stamp});
      insert('notification_attempts',{id:`attempt-${status}`,delivery_id:`delivery-${status}`,ordinal:2,event:status,provider:'sendgrid',provider_code:'RATE_LIMITED',created_at:stamp});
    }
    insert('ik_jobs',{id:'job',destination:'forms',namespace:'import',mapping_version:'1',principal_id:'operator',fingerprint:'fingerprint',operation_key:'operation',plan_json:'{}',state:'committed',checkpoint:1,total:1,fence:1,lease_token:'planted-private-lease',lease_expires:100});
    insert('ik_original_sets',{job_id:'job',version:1});
    insert('ik_originals',{job_id:'job',kind:'source',original_key:'original',name:'source.json',sha256:'source-digest',size:24,bytes:Buffer.from('planted-private-original')});
    insert('ik_sources',{identity:'source',source_hash:'source-digest',mapping_version:'1',effects_hash:'effects',job_id:'job'});
    insert('ik_provenance',{id:'provenance',job_id:'job',ordinal:0,effect_ordinal:0,source_identity:'source',destination:'forms',target_kind:'form',target_id:'target',record_json:'{}'});
    insert('ik_targets',{destination:'forms',kind:'form',id:'target',revision:'1',value_json:'{}'});
    insert('ik_batches',{job_id:'job',action:'commit',position:0,end_position:1,fence:1});
    insert('ik_d1_entries',{job_id:'job',ordinal:0,source_identity:'source',owner_job_id:'job',effects_hash:'effects'});
    const source=sqliteTransport(f.db),destination=sqliteTransport(restored);
    const first=await exportRemote(f.archive,source.query);
    await importRemote(f.archive,destination.query);
    assert.deepEqual(await exportRemote(join(f.dir,'second.json'),destination.query),first);
    importData(f.archive,f.target);assert.deepEqual(exportData(f.target,join(f.dir,'local.json')),first);
    assert.equal(readFileSync(f.archive,'utf8'),readFileSync(join(f.dir,'local.json'),'utf8'));
    for(const value of ['planted-base-outbox-private-token','planted-private-lease','planted-private-original'])assert.equal(readFileSync(f.archive,'utf8').includes(value),false);
    assert.equal(restored.prepare('SELECT committed_at FROM form_import_targets').get().committed_at,committed);
    assert.throws(()=>restored.prepare('UPDATE form_import_targets SET committed_at=?').run(stamp),/immutable/);
    assert.deepEqual(Buffer.from(restored.prepare('SELECT brand_logo_base64 FROM workspaces').get().brand_logo_base64,'base64'),logo);
    assert.equal(restored.prepare('SELECT count(*) n FROM rer_mail_development_outbox').get().n,0);
    assert.equal(restored.prepare('SELECT count(*) n FROM responses WHERE notification_eligible<>0').get().n,0);
    assert.equal(restored.prepare('SELECT count(*) n FROM response_outbox WHERE notification_eligible<>0').get().n,0);
    assert.deepEqual(restored.prepare('SELECT status,attempts,provider,provider_code FROM notification_deliveries ORDER BY status').all().map(row=>({...row})),['failed','pending','sent','unknown'].map(status=>({status,attempts:2,provider:'sendgrid',provider_code:'RATE_LIMITED'})));
    assert.equal(restored.prepare('SELECT count(*) n FROM notification_attempts WHERE provider=? AND provider_code=?').get('sendgrid','RATE_LIMITED').n,4);
    assert.equal(restored.prepare('SELECT count(*) n FROM ik_provenance').get().n,1);
    assert.equal(restored.prepare('SELECT bytes FROM ik_originals').get().bytes,null);
    assert.deepEqual({...restored.prepare('SELECT * FROM oc_owner_claims').get()},claim);
    assert.equal(restored.prepare('SELECT role FROM oa_operators WHERE id=?').get(claim.operator_id).role,'owner');
    assert.throws(()=>restored.prepare('INSERT INTO oc_owner_claims(singleton,jti,installation_id,email,issued_at,expires_at,consumed_at,operator_id,session_id) VALUES(1,?,?,?,?,?,?,?,?)').run('another','synthetic-installation',claim.email,100,300,200,'another','another'),/owner_claim_already_initialized/);
  } finally {f.db.close();restored.close();rmSync(f.dir,{recursive:true});}
});
test('unchanged Base development viewer reads a restored install without invalid capture messages', async () => {
  const {createD1DevelopmentOutbox,createDevelopmentOutboxHandler}=await import('../src/base/mail/src/development/index.mjs');
  const f=fixture();let db;
  try {
    f.db.prepare('INSERT INTO rer_mail_development_outbox(id,created_at,message) VALUES(?,?,?)').run('captured',Date.now(),JSON.stringify({from:'sender@example.test',to:['operator@example.test'],subject:'Private',text:'planted-auth-link'}));
    f.db.close();exportData(f.source,f.archive);importData(f.archive,f.target);db=new DatabaseSync(f.target);
    const transport=sqliteTransport(db);
    const adapter={prepare(sql){return{bind(...params){return{sql,params}}}},batch:transport.query};
    const handler=createDevelopmentOutboxHandler({local:true,origin:'http://localhost:15621',outbox:createD1DevelopmentOutbox({db:adapter})});
    const response=await handler(new Request('http://localhost:15621/__dev/outbox',{headers:{Host:'localhost:15621'}}));
    assert.equal(response.status,200);const body=await response.text();assert.match(body,/No messages yet/);assert.equal(body.includes('planted-auth-link'),false);
  } finally {if(f.db.isOpen)f.db.close();db?.close();rmSync(f.dir,{recursive:true});}
});
