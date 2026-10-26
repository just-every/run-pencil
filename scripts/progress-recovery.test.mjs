import { expect, it } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { exportData, importData, initialize } from './deployment-data.mjs'

// Builds the whole schema twice and round-trips an archive: 1.6 s at 0.1.x, 2.7 s with 0.2.0's migrations
// on a developer machine, past Vitest's 5 s default on loaded CI runners.
it('restores retained progress and the atomic write view without recounting visits', () => {
  const directory = mkdtempSync(join(tmpdir(), 'pencil-progress-recovery-'))
  const source = join(directory, 'source.sqlite')
  const archive = join(directory, 'archive.json')
  const restored = join(directory, 'restored.sqlite')
  let database
  try {
    database = new DatabaseSync(source)
    initialize(database)
    const now = '2026-10-07T00:00:00.000Z'
    const insert = (table, row) => {
      const keys = Object.keys(row)
      database.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...Object.values(row))
    }
    insert('workspaces', { id: 'workspace', name: 'Progress recovery', time_zone: 'UTC', created_at: now, updated_at: now })
    insert('flows', { id: 'flow', workspace_id: 'workspace', slug: 'progress-recovery', title: 'Progress recovery', status: 'open', draft_version: 1, last_activity_at: now, created_at: now, updated_at: now })
    insert('flow_revisions', { id: 'revision', flow_id: 'flow', number: 1, state: 'published', title: 'Progress recovery', published_at: now, created_at: now, updated_at: now })
    for (const [position, id] of ['first', 'second'].entries()) {
      insert('flow_steps', { id, revision_id: 'revision', stable_id: id, position, kind: 'question', question_type: 'short_text', prompt: id, required: 0, created_at: now, updated_at: now })
    }
    insert('respondent_sessions', { id: 'session', revision_id: 'revision', source: 'direct', device_class: 'mobile', furthest_step_id: 'first', session_token_hash: 'synthetic-hash', expires_at: '2099-01-01T00:00:00.000Z', created_at: now, updated_at: now })
    insert('respondent_session_step_events', { id: 'event-session-first', session_id: 'session', revision_id: 'revision', step_stable_id: 'first', counted_at: now, created_at: now })
    insert('revision_step_metric_counters', { id: 'step-metric-revision-first', revision_id: 'revision', step_stable_id: 'first', reached: 1, dropped: 0, created_at: now, updated_at: now })
    database.close()
    database = undefined
    const exported = exportData(source, archive)
    expect(importData(archive, restored)).toEqual(exported)
    database = new DatabaseSync(restored)
    // The resume token never travels: the old respondent credential no longer matches after a restore.
    expect(database.prepare("SELECT id FROM respondent_session_progress WHERE session_token_hash = 'synthetic-hash'").all()).toEqual([])
    const advance = database.prepare(`UPDATE respondent_session_progress SET furthest_step_id = ?, updated_at = ?
      WHERE id = 'session' RETURNING id`)
    for (const stepId of ['first', 'second', 'second']) {
      expect(advance.all(stepId, now)).toEqual([{ id: 'session' }])
    }
    expect(database.prepare('SELECT furthest_step_id FROM respondent_sessions').get().furthest_step_id).toBe('second')
    expect(database.prepare('SELECT step_stable_id, reached FROM revision_step_metric_counters ORDER BY step_stable_id').all())
      .toEqual([{ step_stable_id: 'first', reached: 1 }, { step_stable_id: 'second', reached: 1 }])
    expect(database.prepare('SELECT COUNT(*) AS count FROM respondent_session_step_events').get().count).toBe(2)
    expect(database.prepare('PRAGMA foreign_key_check').all()).toEqual([])
  } finally {
    database?.close()
    rmSync(directory, { recursive: true, force: true })
  }
}, 30_000)
