import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, existsSync, writeFileSync, copyFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { recoveryCommand } from './deployment-data-cli.mjs';
import { kitDatabase, providerFetch, providerEnv, application } from './deployment-data-hosted-test-helpers.mjs';
import { hostedFixture } from './deployment-data-hosted-fixture.mjs';
import { snapshot, metadata, hash } from './deployment-data-core.mjs';
import { exportRemote, importRemote } from './deployment-data-remote.mjs';
import { sqliteTransport } from './deployment-data-test-helpers.mjs';

const directory=()=>mkdtempSync(join(process.env.PENCIL_VERIFICATION_TMPDIR??tmpdir(),'pencil-kit-recovery-'));

test('owner recovery command round-trips a kit-created installation filled through app routes, preserves custody and delivery, never revives sign-in authorization, refuses a second restore without writes', async () => {
  const dir=directory(), source=await kitDatabase(join(dir,'source.sqlite')), target=await kitDatabase(join(dir,'target.sqlite'));
  const network=[];
  const mail=mock.method(globalThis,'fetch',async(url,options)=>{assert.equal(String(url),'https://api.sendgrid.com/v3/mail/send');network.push(options.body);return new Response(null,{status:202,headers:{'X-Message-Id':'recovery-delivery'}});});
  // Provider pacing is a clock concern. All queries and app SQL still execute.
  let timers;
  try {
    const fixture=await hostedFixture(dir,source);
    // A respondent part-way through the form holds a resume credential.
    const respondent=await fixture.call('/api/public/flows/preserved-form/sessions',{deviceClass:'desktop'},201);
    const resume=()=>({sessionId:respondent.sessionId,sessionToken:respondent.sessionToken,stepId:respondent.flow.steps[0].id});
    await fixture.call('/api/public/flows/preserved-form/sessions/advance',resume(),204);
    // A respondent who completed the form holds a resume credential too.
    const finished=await fixture.call('/api/public/flows/preserved-form/sessions',{deviceClass:'desktop'},201);
    const submission={sessionId:finished.sessionId,sessionToken:finished.sessionToken,idempotencyKey:'completed-before-backup',answers:finished.flow.steps.filter(step=>step.kind==='question').map(step=>({stepId:step.id,value:step.questionType==='single_choice'?finished.flow.choices.find(choice=>choice.stepId===step.id).id:step.questionType==='long_text'?'Completed answer':5}))};
    await fixture.call('/api/public/flows/preserved-form/responses',submission,201);
    assert.ok(network.length>0);
    assert.ok(source.prepare("SELECT count(*) n FROM mail_deliveries WHERE status='sent'").get().n>0);
    timers=mock.method(globalThis,'setTimeout',(fn,_delay,...args)=>{queueMicrotask(()=>fn(...args));return {unref(){}};});
    const history=source.prepare('SELECT * FROM _rer_deploy_migrations ORDER BY name').all();
    assert.deepEqual(history.map(({name,sha256})=>({name,sha256})),metadata());
    assert.equal(source.prepare("SELECT count(*) n FROM sqlite_schema WHERE name='d1_migrations'").get().n,0);
    const archive=join(dir,'source.rer'), after=join(dir,'restored.rer'), older=join(dir,'before-erasure.rer');
    const sourceEdge=providerFetch(source), targetEdge=providerFetch(target);
    const command=(args,edge)=>recoveryCommand([...args,'--writers-stopped'],{env:providerEnv,fetch:edge.fetch});
    await command(['export','--output',older],sourceEdge);
    await fixture.call(`/api/app/responses/${fixture.erased}`,{},204,'DELETE');
    const exported=await command(['export','--output',archive],sourceEdge);
    const bytes=readFileSync(archive,'utf8'), original=JSON.parse(bytes);
    assert.equal(original.payload.d1Migrations.name,'_rer_deploy_migrations');
    assert.ok(source.prepare('SELECT epoch FROM restore_erasure_checkpoint').get().epoch>0);
    for(const table of ['ik_jobs','ik_provenance','ik_d1_erasure_journal','mail_deliveries','mail_delivery_attempts'])assert.ok(original.payload.tables.find(row=>row.name===table).rows.length>0,table);
    assert.equal(bytes.includes('Erased imported answer'),false);
    assert.ok(bytes.includes('Retained imported answer'));
    assert.equal(original.payload.tables.find(row=>row.name==='rer_mail_development_outbox').rows.length,0);
    for(const {token,opt_out_token} of source.prepare('SELECT token,opt_out_token FROM invitation_participants').all())for(const secret of [token,opt_out_token])if(secret)assert.equal(bytes.includes(secret),false);
    // Sign-in authorization never travels: the owner's live session and pending sign-in link stay behind.
    assert.ok(source.prepare('SELECT count(*) n FROM oa_sessions WHERE revoked_at IS NULL').get().n>0);
    assert.ok(source.prepare('SELECT count(*) n FROM oa_tokens').get().n>0);
    for(const table of ['oa_sessions','oa_tokens','oa_credentials','oa_step_up_challenges','oa_provider_sessions','oa_provider_session_pins','operator_sessions','auth_magic_links'])assert.equal(original.payload.tables.find(row=>row.name===table).rows.length,0,table);
    const respondentHash=source.prepare('SELECT session_token_hash h FROM respondent_sessions WHERE id=?').get(respondent.sessionId).h;
    assert.ok(respondentHash);assert.equal(bytes.includes(respondentHash),false);
    const completedHash=source.prepare('SELECT session_token_hash h FROM responses WHERE session_id=?').get(finished.sessionId).h;
    assert.ok(completedHash);assert.equal(bytes.includes(completedHash),false);
    assert.ok(original.payload.tables.find(row=>row.name==='respondent_sessions').rows.length>0);
    assert.ok(original.payload.tables.find(row=>row.name==='oa_operators').rows.length>0);
    assert.ok(original.payload.tables.find(row=>row.name==='audit_entries').rows.length>0);
    // The owner signs out after the backup; the saved cookie is refused from then on.
    const signedOut=fixture.app.cookie();
    assert.equal((await fixture.app.request('/auth/signout',{})).status,204);
    fixture.app.setCookie(signedOut);
    assert.equal((await fixture.app.request('/api/app/dashboard')).status,401);
    const before=readFileSync(join(dir,'target.sqlite'));
    await assert.rejects(command(['import','--input',older,'--journal',archive,'--yes'],targetEdge),{recoveryCode:'ERASURE_EPOCH'});
    assert.deepEqual(readFileSync(join(dir,'target.sqlite')),before);
    assert.equal(targetEdge.calls.length,0);
    const mailsBefore=network.length;
    assert.deepEqual(await command(['import','--input',archive,'--yes'],targetEdge),exported);
    assert.deepEqual(await command(['export','--output',after],targetEdge),exported);
    assert.equal(readFileSync(after,'utf8'),bytes);
    assert.deepEqual(target.prepare('SELECT * FROM _rer_deploy_migrations ORDER BY name').all(),history);
    assert.deepEqual(target.prepare('PRAGMA foreign_key_check').all(),[]);
    assert.equal(target.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
    assert.equal(target.prepare("SELECT slug FROM flows WHERE slug='preserved-form'").get().slug,'preserved-form');
    const restoredBytes=readFileSync(join(dir,'target.sqlite')), changes=target.prepare('SELECT total_changes() n').get().n;
    targetEdge.calls.length=0;
    await assert.rejects(command(['import','--input',archive,'--yes'],targetEdge),{recoveryCode:'NONEMPTY_TARGET'});
    assert.deepEqual(readFileSync(join(dir,'target.sqlite')),restoredBytes);
    assert.equal(target.prepare('SELECT total_changes() n').get().n,changes);
    assert.ok(targetEdge.calls.flat().every(row=>row.sql.startsWith('SELECT')));
    const restoredApp=await application(dir,target);
    await restoredApp.worker.scheduled({scheduledTime:Date.now()},restoredApp.bindings);
    assert.equal(network.length,mailsBefore);
    // Restored with the same SESSION_SECRET, the signed-out cookie stays refused; the owner signs in afresh by email.
    restoredApp.setCookie(signedOut);
    assert.equal((await restoredApp.request('/api/app/dashboard')).status,401);
    assert.equal((await restoredApp.request('/api/public/flows/preserved-form/sessions/advance',resume())).status,400);
    assert.equal((await restoredApp.request('/api/public/flows/preserved-form/responses',submission)).status,400);
    restoredApp.setCookie(undefined);
    timers.mock.restore();timers=undefined;
    assert.equal((await restoredApp.request('/auth/magic-link',{email:'owner@example.test'})).status,202);
    for(let i=0;i<100&&network.length===mailsBefore;i++)await new Promise(resolve=>setImmediate(resolve));
    assert.equal(network.length,mailsBefore+1);
    const link=/token=([A-Za-z0-9_-]{43})(?![A-Za-z0-9_-])/.exec(network.at(-1))[1];
    assert.equal((await restoredApp.request('/auth/confirm',{token:link})).status,303);
    assert.equal((await restoredApp.request('/api/app/dashboard')).status,200);
    // An archive that carries a session is refused before any write, even with a matching digest.
    const planted=structuredClone(original), sessions=planted.payload.tables.find(row=>row.name==='oa_sessions');
    sessions.rows.push(sessions.columns.map(column=>({type:'text',value:`planted-${column}`})));
    planted.sha256=hash(JSON.stringify(planted.payload));
    const plantedPath=join(dir,'planted.rer'), empty=await kitDatabase(join(dir,'empty.sqlite')), emptyEdge=providerFetch(empty);
    try {
      writeFileSync(plantedPath,JSON.stringify(planted)+'\n',{mode:0o600});
      await assert.rejects(command(['import','--input',plantedPath,'--yes'],emptyEdge),{recoveryCode:'LIVE_AUTHORIZATION'});
      assert.ok(emptyEdge.calls.flat().every(row=>row.sql.startsWith('SELECT')));
    } finally {empty.close();}
    const evidence=process.env.PENCIL_RECOVERY_EVIDENCE;
    if(evidence){mkdirSync(evidence,{recursive:true,mode:0o700});for(const file of ['source.rer','restored.rer','before-erasure.rer'])copyFileSync(join(dir,file),join(evidence,file));writeFileSync(join(evidence,'roundtrip.json'),JSON.stringify({exported,archiveBytes:Buffer.byteLength(bytes),semanticEquality:true,byteEquality:true,kitLedger:history,secondRestore:{code:'NONEMPTY_TARGET',databaseBytesUnchanged:true,totalChangesUnchanged:true,onlyReads:true},journalRefusal:'ERASURE_EPOCH',providerCalls:network.length,mailReplayed:0,sourceSnapshot:snapshot(source).sha256},null,2));}
  } finally {timers?.mock.restore();mail.mock.restore();source.close();target.close();rmSync(dir,{recursive:true});}
});

test('kit recovery refuses incomplete, uncertain, altered and mixed migration ledgers before archive publication or destination writes', async () => {
  const dir=directory(), source=await kitDatabase(':memory:');
  try {
    // Empty source still exercises the ledger contract independently of app data.
    const archive=join(dir,'valid.rer'); await exportRemote(archive,sqliteTransport(source).query);
    for(const sql of ["DELETE FROM _rer_deploy_migrations WHERE name=(SELECT max(name) FROM _rer_deploy_migrations)","UPDATE _rer_deploy_migrations SET state='applying' WHERE name=(SELECT min(name) FROM _rer_deploy_migrations)","UPDATE _rer_deploy_migrations SET sha256='altered' WHERE name=(SELECT min(name) FROM _rer_deploy_migrations)","ALTER TABLE _rer_deploy_migrations ADD COLUMN metadata TEXT", "ALTER TABLE _rer_deploy_migrations RENAME TO old_history; CREATE TABLE _rer_deploy_migrations(name TEXT PRIMARY KEY,sha256 TEXT NOT NULL,state TEXT NOT NULL); INSERT INTO _rer_deploy_migrations SELECT * FROM old_history; DROP TABLE old_history","CREATE TABLE d1_migrations(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT UNIQUE,applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL)"]){
      const db=await kitDatabase(':memory:');
      try {db.exec(sql);const prior=db.prepare('SELECT total_changes() n').get().n,edge=sqliteTransport(db),out=join(dir,'refused.rer');
        await assert.rejects(exportRemote(out,edge.query),{recoveryCode:'MIGRATION_MISMATCH'});assert.equal(existsSync(out),false);
        await assert.rejects(importRemote(archive,edge.query));assert.equal(db.prepare('SELECT total_changes() n').get().n,prior);
      }finally{db.close();}
    }
  }finally{source.close();rmSync(dir,{recursive:true});}
});
