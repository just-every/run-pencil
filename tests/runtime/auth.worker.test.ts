import { devKeyHeaders } from '../helpers/dev-key.mjs'
import { developmentInbox } from '../helpers/development-outbox'
import { contract } from '../../src/test/contract'
import { applyD1Migrations, env, SELF, type D1Migration } from 'cloudflare:test'
import { beforeAll, describe, expect, it } from 'vitest'
import { AuthRepository } from '../helpers/legacy-auth-repository'
import { createD1BatchExecutor } from '../../src/core/platform/db/batch'
import { createDatabase } from '../../src/core/platform/db/repository'
import { sha256 } from '../../src/core/features/auth/tokens'

declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]

const ownerEmail = 'owner@aurora-coffee.test'

async function request(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers)
  headers.set('Host', 'localhost')
  for (const [name, value] of Object.entries(devKeyHeaders)) headers.set(name, value)
  if (!headers.has('Origin')) headers.set('Origin', 'http://localhost')
  return SELF.fetch(`http://localhost${path}`, { ...init, headers })
}

async function issueToken() {
  return issueTokenFor(ownerEmail)
}

async function issueTokenFor(email: string) {
  const sent = await request('/auth/magic-link', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  expect(sent.status).toBe(202)
  const inbox = await request('/__dev/outbox')
  expect(inbox.status).toBe(200)
  const payload = await developmentInbox(path => request(path), email)
  expect(payload.messages[0]?.magicLinkToken).toMatch(/^[A-Za-z0-9_-]{43}$/)
  return payload.messages[0].magicLinkToken
}

async function sessionCookie(email: string) {
  const token = await issueTokenFor(email)
  const redemption = await request('/auth/confirm', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token }), redirect: 'manual' })
  expect(redemption.status).toBe(303)
  const cookie = redemption.headers.get('set-cookie')?.split(';', 1)[0]
  expect(cookie).toMatch(/^operator_session_local_80=/)
  return cookie!
}

beforeAll(async () => {
  await applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__)
  await request('/health')
})

describe('operator authentication in a Workers D1 runtime', () => {
  contract(['BASE-ACCESS-001'], 'accepts exactly one concurrent redemption of a local magic link', async () => {
    const token = await issueToken()
    const [first, second] = await Promise.all([
      request('/auth/confirm', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token }), redirect: 'manual' }),
      request('/auth/confirm', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token }), redirect: 'manual' }),
    ])
    const locations = [first.headers.get('location'), second.headers.get('location')]
    expect(locations.filter((location) => location?.endsWith('/app')).length).toBe(1)
    expect([first.status, second.status].sort()).toEqual([303, 400])

    const sessions = await env.DB.prepare(`
      SELECT count(*) AS count
      FROM oa_sessions
      JOIN operators ON operators.id = oa_sessions.operator_id
      WHERE operators.email = ?
    `).bind(ownerEmail).first<{ count: number }>()
    expect(sessions?.count).toBe(1)
  })

  contract(['OPER-002'], 'leaves one operator when two peers concurrently try to remove one another', async () => {
    const now = '2026-09-08T00:00:00.000Z'
    const workspaceId = 'concurrent-removal-workspace'
    const firstId = '01J00000000000000000000031'
    const secondId = '01J00000000000000000000032'
    const firstEmail = 'first-remove@aurora-coffee.test'
    const secondEmail = 'second-remove@aurora-coffee.test'
    await env.DB.batch([
      env.DB.prepare('INSERT INTO workspaces (id, name, time_zone, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').bind(workspaceId, 'Concurrent removal workspace', 'Australia/Brisbane', now, now),
      env.DB.prepare('INSERT INTO operators (id, workspace_id, email, display_name, is_setup_operator, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(firstId, workspaceId, firstEmail, 'First operator', 0, now, now),
      env.DB.prepare('INSERT INTO operators (id, workspace_id, email, display_name, is_setup_operator, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(secondId, workspaceId, secondEmail, 'Second operator', 0, now, now),
    ])
    const [firstCookie, secondCookie] = await Promise.all([sessionCookie(firstEmail), sessionCookie(secondEmail)])
    const [firstRemoval, secondRemoval] = await Promise.all([
      request(`/api/app/operators/${secondId}`, { method: 'DELETE', headers: { cookie: firstCookie, origin: 'http://localhost' } }),
      request(`/api/app/operators/${firstId}`, { method: 'DELETE', headers: { cookie: secondCookie, origin: 'http://localhost' } }),
    ])
    const statuses = [firstRemoval.status, secondRemoval.status]
    expect(statuses.filter((status) => status === 204)).toHaveLength(1)
    expect(statuses.filter((status) => status === 401 || status === 403)).toHaveLength(1)
    const survivors = await env.DB.prepare('SELECT id FROM operators WHERE workspace_id = ?').bind(workspaceId).all<{ id: string }>()
    expect(survivors.results).toHaveLength(1)
    expect([firstId, secondId]).toContain(survivors.results[0]?.id)
    const activeSessions = await env.DB.prepare(`
      SELECT count(*) AS count
      FROM oa_sessions
      JOIN operators ON operators.id = oa_sessions.operator_id
      WHERE operators.workspace_id = ?
    `).bind(workspaceId).first<{ count: number }>()
    expect(activeSessions?.count).toBe(1)
    const removals = await env.DB.prepare("SELECT count(*) AS count FROM audit_entries WHERE workspace_id = ? AND kind = 'operator.removed'")
      .bind(workspaceId).first<{ count: number }>()
    expect(removals?.count).toBe(1)
  })
})

