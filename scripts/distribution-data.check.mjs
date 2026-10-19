import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { initialize, exportData, importData } from './deployment-data.mjs'

test('archive roundtrip retains invitation data, private saves and retention custody while disabling restored delivery capabilities', () => {
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
    insert('distribution_contacts', { id: 'c', workspace_id: 'w', email: 'synthetic@example.test', name: 'Synthetic recipient', fields_json: JSON.stringify({team:'Archive field'}), created_at: stamp, updated_at: stamp })
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
    const value = JSON.stringify('Original\n"quoted", =literal 😀\u0000')
    insert('response_answers', { id: 'answer', response_id: 'response', step_id: 'stable-question', value_json: value, created_at: stamp, updated_at: stamp })
    insert('form_access_rules',{id:'access-rule',flow_id:'f',mode:'password',password_verifier:'synthetic-private-verifier',domains_json:'[]',emails_json:'[]',created_at:stamp})
    insert('access_challenges',{id:'access-code',rule_id:'access-rule',revision_id:'r',email:'code-only@example.test',code_hash:'synthetic-code-hash',expires_at:'2026-11-06T00:00:00.000Z',created_at:stamp,delivery_state:'sent'})
    insert('response_access',{response_id:'response',flow_id:'f',email:'verified@example.test',subject:null})
    db.close()
    const summary = exportData(source, archive)
    assert.deepEqual(importData(archive, target), summary)
    const second = join(directory, 'second.json')
    assert.deepEqual(exportData(target, second), summary)
    assert.equal(readFileSync(archive, 'utf8'), readFileSync(second, 'utf8'))
    const saved=JSON.parse(readFileSync(second,'utf8')).payload.tables.find(table=>table.name==='flow_steps')
    assert.equal(saved.rows[0][saved.columns.indexOf('prompt')].value,prompt)
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
      assert.equal(restored.prepare('SELECT fields_json FROM distribution_contacts').get().fields_json,JSON.stringify({team:'Archive field'}))
      assert.deepEqual({...restored.prepare('SELECT token,opt_out_token FROM invitation_participants').get()},{token:null,opt_out_token:null})
      assert.equal(restored.prepare('SELECT resume_enabled FROM invitation_launches').get().resume_enabled,0)
      assert.equal(restored.prepare('SELECT count(*) n FROM distribution_segments').get().n,1)
      assert.equal(restored.prepare('SELECT count(*) n FROM invitation_candidates').get().n,1)
      assert.equal(restored.prepare('SELECT value_json FROM response_answers').get().value_json, value)
      assert.deepEqual({ ...restored.prepare('SELECT r.state, r.participant_id, p.contact_id, d.status FROM responses r JOIN invitation_participants p ON p.id=r.participant_id JOIN mail_deliveries d ON d.participant_id=p.id').get() }, { state: 'quarantined', participant_id: 'p', contact_id: 'c', status: 'unknown' })
      assert.deepEqual({...restored.prepare('SELECT token_hash,delivery_email,answers_json FROM respondent_saves').get()},{token_hash:null,delivery_email:null,answers_json:savedAnswers})
      assert.equal(restored.prepare("SELECT count(*) n FROM audit_entries WHERE kind='response.resume-requested'").get().n,1)
      assert.equal(restored.prepare('SELECT count(*) n FROM rer_mail_development_outbox').get().n,0)
      assert.deepEqual(restored.prepare('PRAGMA foreign_key_check').all(), [])
    } finally { restored.close() }
  } finally { if (db.isOpen) db.close(); rmSync(directory, { recursive: true, force: true }) }
})
