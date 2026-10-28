import { test } from 'node:test';

test('[DATA-001,BASE-DATA-001,IMPORT-004,BASE-OPS-003,LEDG-006,PAY-001] whole-data delivery recovery retains exact product custody and never replays restored capabilities', async () => {
  // deployment-data-custody-replay: retain its complete restoration workload and assertions.
  try {
    await (async () => {
      const assert = (await import('node:assert/strict')).default;
      const { DatabaseSync } = await import('node:sqlite');
      const { readFileSync, rmSync } = await import('node:fs');
      const { join } = await import('node:path');
      const { initialize, snapshot, validate, populate, schema, canonicalDatabaseSchema } = await import('./deployment-data-core.mjs');
      const { exportData, importData, restoreData } = await import('./deployment-data.mjs');
      const { exportRemote, importRemote } = await import('./deployment-data-remote.mjs');
      const { fixture, sqliteTransport } = await import('./deployment-data-test-helpers.mjs');
      const { sqliteD1 } = await import('./custody-test-transport.mjs');
      const { custodyGraph } = await import('./custody-test-graph.mjs');
      const { verifyCustodyReadback, custodyTriggerCanaries } = await import('./custody-test-canaries.mjs');
      const { custodySignIn } = await import('./custody-test-targets.mjs');
      const { savedReportCustody } = await import('./custody-test-saved-reports.mjs');
      await (async () => {
        const f = fixture(), core = new DatabaseSync(':memory:'), remote = new DatabaseSync(':memory:'), target = new DatabaseSync(':memory:');
        let file;
        try {
          f.db.exec('PRAGMA foreign_keys=ON');
          const graph = await custodyGraph(sqliteD1(f.db));
          const reports = await savedReportCustody(sqliteD1(f.db), graph.actor);
          const expected = snapshot(f.db), originalSchema = schema(f.db);
          assert.deepEqual(validate(expected), expected);
          initialize(core); populate(core, expected);
          assert.deepEqual(snapshot(core), expected);
          exportData(f.source, f.archive);
          const archived = readFileSync(f.archive, 'utf8');
          for (const secret of reports.secrets) assert.equal(archived.includes(secret), false);
          importData(f.archive, f.target); file = new DatabaseSync(f.target);
          assert.deepEqual(snapshot(file), expected);
          initialize(remote); remote.exec('PRAGMA foreign_keys=ON');
          const deployed = join(f.dir, 'deployed.json');
          await exportRemote(deployed, sqliteTransport(f.db).query);
          await reports.revoke();
          await importRemote(deployed, sqliteTransport(remote).query);
          assert.deepEqual(snapshot(remote), expected);
          for (const database of [core, file, remote]) {
            assert.equal(canonicalDatabaseSchema(database), originalSchema);
            assert.equal(database.prepare('PRAGMA foreign_key_check').get(), undefined);
            await custodySignIn(sqliteD1(database), graph.actor);
            await reports.readback(sqliteD1(database));
            await verifyCustodyReadback(sqliteD1(database), graph);
            await custodyTriggerCanaries(sqliteD1(database), graph);
          }
          const sourceBytes = readFileSync(f.source);
          assert.throws(() => restoreData(f.archive, f.source), /contains application records/);
          assert.deepEqual(readFileSync(f.source), sourceBytes);
          initialize(target); target.prepare('INSERT INTO local_fixture_initializations VALUES(?,?)').run('already-owned', '2026-10-01T00:00:00Z');
          const before = snapshot(target), transport = sqliteTransport(target);
          await assert.rejects(importRemote(f.archive, transport.query), /contains application records/);
          assert.deepEqual(snapshot(target), before);
          assert.ok(transport.calls.flat().every(statement => statement.sql.startsWith('SELECT')));
          target.exec('ALTER TABLE ik_d1_staging ADD COLUMN unreviewed_value TEXT');
          const prior = target.prepare('SELECT total_changes() n').get().n, invalid = sqliteTransport(target);
          await assert.rejects(importRemote(f.archive, invalid.query));
          assert.equal(target.prepare('SELECT total_changes() n').get().n, prior);
          assert.ok(invalid.calls.flat().every(statement => statement.sql.startsWith('SELECT')));
        } finally { core.close(); remote.close(); file?.close(); target.close(); f.db.close(); rmSync(f.dir, { recursive: true }); }
      })();
    })();
  } catch (cause) { throw new Error('deployment-data-custody-replay', { cause }); }
  // deployment-data-install: retain its complete restoration workload and assertions.
  try {
    await (async () => {
      const assert = (await import('node:assert/strict')).default;
      const { DatabaseSync } = await import('node:sqlite');
      const { readFileSync, rmSync } = await import('node:fs');
      const { join } = await import('node:path');
      const { initialize, importData, exportData, exportRemote, importRemote } = await import('./deployment-data.mjs');
      const { fixture, sqliteTransport, stamp } = await import('./deployment-data-test-helpers.mjs');
      await (async () => {
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
      })();
    })();
  } catch (cause) { throw new Error('deployment-data-install', { cause }); }
  // deployment-data-notification: retain its complete restoration workload and assertions.
  try {
    await (async () => {
      const assert = (await import('node:assert/strict')).default;
      const { DatabaseSync } = await import('node:sqlite');
      const { rmSync } = await import('node:fs');
      const { initialize, snapshot, validate, populate } = await import('./deployment-data-core.mjs');
      const { exportRemote, importRemote } = await import('./deployment-data-remote.mjs');
      const { fixture, sqliteTransport, stamp } = await import('./deployment-data-test-helpers.mjs');
      await (async () => {
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
      })();
    })();
  } catch (cause) { throw new Error('deployment-data-notification', { cause }); }
  // deployment-data-reporting: retain its complete restoration workload and assertions.
  try {
    await (async () => {
      const assert = (await import('node:assert/strict')).default;
      const { DatabaseSync } = await import('node:sqlite');
      const { rmSync } = await import('node:fs');
      const { join } = await import('node:path');
      const { initialize, snapshot, migrations } = await import('./deployment-data.mjs');
      const { unstable_splitSqlQuery } = await import('wrangler');
      const { exportRemote, importRemote } = await import('./deployment-data-remote.mjs');
      const { fixture, sqliteTransport, stamp } = await import('./deployment-data-test-helpers.mjs');
      await (async () => {
        const f=fixture(),target=new DatabaseSync(':memory:');initialize(target);
        try {
          const deployed=new DatabaseSync(':memory:');
          try {
            for(const migration of migrations()) for(const statement of unstable_splitSqlQuery(migration.sql)) deployed.exec(statement);
            const triggers=db=>db.prepare("SELECT name,sql FROM sqlite_schema WHERE type='trigger' ORDER BY name").all();
            assert.deepEqual(triggers(deployed),triggers(target));
          } finally {deployed.close();}
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
      })();
    })();
  } catch (cause) { throw new Error('deployment-data-reporting', { cause }); }
  // distribution-data: retain its complete restoration workload and assertions.
  try {
    await (async () => {
      const assert = (await import('node:assert/strict')).default;
      const { DatabaseSync } = await import('node:sqlite');
      const { mkdtempSync, readFileSync, rmSync } = await import('node:fs');
      const { join } = await import('node:path');
      const { tmpdir } = await import('node:os');
      const { initialize, exportData, importData } = await import('./deployment-data.mjs');
      await (() => {
        const directory = mkdtempSync(join(process.env.PENCIL_VERIFICATION_TMPDIR ?? tmpdir(), 'pencil-distribution-data-'))
        const source = join(directory, 'source.sqlite'), archive = join(directory, 'data.json'), target = join(directory, 'target.sqlite')
        const db = new DatabaseSync(source)
        const stamp = '2026-10-06T00:00:00.000Z'
        const insert = (table, values) => db.prepare(`INSERT INTO ${table} (${Object.keys(values).join(',')}) VALUES (${Object.keys(values).map(() => '?').join(',')})`).run(...Object.values(values))
        try {
          initialize(db)
          insert('workspaces', { id: 'w', name: 'Synthetic archive', time_zone: 'UTC', created_at: stamp, updated_at: stamp })
          insert('flows', { id: 'f', workspace_id: 'w', title: 'Archive flow', slug: 'archive-flow', status: 'open', draft_version: 1, last_activity_at: stamp, created_at: stamp, updated_at: stamp })
          const formSettings=JSON.stringify({access:{id:'access-rule',mode:'password'},identityMode:'anonymous',calculations:[{id:'label',name:'Campaign label',type:'text',expression:{kind:'hidden',fieldId:'campaign'}}],hiddenFields:[{id:'campaign',name:'utm_campaign',type:'text',category:'campaign'}]})
          const responseContext=JSON.stringify({hidden:{campaign:'spring'},calculations:{label:'spring'},discarded:1,identityMode:'anonymous'})
          insert('flow_revisions', { form_settings_json:formSettings, id: 'r', flow_id: 'f', number: 1, state: 'published', title: 'Archive flow', is_current: 1, created_at: stamp, updated_at: stamp })
          const prompt = 'Exact\u0000 text 😀'
          insert('flow_steps', { id: 'question-row', revision_id: 'r', position: 0, kind: 'question', question_type: 'long_text', prompt, required: 1, stable_id: 'stable-question', created_at: stamp, updated_at: stamp })
          const conditionTree = {kind:'group',join:'and',conditions:[{kind:'test',stepId:'stable-question',operator:'is_answered'}]}
          insert('flow_branch_rules', {id:'condition-rule',revision_id:'r',source_step_stable_id:'stable-question',predicate_kind:'equals',expected_value_json:'null',condition_json:JSON.stringify(conditionTree),destination_step_stable_id:'historical-end',position:0,created_at:stamp,updated_at:stamp})
          insert('distribution_contacts', { id: 'c', workspace_id: 'w', email: 'synthetic@example.test', name: 'Synthetic recipient', time_zone: 'America/New_York', fields_json: JSON.stringify({team:'Archive field'}), created_at: stamp, updated_at: stamp })
          insert('invitation_launches', { id: 'l', workspace_id: 'w', revision_id: 'r', command_key: 'synthetic-command', policy_json: JSON.stringify({reminderDelayHours:48,'flow.reminder-schedule.v1':{delayHours:48},'flow.audience-eligibility.v1':{excludePreviouslyInvitedToFlow:false},participantIds:['p']}), resume_enabled:1, actor_operator_id: 'historical-erased-actor', created_at: stamp })
          insert('distribution_segments',{id:'segment',workspace_id:'w',name:'Archive segment',rules_json:JSON.stringify([{field:'custom',key:'team',operator:'is',value:'Archive field'}]),created_at:stamp,updated_at:stamp})
          insert('invitation_candidates',{id:'p',launch_id:'l',contact_id:'c',email_snapshot:'synthetic@example.test',name_snapshot:'Original name',outcome:'invited'})
          insert('invitation_participants', { id: 'p', launch_id: 'l', workspace_id: 'w', revision_id: 'r', contact_id: 'c', email_snapshot: 'synthetic@example.test', name_snapshot: 'Original name', token: 'synthetic-invitation-bearer', opt_out_token: 'synthetic-optout-bearer', delivery_status: 'unknown', response_status: 'completed', completion_step_id: 'historical-end', completed_at: stamp, created_at: stamp })
          insert('mail_deliveries', { id: 'd', participant_id: 'p', kind: 'invitation', status: 'unknown', idempotency_key: 'invitation:p', available_at: stamp, attempts: 1, first_attempt_at: stamp, last_attempt_at: stamp, reason: 'Synthetic unknown outcome', created_at: stamp, updated_at: stamp })
          for (const event of ['started', 'unknown']) insert('mail_delivery_attempts', { id: `attempt-${event}`, delivery_id: 'd', ordinal: 1, event, reason: event === 'unknown' ? 'Synthetic timeout' : null, created_at: stamp })
          insert('contact_consent_events', { id: 'consent', contact_id: 'c', workspace_id: 'w', consent: 'renewed', actor: 'historical-actor', source: 'Explicit synthetic permission', created_at: stamp })
          insert('responses', {notification_eligible:0,response_context_json:responseContext, id: 'response', workspace_id: 'w', flow_id: 'f', revision_id: 'r', session_id: 'removed-session', session_token_hash: 'synthetic-hash', idempotency_key: 'synthetic-response-key', state: 'quarantined', quarantine_reason: 'minimum-fill-time', completed_at: stamp, created_at: stamp, updated_at: stamp, source: 'invitation', started_at: stamp, participant_id: 'p' })
          const savedAnswers = JSON.stringify([{stepId:'stable-question',value:'A private saved answer'}])
          insert('respondent_saves', {response_context_json:responseContext,session_id:'saved-session',revision_id:'r',token_hash:'synthetic-resume-hash',command_key:'save-command',delivery_id:'resume:saved-session:save-command',delivery_email:'resume-only@example.test',delivery_state:'sending',current_step_id:'stable-question',answers_json:savedAnswers,expires_at:'2026-11-06T00:00:00.000Z',created_at:stamp,updated_at:stamp})
          insert('form_retention',{flow_id:'f',days:30,legal_hold:1,version:1,change_id:'retention-change',created_at:stamp,updated_at:stamp})
          for(const [kind,item_id] of [['response','response'],['save','saved-session']])insert('retention_notices',{flow_id:'f',kind,item_id,policy_version:1,notified_at:stamp,delete_after:'2026-11-06T00:00:00.000Z'})
          const value = JSON.stringify('CAFE\u0301 Straße · Original\n"quoted", =literal 😀\u0000')
          insert('response_answers', { id: 'answer', response_id: 'response', step_id: 'stable-question', value_json: value, created_at: stamp, updated_at: stamp })
          insert('form_access_rules',{id:'access-rule',flow_id:'f',mode:'password',password_verifier:'synthetic-private-verifier',domains_json:'[]',emails_json:'[]',created_at:stamp})
          insert('access_challenges',{id:'access-code',rule_id:'access-rule',revision_id:'r',email:'code-only@example.test',code_hash:'synthetic-code-hash',expires_at:'2026-11-06T00:00:00.000Z',created_at:stamp,delivery_state:'sent'})
          insert('response_access',{response_id:'response',flow_id:'f',email:'verified@example.test',subject:null})
          // PAY-001: the payment step, the response's paid state and its Stripe IDs travel; the live checkout link, the
          // respondent's return key and the sealed Stripe key and signing secret do not.
          const pricing = JSON.stringify({payment:{products:[],options:[],calculationId:'label',minimum:100,maximum:100000}})
          insert('flow_steps', { id: 'payment-row', revision_id: 'r', position: 1, kind: 'payment', prompt: 'Pay for the order', required: 0, stable_id: 'stable-payment', question_settings_json: pricing, created_at: stamp, updated_at: stamp })
          insert('response_payments', { response_id: 'response', step_id: 'stable-payment', completion_step_id: 'historical-end', provider: 'stripe', livemode: 0, state: 'paid', attempt: 2, amount: 6400, currency: 'usd', lines_json: JSON.stringify([{name:'Pay for the order',unitAmount:6400,quantity:1}]), checkout_session_id: 'cs_test_archive', checkout_url: 'https://checkout.stripe.com/c/pay/cs_test_archive', checkout_expires_at: stamp, payment_intent_id: 'pi_test_archive', provider_amount: 6400, return_token_hash: 'synthetic-return-hash', state_changed_at: stamp, created_at: stamp, updated_at: stamp })
          insert('payment_events', { id: 'evt_test_archive', type: 'checkout.session.completed', response_id: 'response', outcome: 'applied', created_at: stamp, received_at: stamp })
          insert('integration_connections', { kind: 'payment', sealed: 'synthetic-sealed-stripe-key', updated_at: stamp })
          db.close()
          assert.equal(readFileSync(source).includes('synthetic-sealed-stripe-key'), true)
          const summary = exportData(source, archive)
          assert.deepEqual(importData(archive, target), summary)
          const second = join(directory, 'second.json')
          assert.deepEqual(exportData(target, second), summary)
          assert.equal(readFileSync(archive, 'utf8'), readFileSync(second, 'utf8'))
          const saved=JSON.parse(readFileSync(second,'utf8')).payload.tables.find(table=>table.name==='flow_steps')
          assert.equal(saved.rows.find(row=>row[saved.columns.indexOf('id')].value==='question-row')[saved.columns.indexOf('prompt')].value,prompt)
          const restored = new DatabaseSync(target)
          try {
            assert.deepEqual({...restored.prepare('SELECT days,legal_hold,version FROM form_retention WHERE flow_id=?').get('f')},{days:30,legal_hold:1,version:1})
            assert.deepEqual(restored.prepare('SELECT kind,item_id,policy_version,notified_at,delete_after FROM retention_notices ORDER BY kind').all().map(row=>({...row})),[['response','response'],['save','saved-session']].map(([kind,item_id])=>({kind,item_id,policy_version:1,notified_at:stamp,delete_after:'2026-11-06T00:00:00.000Z'})))
            assert.equal(restored.prepare('SELECT password_verifier FROM form_access_rules').get().password_verifier,null)
            assert.equal(restored.prepare('SELECT count(*) AS n FROM access_challenges').get().n,0)
            assert.equal(restored.prepare('SELECT email FROM response_access').get().email,'verified@example.test')
            assert.equal(restored.prepare('SELECT form_settings_json FROM flow_revisions').get().form_settings_json,formSettings)
            assert.equal(restored.prepare('SELECT response_context_json FROM responses').get().response_context_json,responseContext)
            assert.equal(restored.prepare('SELECT response_context_json FROM respondent_saves').get().response_context_json,responseContext)
            assert.deepEqual(JSON.parse(restored.prepare('SELECT condition_json FROM flow_branch_rules WHERE id=\'condition-rule\'').get().condition_json),conditionTree)
            assert.equal(restored.prepare('SELECT time_zone FROM distribution_contacts').get().time_zone,'America/New_York')
            assert.equal(restored.prepare('SELECT fields_json FROM distribution_contacts').get().fields_json,JSON.stringify({team:'Archive field'}))
            assert.deepEqual({...restored.prepare('SELECT token,opt_out_token FROM invitation_participants').get()},{token:null,opt_out_token:null})
            assert.equal(restored.prepare('SELECT resume_enabled FROM invitation_launches').get().resume_enabled,0)
            assert.equal(restored.prepare('SELECT count(*) n FROM distribution_segments').get().n,1)
            assert.equal(restored.prepare('SELECT count(*) n FROM invitation_candidates').get().n,1)
            assert.equal(restored.prepare('SELECT value_json FROM response_answers').get().value_json, value)
            assert.equal(restored.prepare("SELECT response_id FROM response_search_values WHERE instr(value,?)>0").get('café strasse').response_id,'response')
            assert.deepEqual({ ...restored.prepare('SELECT r.state, r.participant_id, p.contact_id, d.status FROM responses r JOIN invitation_participants p ON p.id=r.participant_id JOIN mail_deliveries d ON d.participant_id=p.id').get() }, { state: 'quarantined', participant_id: 'p', contact_id: 'c', status: 'unknown' })
            assert.deepEqual({...restored.prepare('SELECT token_hash,delivery_email,answers_json FROM respondent_saves').get()},{token_hash:null,delivery_email:null,answers_json:savedAnswers})
            assert.equal(restored.prepare("SELECT count(*) n FROM audit_entries WHERE kind='response.resume-requested'").get().n,1)
            assert.equal(restored.prepare('SELECT count(*) n FROM rer_mail_development_outbox').get().n,0)
            assert.deepEqual({...restored.prepare('SELECT kind,question_settings_json FROM flow_steps WHERE id=?').get('payment-row')},{kind:'payment',question_settings_json:pricing})
            assert.deepEqual({...restored.prepare('SELECT state,attempt,amount,checkout_session_id,payment_intent_id,provider_amount,checkout_url,return_token_hash FROM response_payments').get()},{state:'paid',attempt:2,amount:6400,checkout_session_id:'cs_test_archive',payment_intent_id:'pi_test_archive',provider_amount:6400,checkout_url:null,return_token_hash:null})
            assert.deepEqual({...restored.prepare('SELECT id,response_id,outcome FROM payment_events').get()},{id:'evt_test_archive',response_id:'response',outcome:'applied'})
            assert.equal(restored.prepare('SELECT count(*) n FROM integration_connections').get().n,0)
            assert.equal(readFileSync(archive,'utf8').includes('synthetic-sealed-stripe-key')||readFileSync(archive,'utf8').includes('synthetic-return-hash')||readFileSync(archive,'utf8').includes('checkout.stripe.com'),false)
            assert.deepEqual(restored.prepare('PRAGMA foreign_key_check').all(), [])
          } finally { restored.close() }
        } finally { if (db.isOpen) db.close(); rmSync(directory, { recursive: true, force: true }) }
      })();
    })();
  } catch (cause) { throw new Error('distribution-data', { cause }); }
  // action-data: retain its complete restoration workload and assertions.
  try {
    await (async () => {
      const assert = (await import('node:assert/strict')).default;
      const { createServer } = await import('node:http');
      const { DatabaseSync } = await import('node:sqlite');
      const { mkdtempSync, readFileSync, rmSync } = await import('node:fs');
      const { join } = await import('node:path');
      const { tmpdir } = await import('node:os');
      const { initialize, exportData, importData } = await import('./deployment-data.mjs');
      await (async () => {
        const directory = mkdtempSync(join(process.env.PENCIL_VERIFICATION_TMPDIR ?? tmpdir(), 'pencil-action-data-'))
        const source = join(directory, 'source.sqlite'), archive = join(directory, 'data.json'), target = join(directory, 'target.sqlite')
        const db = new DatabaseSync(source)
        const stamp = '2026-10-12T00:00:00.000Z'
        const insert = (table, values) => db.prepare(`INSERT INTO ${table} (${Object.keys(values).join(',')}) VALUES (${Object.keys(values).map(() => '?').join(',')})`).run(...Object.values(values))
        // A listening receiver on loopback, as a deployment's task receiver would be: restoring must not reach it.
        const requests = []
        const receiver = createServer((request, response) => { requests.push(request.url); response.writeHead(500).end() })
        await new Promise(resolve => receiver.listen(0, '127.0.0.1', resolve))
        try {
          initialize(db)
          insert('workspaces', { id: 'w', name: 'Action archive', time_zone: 'UTC', created_at: stamp, updated_at: stamp })
          insert('operators', { id: 'o', workspace_id: 'w', email: 'owner@example.test', display_name: 'Owner', is_setup_operator: 1, created_at: stamp, updated_at: stamp })
          insert('flows', { id: 'f', workspace_id: 'w', title: 'Visit', slug: 'visit', status: 'open', draft_version: 1, last_activity_at: stamp, created_at: stamp, updated_at: stamp })
          insert('flow_revisions', { id: 'r', flow_id: 'f', number: 1, state: 'published', title: 'Visit', is_current: 1, created_at: stamp, updated_at: stamp })
          const action = { id: 'a', workspace_id: 'w', title: 'Shorten the wait 😀', rationale: 'Exact\n"text", =literal', owner_operator_id: 'o', state: 'in_progress', verdict: null, review_date: '2026-12-01', source: 'manual', analysis_id: null,
            metric_name: 'Short waits', metric_unit: 'percent', metric_direction: 'increase', baseline_value: 33.5, baseline_source: 'Revision 1', baseline_observed_at: stamp, version: 2, last_event_id: 'e2', created_by_operator_id: 'o', created_at: stamp, updated_at: stamp }
          insert('actions', action)
          insert('action_evidence', { action_id: 'a', flow_id: 'f', revision_id: 'r', question_stable_id: 'q', figures_json: JSON.stringify({ flowTitle: 'Visit', revisionNumber: 1, completedResponses: 3, starts: 4 }), captured_at: stamp })
          insert('action_events', { id: 'e1', action_id: 'a', kind: 'created', from_state: null, to_state: 'planned', note: null, changes_json: null, operator_id: 'o', created_at: stamp })
          insert('action_events', { id: 'e2', action_id: 'a', kind: 'transition', from_state: 'planned', to_state: 'in_progress', note: 'Started', changes_json: null, operator_id: 'o', created_at: stamp })
          insert('action_measurements', { id: 'm', action_id: 'a', flow_id: 'f', revision_id: 'r', observed_value: 52, unit: 'percent', observed_at: stamp, operator_id: 'o', created_at: stamp })
          const payload = JSON.stringify({ idempotencyKey: 'pencil-action-a', action: { title: action.title, reportLink: 'https://forms.example.test/app/actions/a' } })
          insert('action_task_deliveries', { action_id: 'a', idempotency_key: 'pencil-action-a', state: 'unknown', payload_json: payload, payload_sha256: 'a'.repeat(64), action_version: 2, confirmed_by_operator_id: 'o', confirmed_at: stamp, in_flight_attempt_id: null, remote_task_id: null, updated_at: stamp })
          insert('action_task_attempts', { id: 't1', action_id: 'a', ordinal: 1, idempotency_key: 'pencil-action-a', payload_sha256: 'a'.repeat(64), operator_id: 'o', started_at: stamp, outcome: 'unknown', outcome_class: 'network', http_status: null, remote_task_id: null, finished_at: stamp })
          for (const status of ['pending','sending','sent','failed','unknown','cancelled']) {
            insert('action_reminders', {id:status,action_id:'a',operator_id:'o',kind:'overdue',due_date:`2026-12-${String(8+['pending','sending','sent','failed','unknown','cancelled'].indexOf(status)).padStart(2,'0')}`,review_date:'2026-12-01',status,idempotency_key:`reminder:${status}`,attempts:1,first_attempt_at:stamp,last_attempt_at:stamp,available_at:stamp,reason:'Retained reminder reason',provider_id:`receipt:${status}`,provider:'sendgrid',provider_code:'provider_uncertain',created_at:stamp,updated_at:stamp})
            insert('action_reminder_attempts', {id:`attempt:${status}`,reminder_id:status,ordinal:1,event:'started',created_at:stamp})
          }
          const reminderRows = db.prepare('SELECT * FROM action_reminders ORDER BY id').all()
          const reminderAttempts = db.prepare('SELECT * FROM action_reminder_attempts ORDER BY id').all()
          db.close()
          const summary = exportData(source, archive)
          const importedSummary = importData(archive, target)
          assert.deepEqual(importedSummary, summary)
          assert.equal(importedSummary.effectsDispatched, false)
          const second = join(directory, 'second.json')
          assert.deepEqual(exportData(target, second), summary)
          assert.equal(readFileSync(archive, 'utf8'), readFileSync(second, 'utf8'))
          const restored = new DatabaseSync(target)
          try {
            assert.deepEqual({ ...restored.prepare('SELECT * FROM actions').get() }, {...action,reminders_enabled:0})
            assert.deepEqual({ ...restored.prepare('SELECT state, idempotency_key, payload_json, remote_task_id FROM action_task_deliveries').get() }, { state: 'unknown', idempotency_key: 'pencil-action-a', payload_json: payload, remote_task_id: null })
            assert.deepEqual(restored.prepare('SELECT id, outcome FROM action_task_attempts').all().map(row => ({ ...row })), [{ id: 't1', outcome: 'unknown' }])
            assert.equal(restored.prepare('SELECT count(*) n FROM action_events').get().n, 2)
            assert.equal(restored.prepare('SELECT observed_value FROM action_measurements').get().observed_value, 52)
            assert.deepEqual(restored.prepare('SELECT * FROM action_reminders ORDER BY id').all(),reminderRows)
            assert.deepEqual(restored.prepare('SELECT * FROM action_reminder_attempts ORDER BY id').all(),reminderAttempts)
            assert.deepEqual(restored.prepare('PRAGMA foreign_key_check').all(), [])
            // The same FK path used by action erasure removes its full delivery graph.
            restored.prepare('DELETE FROM action_task_attempts').run()
            for (const table of ['action_task_deliveries','action_events','action_measurements','action_evidence']) restored.exec(`DELETE FROM ${table}`)
            restored.prepare('DELETE FROM actions').run()
            assert.equal(restored.prepare('SELECT count(*) n FROM action_reminders').get().n,0)
            assert.equal(restored.prepare('SELECT count(*) n FROM action_reminder_attempts').get().n,0)
          } finally { restored.close() }
          assert.deepEqual(requests, [])
        } finally {
          if (db.isOpen) db.close()
          await new Promise(resolve => receiver.close(resolve))
          rmSync(directory, { recursive: true, force: true })
        }
      })();
    })();
  } catch (cause) { throw new Error('action-data', { cause }); }
  // analysis-data: retain its complete restoration workload and assertions.
  try {
    await (async () => {
      const assert = (await import('node:assert/strict')).default;
      const { createServer } = await import('node:http');
      const { DatabaseSync } = await import('node:sqlite');
      const { mkdtempSync, readFileSync, rmSync } = await import('node:fs');
      const { join } = await import('node:path');
      const { tmpdir } = await import('node:os');
      const { initialize, exportData, importData } = await import('./deployment-data.mjs');
      await (async () => {
        const directory = mkdtempSync(join(process.env.PENCIL_VERIFICATION_TMPDIR ?? tmpdir(), 'pencil-analysis-data-'))
        const source = join(directory, 'source.sqlite'), archive = join(directory, 'data.json'), target = join(directory, 'target.sqlite')
        const db = new DatabaseSync(source)
        const stamp = '2026-10-12T00:00:00.000Z', later = '2026-10-12T00:01:00.000Z'
        const insert = (table, values) => db.prepare(`INSERT INTO ${table} (${Object.keys(values).join(',')}) VALUES (${Object.keys(values).map(() => '?').join(',')})`).run(...Object.values(values))
        // A listening provider edge on loopback: restoring must not reach it.
        const requests = []
        const receiver = createServer((request, response) => { requests.push(request.url); response.writeHead(500).end() })
        await new Promise(resolve => receiver.listen(0, '127.0.0.1', resolve))
        try {
          initialize(db)
          insert('workspaces', { id: 'w', name: 'Analysis archive', time_zone: 'UTC', created_at: stamp, updated_at: stamp })
          insert('operators',{id:'o',workspace_id:'w',email:'operator@example.test',display_name:'Operator',created_at:stamp,updated_at:stamp})
          insert('flows', { id: 'f', workspace_id: 'w', title: 'Visit', slug: 'visit', status: 'open', draft_version: 1, last_activity_at: stamp, created_at: stamp, updated_at: stamp })
          insert('flow_revisions', { id: 'r', flow_id: 'f', number: 1, state: 'published', title: 'Visit', is_current: 1, created_at: stamp, updated_at: stamp })
          insert('analysis_policies', { workspace_id: 'w', autorun_enabled: 0, autorun_minimum: 8, disclosure_threshold: 6, selection: 'highest-impact', updated_by_operator_id: 'o', updated_at: stamp })
          const run = (id, state, extra = {}) => insert('analysis_runs', { id, workspace_id: 'w', flow_id: 'f', revision_id: 'r', trigger: 'operator', requested_by_operator_id: 'o', state, question_ids_json: '["q"]',
            policy_json: JSON.stringify({ disclosure: { policy: 'analysis.disclosure.v1', threshold: 5 }, selection: { policy: 'recommendation.selection.v1', rule: 'highest-impact' } }), evidence_count: 5, evidence_cutoff: stamp, created_at: stamp, updated_at: stamp, ...extra })
          run('done', 'completed', { attempts: 1, first_attempt_at: stamp, provider_origin: 'https://api.example.test', model: 'm', request_sha256: 'b'.repeat(64), finished_at: later })
          run('waiting', 'queued', { attempts: 1, first_attempt_at: stamp, next_attempt_at: later, error_code: 'upstream_unavailable', error_message: 'The AI provider is unavailable.' })
          run('busy', 'running', { attempts: 1, first_attempt_at: stamp, lease_until: later })
          for (const [i, id] of ['r1', 'r2', 'r3', 'r4', 'r5'].entries()) insert('analysis_evidence', { run_id: 'done', response_id: id, position: i })
          insert('analysis_themes', { id: 't', run_id: 'done', rank: 1, title: 'Lunch queue 😀', summary: 'People "waited", =long', is_primary: 1 })
          for (const id of ['r1', 'r2', 'r3', 'r4', 'r5']) insert('analysis_theme_members', { theme_id: 't', run_id: 'done', response_id: id })
          insert('analysis_quotes', { id: 'x', theme_id: 't', run_id: 'done', response_id: 'r1', question_id: 'q', start_offset: 4, end_offset: 9, excerpt: 'queue' })
          insert('analysis_recommendations', { run_id: 'done', title: 'Open a second till', rationale: 'Most waited.', theme_ids_json: '["t"]', confidence: 'medium', expected_impact: 'high', effort: 'low' })
          insert('analysis_calls', { id: 'c', workspace_id: 'w', run_id: 'done', feature: 'analysis', provider: 'models', provider_origin: 'https://models.example.test', model: 'm', attempt: 1, outcome: 'answered', input_tokens: 1200, output_tokens: 300, cost_microusd: 4321, cost_source: 'receipt', receipt_id: 'rcpt', day: '2026-10-12', created_at: stamp })
          insert('rer_ai_development_outbox', { id: 'dev', created_at: 1, record: JSON.stringify({ request: { input: 'a captured dev request' } }) })
          insert('draft_rewrites',{id:'rewrite',workspace_id:'w',flow_id:'f',draft_id:'r',step_id:'q',operator_id:'o',draft_version:1,source:'Original question',style:'sharper',context:'Synthetic context',proposal:'Proposed question',state:'ready',created_at:stamp,updated_at:stamp})
          insert('draft_rewrites',{id:'former-author',workspace_id:'w',flow_id:'f',draft_id:'r',step_id:'q',operator_id:null,draft_version:1,source:'Retained question',style:'sharper',context:'',proposal:'Accepted question',state:'accepted',created_at:stamp,updated_at:stamp})
          insert('draft_ai_calls',{id:'rewrite-call',workspace_id:'w',draft_id:'r',rewrite_id:'rewrite',feature:'draft-rewrite',provider:'direct',provider_origin:'https://api.example.test',model:'model',outcome:'answered',cost_source:'not-reported',created_at:stamp})
          insert('analysis_attention_preferences',{operator_id:'o',muted:1})
          insert('analysis_attention',{operator_id:'o',run_id:'done',created_at:stamp,read_at:later})
          insert('digest_preferences',{flow_id:'f',operator_id:'o',epoch:'epoch',enabled:1,cutoff:stamp,next_opening:later,next_day:'2026-10-12',zone:'UTC',window_start:'09:00'})
          insert('responses',{id:'digest-response',workspace_id:'w',flow_id:'f',revision_id:'r',session_id:'old-session',session_token_hash:'old-hash',idempotency_key:'old-completion',state:'released',completed_at:stamp,created_at:stamp,updated_at:stamp,notification_eligible:1})
          insert('digest_deliveries',{id:'digest',flow_id:'f',operator_id:'o',day:'2026-10-12',zone:'UTC',epoch:'epoch',cutoff_start:stamp,cutoff_end:later,status:'pending',idempotency_key:'digest-key',attempts:1,retry_count:1,retry_authorized:1,replay_enabled:1,available_at:later,created_at:stamp,updated_at:stamp})
          insert('digest_members',{delivery_id:'digest',response_id:'digest-response'})
          insert('digest_attempts',{id:'digest-attempt',delivery_id:'digest',ordinal:1,event:'unknown',created_at:stamp})
          insert('responses',{id:'r1',workspace_id:'w',flow_id:'f',revision_id:'r',session_id:'code-session',session_token_hash:'code-hash',idempotency_key:'code-key',state:'released',completed_at:stamp,released_at:stamp,created_at:stamp,updated_at:stamp})
          insert('response_answers',{id:'coded-answer',response_id:'r1',step_id:'q',value_json:'"The queue moved slowly"',created_at:stamp,updated_at:stamp})
          insert('workspace_codes',{id:'queue-code',workspace_id:'w',label:'Queue',normalized_label:'queue',created_by_operator_id:'o',created_at:stamp})
          insert('workspace_codes',{id:'speed-code',workspace_id:'w',label:'Speed',normalized_label:'speed',created_by_operator_id:'o',created_at:stamp})
          insert('answer_code_assignments',{id:'manual-code',workspace_id:'w',answer_id:'coded-answer',code_id:'speed-code',source:'manual',actor_operator_id:'o',created_at:stamp})
          insert('answer_code_assignments',{id:'suggested-code',workspace_id:'w',answer_id:'coded-answer',code_id:'queue-code',source:'ai_suggestion',actor_operator_id:'o',quote_id:'x',created_at:stamp})
          insert('code_suggestion_decisions',{quote_id:'x',workspace_id:'w',decision:'accepted',code_id:'queue-code',actor_operator_id:'o',decided_at:stamp})
          db.close()
          const summary = exportData(source, archive)
          assert.doesNotMatch(readFileSync(archive, 'utf8'), /a captured dev request/)
          const importedSummary = importData(archive, target)
          assert.deepEqual(importedSummary, summary)
          assert.equal(importedSummary.effectsDispatched, false)
          const second = join(directory, 'second.json')
          assert.deepEqual(exportData(target, second), summary)
          assert.equal(readFileSync(archive, 'utf8'), readFileSync(second, 'utf8'))
          const restored = new DatabaseSync(target)
          try {
            assert.deepEqual(restored.prepare('SELECT id, state, next_attempt_at, lease_until FROM analysis_runs ORDER BY id').all().map(row => ({ ...row })), [
              { id: 'busy', state: 'running', next_attempt_at: null, lease_until: null }, { id: 'done', state: 'completed', next_attempt_at: null, lease_until: null }, { id: 'waiting', state: 'queued', next_attempt_at: null, lease_until: null }])
            assert.deepEqual({ ...restored.prepare('SELECT title, summary FROM analysis_themes').get() }, { title: 'Lunch queue 😀', summary: 'People "waited", =long' })
            assert.equal(restored.prepare('SELECT count(*) n FROM analysis_evidence').get().n, 5)
            assert.equal(restored.prepare('SELECT count(*) n FROM analysis_theme_members').get().n, 5)
            assert.equal(restored.prepare('SELECT excerpt FROM analysis_quotes').get().excerpt, 'queue')
            assert.equal(restored.prepare('SELECT count(*) n FROM workspace_codes').get().n,2)
            assert.deepEqual(restored.prepare('SELECT source,actor_operator_id,quote_id FROM answer_code_assignments ORDER BY source').all().map(row=>({...row})),[{source:'ai_suggestion',actor_operator_id:'o',quote_id:'x'},{source:'manual',actor_operator_id:'o',quote_id:null}])
            assert.equal(restored.prepare('SELECT decision FROM code_suggestion_decisions').get().decision,'accepted')
            assert.equal(restored.prepare('SELECT cost_microusd FROM analysis_calls').get().cost_microusd, 4321)
            assert.equal(restored.prepare('SELECT disclosure_threshold FROM analysis_policies').get().disclosure_threshold, 6)
            assert.equal(restored.prepare('SELECT count(*) n FROM rer_ai_development_outbox').get().n, 0)
            assert.deepEqual({...restored.prepare("SELECT state,source,proposal FROM draft_rewrites WHERE id='rewrite'").get()},{state:'ready',source:'Original question',proposal:'Proposed question'})
            assert.deepEqual({...restored.prepare("SELECT operator_id,state,source,proposal FROM draft_rewrites WHERE id='former-author'").get()},{operator_id:null,state:'accepted',source:'Retained question',proposal:'Accepted question'})
            assert.equal(restored.prepare('SELECT feature FROM draft_ai_calls').get().feature,'draft-rewrite')
            assert.equal(restored.prepare('SELECT read_at FROM analysis_attention').get().read_at,later)
            assert.equal(restored.prepare('SELECT muted FROM analysis_attention_preferences').get().muted,1)
            assert.equal(restored.prepare('SELECT enabled FROM digest_preferences').get().enabled,1)
            assert.deepEqual({...restored.prepare('SELECT status,replay_enabled,retry_authorized,idempotency_key FROM digest_deliveries').get()},{status:'pending',replay_enabled:0,retry_authorized:0,idempotency_key:'digest-key'})
            assert.equal(restored.prepare('SELECT event FROM digest_attempts').get().event,'unknown')
            assert.equal(restored.prepare('SELECT response_id FROM digest_members').get().response_id,'digest-response')

            assert.deepEqual(restored.prepare('PRAGMA foreign_key_check').all(), [])
          } finally { restored.close() }
          assert.deepEqual(requests, [])
        } finally {
          if (db.isOpen) db.close()
          await new Promise(resolve => receiver.close(resolve))
          rmSync(directory, { recursive: true, force: true })
        }
      })();
    })();
  } catch (cause) { throw new Error('analysis-data', { cause }); }
});
