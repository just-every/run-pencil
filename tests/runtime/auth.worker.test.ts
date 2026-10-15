import { devKeyHeaders } from '../helpers/dev-key.mjs'
import { developmentInbox } from '../helpers/development-outbox'
import { contract } from '../../src/test/contract'
import { applyD1Migrations, env, SELF, type D1Migration } from 'cloudflare:test'
import { beforeAll, describe, expect, it } from 'vitest'
import { AuthRepository } from '../helpers/legacy-auth-repository'
import { createPencilServices } from '../../src/core/app/services'
import { createPencilPlatform } from '../../src/core/platform/runtime'
import { createD1BatchExecutor } from '../../src/core/platform/db/batch'
import { createDatabase } from '../../src/core/platform/db/repository'
import { sha256 } from '../../src/core/features/auth/tokens'
import { AuditRepository } from '../../src/core/features/audit/repository'
import { AuthService } from '../../src/core/features/auth/service'
import { baseMailSender } from '../../src/core/platform/mail/base.server'
import { AuditService } from '../../src/core/features/audit/service'
import { LocalDevelopmentMailSender } from '../helpers/legacy-mail'

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

  contract(['OPER-002'], 'does not remove the only operator through the authenticated API', async () => {
    const cookie = await sessionCookie(ownerEmail)

    const operators = await request('/api/app/operators', { headers: { cookie: cookie! } })
    expect(operators.status).toBe(200)
    const listed = await operators.json<Array<{ id: string }>>()
    expect(listed).toHaveLength(1)

    const remove = await request(`/api/app/operators/${listed[0].id}`, {
      method: 'DELETE',
      headers: { cookie: cookie!, origin: 'http://localhost' },
    })
    expect(remove.status).toBe(403)
    await expect(remove.json()).resolves.toMatchObject({ error: 'FORBIDDEN' })
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

  contract(['OPER-002'], 'records bootstrap once and never recreates a removed setup operator', async () => {
    const now = '2026-09-08T00:00:00.000Z'
    const workspaceId = 'bootstrap-workspace'
    const email = 'bootstrap@aurora-coffee.test'
    await env.DB.prepare('INSERT INTO workspaces (id, name, time_zone, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
      .bind(workspaceId, 'Bootstrap workspace', 'Australia/Brisbane', now, now).run()

    const repository = new AuthRepository(createDatabase(env.DB), createD1BatchExecutor(env.DB))
    const [first, concurrent] = await Promise.all([
      repository.initializeSetupOperator({ workspaceId, email, now }),
      repository.initializeSetupOperator({ workspaceId, email, now }),
    ])
    expect([first.kind, concurrent.kind].sort()).toEqual(['already-initialized', 'initialized'])
    const initialized = first.kind === 'initialized' ? first : concurrent
    expect(initialized.created).toBe(true)

    const bootstrap = await env.DB.prepare(`
      SELECT operators.id AS operator_id, workspaces.setup_operator_initialized_at AS initialized_at
      FROM operators
      JOIN workspaces ON workspaces.id = operators.workspace_id
      WHERE operators.workspace_id = ? AND lower(operators.email) = lower(?)
    `).bind(workspaceId, email).first<{ operator_id: string; initialized_at: string | null }>()
    expect(bootstrap).toEqual({ operator_id: initialized.operatorId, initialized_at: now })

    await env.DB.batch([
      env.DB.prepare('INSERT INTO operators (id, workspace_id, email, display_name, is_setup_operator, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind('retained-operator', workspaceId, 'retained@aurora-coffee.test', 'Retained operator', 0, now, now),
      env.DB.prepare('DELETE FROM operator_sessions WHERE operator_id = ?').bind(bootstrap!.operator_id),
      env.DB.prepare('DELETE FROM auth_magic_links WHERE operator_id = ?').bind(bootstrap!.operator_id),
      env.DB.prepare('DELETE FROM operator_auth_links WHERE operator_id = ?').bind(bootstrap!.operator_id),
      env.DB.prepare('DELETE FROM oa_operators WHERE id = ?').bind(bootstrap!.operator_id),
      env.DB.prepare('DELETE FROM operators WHERE id = ?').bind(bootstrap!.operator_id),
    ])

    const reloadedServices = createPencilServices(createPencilPlatform('http://localhost', env))
    await expect(reloadedServices.auth.ensureSetupOperator({ workspaceId, email })).resolves.toBeUndefined()
    const after = await env.DB.prepare(`
      SELECT setup_operator_initialized_at AS initialized_at,
        (SELECT count(*) FROM operators WHERE workspace_id = ? AND lower(email) = lower(?)) AS setup_operator_count
      FROM workspaces
      WHERE id = ?
    `).bind(workspaceId, email, workspaceId).first<{ initialized_at: string | null; setup_operator_count: number }>()
    expect(after).toEqual({ initialized_at: now, setup_operator_count: 0 })
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

contract(['BASE-DATA-003', 'BASE-ACCESS-004', 'OPER-002'], 'removes owned old/new inbox credentials after a rewrite and anonymises audit references while preserving another workspace with the same email', async () => {
  const f = await custodyFixture('101', true)
  await f.repository.addLocalInboxMessage(f.message)
  const cookie = await sessionCookie(f.email)
  const services = createPencilServices(createPencilPlatform('http://localhost', env))
  const flow = await services.flows.createDraftFlow({ workspaceId: f.workspaceId, slug: 'removal-after-rewrite', title: 'Rewrite custody' })
  const initial = await services.flows.getBuilderDraft(f.workspaceId, flow.id)
  await services.flows.addDraftStep({ workspaceId: f.workspaceId, flowId: flow.id, expectedVersion: initial.flow.draftVersion, step: { kind: 'question', questionType: 'long_text', prompt: 'How was your visit?', required: false } })
  const draft = await services.flows.getBuilderDraft(f.workspaceId, flow.id), question = draft.steps.find(step => step.kind === 'question')!
  const rewriteResponse = await request(`/api/app/flows/${flow.id}/rewrites`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ stepId: question.id, expectedVersion: draft.flow.draftVersion, source: question.prompt, style: 'sharper' }) })
  expect(rewriteResponse.status).toBe(201)
  const rewrite = await rewriteResponse.json<{ id: string; state: string }>()
  expect(rewrite.state).toBe('failed')
  const session = await env.DB.prepare('SELECT id FROM oa_sessions WHERE operator_id = ?').bind(f.targetOperatorId).first<{ id: string }>()
  await new AuditRepository(createDatabase(env.DB)).create({ id: 'session-audit-101', workspaceId: f.workspaceId, kind: 'review.session', actorOperatorId: f.actorOperatorId, subjectType: 'operator_session', subjectId: session!.id, detailsJson: '{}', createdAt: f.now })
  await env.DB.prepare("INSERT INTO audit_entries (id, workspace_id, kind, actor_operator_id, subject_type, subject_id, details_json, created_at) VALUES ('historical-session-101', ?, 'operator.session_signed_out', ?, 'operator_session', 'already-expired-session', ?, ?)").bind(f.workspaceId, f.targetOperatorId, JSON.stringify({ legacyOperatorEmail: f.email }), f.now).run()
  const removed = await request(`/api/app/operators/${f.targetOperatorId}`, { method: 'DELETE', headers: { Host: 'localhost', cookie, origin: 'http://localhost' } })
  expect(removed.status, removed.status === 204 ? '' : await removed.text()).toBe(204)
  const inbox = await env.DB.prepare('SELECT id FROM local_dev_inbox WHERE to_email = ? ORDER BY id').bind(f.email).all()
  expect(inbox.results).toEqual([{ id: 'legacy-101-other' }])
  for (const table of ['operator_sessions', 'auth_magic_links']) {
    expect(await env.DB.prepare(`SELECT count(*) AS n FROM ${table} WHERE operator_id = ?`).bind(f.targetOperatorId).first()).toEqual({ n: 0 })
  }
  expect(await env.DB.prepare('SELECT id FROM operators WHERE id = ?').bind(f.targetOperatorId).first()).toBeNull()
  expect(await env.DB.prepare('SELECT operator_id, state, source FROM draft_rewrites WHERE id=?').bind(rewrite.id).first()).toEqual({ operator_id: null, state: 'failed', source: question.prompt })
  expect(await env.DB.prepare('SELECT id FROM operators WHERE id = ?').bind(`${f.targetOperatorId}-other`).first()).toEqual({ id: `${f.targetOperatorId}-other` })
  const references = await env.DB.prepare("SELECT actor_operator_id, subject_id FROM audit_entries WHERE workspace_id = ? AND subject_type <> 'flow'").bind(f.workspaceId).all()
  expect(await env.DB.prepare("SELECT actor_operator_id, subject_id, details_json FROM audit_entries WHERE id = 'historical-session-101'").first()).toEqual({ actor_operator_id: null, subject_id: null, details_json: '{}' })
  expect(references.results.length).toBeGreaterThanOrEqual(3)
  expect(references.results.every((row) => row.actor_operator_id !== f.targetOperatorId && row.subject_id === null)).toBe(true)
  expect((await env.DB.prepare("SELECT actor_operator_id,subject_id FROM audit_entries WHERE workspace_id=? AND subject_type='flow'").bind(f.workspaceId).all()).results).toEqual([{actor_operator_id:null,subject_id:flow.id}])
  expect(await env.DB.prepare("SELECT count(*) AS n FROM audit_entries WHERE workspace_id = ? AND kind = 'operator.removed'").bind(f.workspaceId).first()).toEqual({ n: 1 })
  const denied = await request('/api/app/operators', { headers: { cookie } })
  expect(denied.status).toBe(401)
}, 60000)

contract(['BASE-OPS-003', 'BASE-DATA-003'], 'makes local delivery idempotent and prevents a delayed writer or audit event from restoring erased references', async () => {
  const f = await custodyFixture('102')
  const sender = new LocalDevelopmentMailSender(f.repository)
  const message = { to: f.email, magicLinkUrl: `http://localhost/auth/magic-links/${f.token}`, expiresAt: f.message.expiresAt, deliveryIdempotencyKey: f.message.id }
  await sender.sendMagicLink(message)
  await sender.sendMagicLink(message)
  expect(await env.DB.prepare('SELECT count(*) AS n FROM local_dev_inbox WHERE id = ?').bind(f.message.id).first()).toEqual({ n: 1 })
  await expect(f.repository.addLocalInboxMessage({ ...f.message, magicLinkToken: 'c'.repeat(64) })).rejects.toThrow('no longer deliverable')
  const realBatch = createD1BatchExecutor(env.DB)
  const lateWriter = new AuthRepository(createDatabase(env.DB), {
    async execute(statements) {
      expect(await f.repository.removeOperator(f)).toBe('removed')
      return realBatch.execute(statements)
    },
  })
  await expect(lateWriter.addLocalInboxMessage(f.message)).rejects.toThrow('no longer deliverable')
  await new AuditRepository(createDatabase(env.DB)).create({ id: 'late-audit-102', workspaceId: f.workspaceId, kind: 'auth.magic_link_sent', actorOperatorId: f.targetOperatorId, subjectType: 'operator', subjectId: f.targetOperatorId, detailsJson: JSON.stringify({ providerMessageId: 'synthetic-private-provider-reference' }), createdAt: f.now })
  expect(await env.DB.prepare("SELECT actor_operator_id, subject_id, details_json FROM audit_entries WHERE id = 'late-audit-102'").first()).toEqual({ actor_operator_id: null, subject_id: null, details_json: '{}' })
  expect(await env.DB.prepare('SELECT count(*) AS n FROM local_dev_inbox WHERE to_email = ?').bind(f.email).first()).toEqual({ n: 0 })
}, 60000)

contract(['BASE-OPS-005', 'BASE-DATA-003'], 'rolls every removal effect back when its required audit record fails', async () => {
  const f = await custodyFixture('103')
  await f.repository.addLocalInboxMessage(f.message)
  const tables = ['operators', 'operator_sessions', 'auth_magic_links', 'local_dev_inbox', 'audit_entries']
  const snapshot = async () => (await env.DB.batch(tables.map((table) => env.DB.prepare(`SELECT * FROM ${table} ORDER BY id`)))).map((result) => result.results)
  const before = await snapshot()
  await env.DB.exec("CREATE TRIGGER fail_removal_audit BEFORE INSERT ON audit_entries WHEN NEW.kind = 'operator.removed' BEGIN SELECT RAISE(ABORT, 'review audit failure'); END")
  try { await expect(f.repository.removeOperator(f)).rejects.toThrow() }
  finally { await env.DB.exec('DROP TRIGGER fail_removal_audit') }
  expect(await snapshot()).toEqual(before)
}, 60000)

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

it('cleans delivered local credentials when an invitation fails after delivery', async () => {
  const f = await custodyFixture('105')
  await f.repository.addLocalInboxMessage(f.message)
  await f.repository.discardUninvitedOperator(f.workspaceId, f.targetOperatorId)
  expect(await env.DB.prepare('SELECT count(*) AS n FROM local_dev_inbox WHERE id = ?').bind(f.message.id).first()).toEqual({ n: 0 })
  expect(await env.DB.prepare('SELECT id FROM operators WHERE id = ?').bind(f.targetOperatorId).first()).toBeNull()
  expect(await env.DB.prepare('SELECT actor_operator_id, subject_id FROM audit_entries WHERE id = ?').bind('audit-105').first()).toEqual({ actor_operator_id: null, subject_id: null })
}, 60000)

it.each(['auth.magic_link_sent', 'operator.invited'])('rolls invitation custody back after redemption when %s auditing fails', async (failedKind) => {
  const f = await custodyFixture(failedKind === 'operator.invited' ? '107' : '106')
  const audit = new AuditService(new AuditRepository(createDatabase(env.DB)))
  const platform = createPencilPlatform('http://localhost', env)
  const local = baseMailSender(platform.configuration.mail, env.DB)
  const actorCookie = await sessionCookie(`actor-${failedKind === 'operator.invited' ? '107' : '106'}@example.test`)
  let invitedId = ''
  let redeemedToken = ''
  const service = new AuthService(f.repository, platform, audit, {
    async send(message) {
      const outcome = await local.send(message)
      const invited = await f.repository.findOperatorByEmail(message.to[0])
      invitedId = invited!.id
      const token = new URL(message.text.match(/http[^\s]+/)![0]).searchParams.get('token')!
      redeemedToken = (await service.native.confirmLink(new Request('http://localhost/auth/confirm', { method: 'POST', headers: { Host: 'localhost', Origin: 'http://localhost' } }), { token })).cookie.split(';')[0].split('=')[1]
      return outcome
    },
  })
  const email = `failed-invitation-${failedKind}@example.test`
  await env.DB.exec(`CREATE TRIGGER fail_invitation_audit BEFORE INSERT ON audit_entries WHEN NEW.kind = '${failedKind}' BEGIN SELECT RAISE(ABORT, 'review invitation audit failure'); END`)
  try {
    await expect(service.inviteOperator({ workspaceId: f.workspaceId, actorOperatorId: f.actorOperatorId, email, displayName: 'Failed invited operator', runtime: { appOrigin: 'http://localhost' }, request: new Request('http://localhost/api/app/operators', { method: 'POST', headers: { Host: 'localhost', Origin: 'http://localhost', Cookie: actorCookie } }) })).rejects.toThrow()
  } finally { await env.DB.exec('DROP TRIGGER fail_invitation_audit') }
  expect(invitedId).not.toBe('')
  expect(redeemedToken).toMatch(/^[A-Za-z0-9_-]{43}$/)
  expect(await f.repository.findOperatorByEmail(email)).toBeUndefined()
  expect(await service.getSession(new Request('http://localhost/app', { headers: { Host: 'localhost', Cookie: `operator_session_local_80=${redeemedToken}` } }))).toBeUndefined()
  for (const table of ['operator_sessions', 'auth_magic_links']) {
    expect(await env.DB.prepare(`SELECT count(*) AS n FROM ${table} WHERE operator_id = ?`).bind(invitedId).first()).toEqual({ n: 0 })
  }
  expect(await env.DB.prepare('SELECT count(*) AS n FROM local_dev_inbox WHERE to_email = ?').bind(email).first()).toEqual({ n: 0 })
  expect(await env.DB.prepare("SELECT count(*) AS n FROM audit_entries WHERE actor_operator_id = ? OR (subject_type = 'operator' AND subject_id = ?)").bind(invitedId, invitedId).first()).toEqual({ n: 0 })
  expect(await env.DB.prepare("SELECT count(*) AS n FROM audit_entries WHERE workspace_id = ? AND kind = 'operator.invitation_rolled_back' AND subject_id IS NULL").bind(f.workspaceId).first()).toEqual({ n: 1 })
}, 60000)

it.each(['auth.magic_link_sent', 'operator.invited'])('preserves the last accessible operator when the inviter leaves before %s fails', async (failedKind) => {
  const f = await custodyFixture(failedKind === 'operator.invited' ? '109' : '108')
  expect(await f.repository.removeOperator(f)).toBe('removed')
  const audit = new AuditService(new AuditRepository(createDatabase(env.DB)))
  const platform = createPencilPlatform('http://localhost', env)
  const local = baseMailSender(platform.configuration.mail, env.DB)
  const actorCookie = await sessionCookie(`actor-${failedKind === 'operator.invited' ? '109' : '108'}@example.test`)
  let invitedId = ''
  let redeemedToken = ''
  const service = new AuthService(f.repository, platform, audit, {
    async send(message) {
      const outcome = await local.send(message)
      invitedId = (await f.repository.findOperatorByEmail(message.to[0]))!.id
      const token = new URL(message.text.match(/http[^\s]+/)![0]).searchParams.get('token')!
      redeemedToken = (await service.native.confirmLink(new Request('http://localhost/auth/confirm', { method: 'POST', headers: { Host: 'localhost', Origin: 'http://localhost' } }), { token })).cookie.split(';')[0].split('=')[1]
      expect(await f.repository.removeOperator({ workspaceId: f.workspaceId, actorOperatorId: f.actorOperatorId, targetOperatorId: f.actorOperatorId })).toBe('removed')
      return outcome
    },
  })
  const email = `retained-invitation-${failedKind}@example.test`
  await env.DB.exec(`CREATE TRIGGER fail_last_invitation_audit BEFORE INSERT ON audit_entries WHEN NEW.kind = '${failedKind}' BEGIN SELECT RAISE(ABORT, 'review last invitation audit failure'); END`)
  try {
    await expect(service.inviteOperator({ workspaceId: f.workspaceId, actorOperatorId: f.actorOperatorId, email, displayName: 'Retained invited operator', runtime: { appOrigin: 'http://localhost' }, request: new Request('http://localhost/api/app/operators', { method: 'POST', headers: { Host: 'localhost', Origin: 'http://localhost', Cookie: actorCookie } }) })).rejects.toMatchObject({ code: 'INVITATION_RECOVERY_REQUIRED', message: expect.stringContaining('remains to preserve protected workspace access') })
  } finally { await env.DB.exec('DROP TRIGGER fail_last_invitation_audit') }
  expect(await env.DB.prepare('SELECT id FROM operators WHERE workspace_id = ?').bind(f.workspaceId).all()).toMatchObject({ results: [{ id: invitedId }] })
  expect(await service.getSession(new Request('http://localhost/app', { headers: { Host: 'localhost', Cookie: `operator_session_local_80=${redeemedToken}` } }))).toMatchObject({ operatorId: invitedId })
  expect((await developmentInbox(path => request(path), email)).messages).toHaveLength(1)
  expect(await env.DB.prepare("SELECT count(*) AS n FROM audit_entries WHERE workspace_id = ? AND kind = 'operator.invitation_rolled_back'").bind(f.workspaceId).first()).toEqual({ n: 0 })
  expect(await env.DB.prepare("SELECT actor_operator_id, subject_id FROM audit_entries WHERE workspace_id = ? AND kind = 'operator.invitation_retained'").bind(f.workspaceId).first()).toEqual({ actor_operator_id: null, subject_id: invitedId })
}, 60000)