async function custodyFixture(suffix: string, sameEmailWorkspace = false) {
  const now = new Date().toISOString()
  const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString()
  const workspaceId = `custody-${suffix}`
  const actorId = `01M${'0'.repeat(20)}${suffix}`
  const targetId = `01M1${'0'.repeat(19)}${suffix}`
  const email = `custody-${suffix}@example.test`
  const token = suffix.padStart(64, 'a')
  const linkId = `link-${suffix}`
  await env.DB.batch([
    env.DB.prepare('INSERT INTO workspaces (id, name, time_zone, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').bind(workspaceId, 'Custody review', 'UTC', now, now),
    env.DB.prepare('INSERT INTO operators (id, workspace_id, email, display_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').bind(actorId, workspaceId, `actor-${suffix}@example.test`, 'Retained operator', now, now),
    env.DB.prepare('INSERT INTO operators (id, workspace_id, email, display_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').bind(targetId, workspaceId, email, 'Removed operator', now, now),
    env.DB.prepare('INSERT INTO auth_magic_links (id, operator_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)').bind(linkId, targetId, await sha256(token), expiresAt, now),
    env.DB.prepare('INSERT INTO local_dev_inbox (id, to_email, magic_link_token, expires_at, created_at) VALUES (?, ?, ?, ?, ?)').bind(`legacy-${suffix}`, email, token, expiresAt, now),
    env.DB.prepare("INSERT INTO audit_entries (id, workspace_id, kind, actor_operator_id, subject_type, subject_id, details_json, created_at) VALUES (?, ?, 'review.seed', ?, 'operator', ?, '{}', ?)").bind(`audit-${suffix}`, workspaceId, targetId, targetId, now),
  ])
  if (sameEmailWorkspace) {
    await env.DB.batch([
      env.DB.prepare('INSERT INTO workspaces (id, name, time_zone, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').bind(`${workspaceId}-other`, 'Other workspace', 'UTC', now, now),
      env.DB.prepare('INSERT INTO operators (id, workspace_id, email, display_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').bind(`${targetId}-other`, `${workspaceId}-other`, email, 'Other operator', now, now),
      env.DB.prepare('INSERT INTO auth_magic_links (id, operator_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)').bind(`${linkId}-other`, `${targetId}-other`, await sha256('b'.repeat(64)), expiresAt, now),
      env.DB.prepare('INSERT INTO local_dev_inbox (id, to_email, magic_link_token, expires_at, created_at) VALUES (?, ?, ?, ?, ?)').bind(`legacy-${suffix}-other`, email, 'b'.repeat(64), expiresAt, now),
    ])
  }
  const repository = new AuthRepository(createDatabase(env.DB), createD1BatchExecutor(env.DB))
  const message = { id: `auth_magic_link/${linkId}`, toEmail: email, magicLinkToken: token, expiresAt, createdAt: now }
  return { workspaceId, actorOperatorId: actorId, targetOperatorId: targetId, repository, message, now, email, token, linkId }
}

contract(['OPER-002', 'BASE-OPS-005'], 'preserves setup and last-operator credentials on refusal, then records another active actor on permitted removal', async () => {
  const f = await custodyFixture('104')
  await f.repository.addLocalInboxMessage(f.message)
  await env.DB.prepare('UPDATE operators SET is_setup_operator = 1 WHERE id = ?').bind(f.targetOperatorId).run()
  expect(await f.repository.removeOperator(f)).toBe('setup-protected')
  expect(await env.DB.prepare('SELECT count(*) AS n FROM local_dev_inbox WHERE to_email = ?').bind(f.email).first()).toEqual({ n: 2 })
  await env.DB.prepare('UPDATE operators SET is_setup_operator = 0 WHERE id = ?').bind(f.targetOperatorId).run()
  expect(await f.repository.removeOperator(f)).toBe('removed')
  expect(await env.DB.prepare("SELECT actor_operator_id, subject_id FROM audit_entries WHERE workspace_id = ? AND kind = 'operator.removed'").bind(f.workspaceId).first()).toEqual({ actor_operator_id: f.actorOperatorId, subject_id: null })
  expect(await f.repository.removeOperator({ ...f, targetOperatorId: f.actorOperatorId })).toBe('last-operator')
  expect(await env.DB.prepare("SELECT count(*) AS n FROM audit_entries WHERE workspace_id = ? AND kind = 'operator.removed'").bind(f.workspaceId).first()).toEqual({ n: 1 })
}, 60000)
