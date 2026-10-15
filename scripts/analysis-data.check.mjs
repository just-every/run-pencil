import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { DatabaseSync } from 'node:sqlite'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { initialize, exportData, importData } from './deployment-data.mjs'

test('archive roundtrip keeps analysis history, evidence, findings and usage, leaves every run unscheduled and dev captures out, and restoring sends nothing', async () => {
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
})
