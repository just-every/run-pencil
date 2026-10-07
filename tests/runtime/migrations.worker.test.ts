import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, describe, expect, it } from 'vitest'

declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]

const initialMigrations = __PENCIL_CORE_MIGRATIONS__.filter((migration) => /^000[0-2]_/.test(migration.name))
const incrementalMigrations = __PENCIL_CORE_MIGRATIONS__.filter((migration) => !initialMigrations.includes(migration))
const hasResponseAdmissionMigration = incrementalMigrations.some((migration) => migration.name.includes('flow_publication_and_response_admission'))
const timestamp = '2026-09-08T00:00:00.000Z'

async function seedPreIncrementalFlow() {
  await env.DB.batch([
    env.DB.prepare('INSERT INTO workspaces (id, name, time_zone, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').bind('workspace', 'Migration Café', 'Australia/Brisbane', timestamp, timestamp),
    env.DB.prepare('INSERT INTO operators (id, workspace_id, email, display_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').bind('operator', 'workspace', 'owner@migration.test', 'Migration owner', timestamp, timestamp),
    env.DB.prepare('INSERT INTO flows (id, workspace_id, slug, title, status, draft_version, last_activity_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind('flow', 'workspace', 'migration-flow', 'Migration flow', 'open', 1, timestamp, timestamp, timestamp),
    env.DB.prepare('INSERT INTO flow_revisions (id, flow_id, number, state, title, published_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind('revision', 'flow', 1, 'published', 'Migration flow', timestamp, timestamp, timestamp),
    env.DB.prepare('INSERT INTO flow_steps (id, revision_id, position, kind, question_type, prompt, helper_text, required, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind('step', 'revision', 0, 'question', 'rating', 'Was migration safe?', null, 1, timestamp, timestamp),
    env.DB.prepare('INSERT INTO respondent_sessions (id, revision_id, source, device_class, furthest_step_id, completed_at, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind('session', 'revision', 'direct', 'desktop', 'step', timestamp, '2026-10-08T00:00:00.000Z', timestamp, timestamp),
    env.DB.prepare('INSERT INTO respondent_sessions (id, revision_id, source, device_class, furthest_step_id, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind('active-session', 'revision', 'embed', 'mobile', 'step', '2026-10-08T00:00:00.000Z', timestamp, timestamp),
    env.DB.prepare('INSERT INTO responses (id, workspace_id, flow_id, revision_id, session_id, idempotency_key, completed_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind('response', 'workspace', 'flow', 'revision', 'session', 'migration-idempotency-key', timestamp, timestamp, timestamp),
    env.DB.prepare('INSERT INTO response_answers (id, response_id, step_id, value_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').bind('answer', 'response', 'step', '5', timestamp, timestamp),
    env.DB.prepare('INSERT INTO revision_metric_counters (id, revision_id, starts, completions, total_completion_milliseconds, mobile_starts, tablet_starts, desktop_starts, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind('metrics', 'revision', 1, 1, 1000, 0, 0, 1, timestamp, timestamp),
  ])
}

beforeAll(async () => {
  expect(initialMigrations).toHaveLength(3)
  await applyD1Migrations(env.DB, initialMigrations)
  await seedPreIncrementalFlow()
  await applyD1Migrations(env.DB, incrementalMigrations)
})

describe('core migrations in a Workers D1 runtime', () => {
  it('migrates an existing flow graph and response ledger without losing linked rows', async () => {
    const graph = await env.DB.prepare(`
      SELECT responses.id AS response_id, response_answers.id AS answer_id
      FROM responses
      JOIN response_answers ON response_answers.response_id = responses.id
      JOIN flow_steps ON flow_steps.id = response_answers.step_id

      WHERE responses.id = 'response'
    `).first<{ response_id: string; answer_id: string }>()
    expect(graph).toEqual({
      response_id: 'response',
      answer_id: 'answer',
    })

    if (hasResponseAdmissionMigration) {
      const admissionFields = await env.DB.prepare(`
        SELECT flow_steps.stable_id AS step_stable_id, responses.session_token_hash AS session_token_hash,
          responses.state AS response_state
        FROM responses
        JOIN response_answers ON response_answers.response_id = responses.id
        JOIN flow_steps ON flow_steps.id = response_answers.step_id

        WHERE responses.id = 'response'
      `).first<{ step_stable_id: string; session_token_hash: string; response_state: string }>()
      expect(admissionFields).toEqual({ step_stable_id: 'step', session_token_hash: 'session', response_state: 'released' })
      const retainedFacts = await env.DB.prepare("SELECT source, started_at FROM responses WHERE id = 'response'").first()
      expect(retainedFacts).toEqual({ source: 'direct', started_at: timestamp })
      expect(await env.DB.prepare("SELECT id FROM respondent_sessions WHERE id = 'session'").first()).toBeNull()
      expect(await env.DB.prepare("SELECT value_json FROM response_answers WHERE id = 'answer'").first()).toEqual({ value_json: '5' })
      expect(await env.DB.prepare("SELECT starts, completions FROM revision_metric_counters WHERE revision_id = 'revision'").first()).toEqual({ starts: 1, completions: 1 })
      expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
    }
  })

  it('preserves an existing active session while removing only completed device-bearing rows', async () => {
    expect(await env.DB.prepare("SELECT source, device_class, furthest_step_id, session_token_hash, expires_at FROM respondent_sessions WHERE id = 'active-session'").first()).toEqual({ source: 'embed', device_class: 'mobile', furthest_step_id: 'step', session_token_hash: 'active-session', expires_at: '2026-10-08T00:00:00.000Z' })
    expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
  })

  it('preserves one durable response per session after the replacement migration', async () => {
    const duplicate = hasResponseAdmissionMigration
      ? env.DB.prepare(`INSERT INTO responses (id, workspace_id, flow_id, revision_id, session_id, idempotency_key, state, completed_at, created_at, updated_at) VALUES ('duplicate-response', 'workspace', 'flow', 'revision', 'session', 'different-idempotency-key', 'released', ?, ?, ?)`).bind(timestamp, timestamp, timestamp)
      : env.DB.prepare(`INSERT INTO responses (id, workspace_id, flow_id, revision_id, session_id, idempotency_key, completed_at, created_at, updated_at) VALUES ('duplicate-response', 'workspace', 'flow', 'revision', 'session', 'different-idempotency-key', ?, ?, ?)`).bind(timestamp, timestamp, timestamp)
    await expect(duplicate.run()).rejects.toThrow()

    const responses = await env.DB.prepare("SELECT id, idempotency_key FROM responses WHERE session_id = 'session'").all<{ id: string; idempotency_key: string }>()
    expect(responses.results).toEqual([{ id: 'response', idempotency_key: 'migration-idempotency-key' }])
  })

  it('records and safely repeats every migration', async () => {
    await applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__)
    const ledger = await env.DB.prepare('SELECT name FROM d1_migrations ORDER BY id').all<{ name: string }>()
    expect(ledger.results.map((entry) => entry.name)).toEqual(__PENCIL_CORE_MIGRATIONS__.map((migration) => migration.name))
  })
})
