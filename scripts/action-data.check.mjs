import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { DatabaseSync } from 'node:sqlite'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { initialize, exportData, importData } from './deployment-data.mjs'

test('archive roundtrip keeps actions, history, evidence, measurements and an unknown task delivery unknown, and restoring sends nothing', async () => {
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
      assert.deepEqual({ ...restored.prepare('SELECT * FROM actions').get() }, action)
      assert.deepEqual({ ...restored.prepare('SELECT state, idempotency_key, payload_json, remote_task_id FROM action_task_deliveries').get() }, { state: 'unknown', idempotency_key: 'pencil-action-a', payload_json: payload, remote_task_id: null })
      assert.deepEqual(restored.prepare('SELECT id, outcome FROM action_task_attempts').all().map(row => ({ ...row })), [{ id: 't1', outcome: 'unknown' }])
      assert.equal(restored.prepare('SELECT count(*) n FROM action_events').get().n, 2)
      assert.equal(restored.prepare('SELECT observed_value FROM action_measurements').get().observed_value, 52)
      assert.deepEqual(restored.prepare('PRAGMA foreign_key_check').all(), [])
    } finally { restored.close() }
    assert.deepEqual(requests, [])
  } finally {
    if (db.isOpen) db.close()
    await new Promise(resolve => receiver.close(resolve))
    rmSync(directory, { recursive: true, force: true })
  }
})
