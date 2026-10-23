import { applyD1Migrations, env, SELF, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import type { AuditPage, AuditOptions } from '../../src/core/features/audit'
import { developmentInbox } from '../helpers/mail-capture.mjs'
import { devKeyHeaders } from '../helpers/dev-key.mjs'
import { matureLoad } from './load-time-fixture'

declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
let serial = 0
function request(path: string, cookie = '', body?: unknown, method = body === undefined ? 'GET' : 'POST') {
  return SELF.fetch(`http://localhost${path}`, {
    method, redirect: 'manual', headers: { Host: 'localhost', Origin: 'http://localhost', cookie, 'Content-Type': 'application/json', 'CF-Connecting-IP': `198.18.190.${++serial % 250}` },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}
async function ok<T>(path: string, cookie: string, body?: unknown, method?: string): Promise<T> {
  const response = await request(path, cookie, body, method)
  expect(response.status, await response.clone().text()).toBeGreaterThanOrEqual(200)
  expect(response.status, path).toBeLessThan(300)
  return response.status === 204 ? undefined as T : response.json<T>()
}
async function login(email: string) {
  await ok('/auth/magic-link', '', { email })
  const inbox = await developmentInbox(path => SELF.fetch(`http://localhost${path}`, { headers: { Host: 'localhost', ...devKeyHeaders } }), email)
  const response = await request('/auth/confirm', '', { token: inbox.messages[0].magicLinkToken })
  expect(response.status).toBe(303)
  return response.headers.get('set-cookie')!.split(';')[0]
}
async function addStep(cookie: string, flowId: string, prompt: string) {
  const draft = await ok<{ flow: { draftVersion: number } }>(`/api/app/flows/${flowId}/draft`, cookie)
  return ok(`/api/app/flows/${flowId}/draft/steps`, cookie, { expectedVersion: draft.flow.draftVersion, step: { kind: 'question', questionType: 'long_text', prompt, required: false } })
}

beforeAll(async () => {
  await applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__)
  await ok('/health', '')
})

contract(['GOV-005', 'BASE-ACCESS-002', 'BASE-ACCESS-004', 'BASE-DATA-003'], 'native operators search and export safe audit snapshots without cross-workspace access, insertion drift or retained actor identities', async () => {
  const owner = await env.DB.prepare('SELECT id, email, workspace_id AS workspaceId FROM operators ORDER BY created_at, id LIMIT 1').first<{ id: string; email: string; workspaceId: string }>()
  expect(owner).not.toBeNull()
  const cookie = await login(owner!.email)
  const flow = await ok<{ id: string }>('/api/app/flows', cookie, { title: '=Private form title', slug: 'audit-viewer-proof' })
  for (const prompt of ['First audit change', 'Second audit change', 'Third audit change']) await addStep(cookie, flow.id, prompt)
  const timestamp = new Date(Date.now() - 10_000).toISOString()
  const sentinel = 'private-audit-answer-provider-sentinel@example.test'
  // Real emitted rows share a timestamp, as concurrent writes can. Extra stored
  // metadata exercises the reader's privacy boundary, not a fake audit service.
  await env.DB.prepare(`UPDATE audit_entries SET created_at = ?, details_json = ? WHERE workspace_id = ? AND subject_type = 'flow' AND subject_id = ? AND kind = 'flow.draft-mutated'`)
    .bind(timestamp, JSON.stringify({ feature: 'flow-builder', answers: sentinel, email: sentinel, providerMessageId: sentinel }), owner!.workspaceId, flow.id).run()
  const filter = new URLSearchParams({ actorId: owner!.id, flowId: flow.id, kind: 'flow.draft-mutated', from: timestamp, to: timestamp })
  const all = await ok<AuditPage>(`/api/app/audit?${filter}`, cookie)
  expect(all.rows).toHaveLength(3)
  expect(all.rows.every(row => row.actor?.id === owner!.id && row.form?.id === flow.id && row.createdAt === timestamp && row.kind === 'flow.draft-mutated')).toBe(true)
  expect(all.rows.map(row => row.id)).toEqual(all.rows.map(row => row.id).sort().reverse())
  expect(all.rows.every(row => Object.keys(row.details).length === 0)).toBe(true)
  expect(JSON.stringify(all)).not.toContain(sentinel)
  const first = await ok<AuditPage>(`/api/app/audit?${filter}&limit=2`, cookie)
  expect(first.rows).toHaveLength(2)
  expect(first.nextCursor).not.toBeNull()

  // A later real event is backdated into this exact window. Its rowid exceeds
  // the snapshot ceiling, so neither pagination nor export may admit it.
  await addStep(cookie, flow.id, 'Late audit change')
  const late = await env.DB.prepare('SELECT id FROM audit_entries WHERE workspace_id = ? AND subject_id = ? ORDER BY rowid DESC LIMIT 1').bind(owner!.workspaceId, flow.id).first<{ id: string }>()
  await env.DB.prepare('UPDATE audit_entries SET created_at = ? WHERE id = ?').bind(timestamp, late!.id).run()
  const second = await ok<AuditPage>(`/api/app/audit?${filter}&limit=2&cursor=${encodeURIComponent(first.nextCursor!)}`, cookie)
  const ids = [...first.rows, ...second.rows].map(row => row.id)
  expect(ids).toEqual(all.rows.map(row => row.id))
  expect(new Set(ids).size).toBe(ids.length)
  expect(second.nextCursor).toBeNull()
  expect(ids).not.toContain(late!.id)
  expect((await ok<AuditPage>(`/api/app/audit?${filter}`, cookie)).rows).toHaveLength(4)
  const exported = await request(`/api/app/audit/export?${filter}&cursor=${encodeURIComponent(first.snapshotCursor)}`, cookie)
  expect(exported.status).toBe(200)
  expect(exported.headers.get('content-type')).toContain('text/csv')
  expect(exported.headers.get('content-disposition')).toContain('attachment')
  const csv = await exported.text()
  expect(csv.trim().split('\r\n').slice(1).map(line => line.split(',')[0].replaceAll('"', ''))).toEqual(ids)
  expect(csv).not.toContain(late!.id)
  expect(csv).not.toContain(sentinel)
  expect(csv).toContain('"\'=Private form title"')

  const empty = await ok<AuditPage>(`/api/app/audit?${new URLSearchParams({ flowId: flow.id, from: new Date(Date.parse(timestamp) + 1).toISOString(), to: new Date(Date.parse(timestamp) + 2).toISOString() })}`, cookie)
  expect(empty.rows).toEqual([])
  const options = await ok<AuditOptions>('/api/app/audit/options?formSearch=Private', cookie)
  expect(options.forms.some(item => item.id === flow.id)).toBe(true)
  expect(options.actors.some(item => item.id === owner!.id)).toBe(true)
  expect(options.kinds).toContain('flow.draft-mutated')

  const contact = await ok<{ id: string }>('/api/app/distribution/contacts', cookie, { name: 'Private audit contact', email: sentinel })
  await ok(`/api/app/distribution/contacts/${contact.id}/consent`, cookie, { renewed: false, source: sentinel })
  await env.DB.prepare("UPDATE audit_entries SET details_json = ? WHERE workspace_id = ? AND subject_id = ? AND kind = 'contact.consent-changed'")
    .bind(JSON.stringify({ consent: 'opted-out', flowId: flow.id, email: sentinel, providerMessageId: sentinel }), owner!.workspaceId, contact.id).run()
  const consent = await ok<AuditPage>('/api/app/audit?kind=contact.consent-changed', cookie)
  expect(consent.rows).toHaveLength(1)
  expect(consent.rows[0]).toMatchObject({ form: null, details: { consent: 'opted-out' } })
  expect(JSON.stringify(consent)).not.toContain(sentinel)
  expect((await ok<AuditPage>(`/api/app/audit?kind=contact.consent-changed&flowId=${flow.id}`, cookie)).rows).toEqual([])
  await ok(`/api/app/distribution/contacts/${contact.id}/erase`, cookie, { confirm: true })
  const erased = await ok<AuditPage>('/api/app/audit?kind=contact.consent-changed', cookie)
  expect(erased.rows[0]).toMatchObject({ id: consent.rows[0].id, form: null, details: {} })

  // GOV-005 event families: a publish, connection changes, exports and an erasure appear in the viewer, its filters and the snapshot CSV with allowlisted details only.
  const connectionSecret = 'synthetic-pencil-connection-secret-sentinel'
  const events = await ok<{ id: string; slug: string }>('/api/app/flows', cookie, { title: 'Audit event families', slug: 'audit-event-families' })
  const eventDraft = async () => (await ok<{ flow: { draftVersion: number }; steps: Array<{ id: string }> }>(`/api/app/flows/${events.id}/draft`, cookie))
  await ok(`/api/app/flows/${events.id}/draft/steps`, cookie, { expectedVersion: (await eventDraft()).flow.draftVersion, step: { kind: 'question', questionType: 'long_text', prompt: 'Event proof question', required: false } })
  await ok(`/api/app/flows/${events.id}/draft/steps`, cookie, { expectedVersion: (await eventDraft()).flow.draftVersion, step: { kind: 'completion', questionType: null, prompt: 'Recorded' } })
  await ok(`/api/app/flows/${events.id}/publish`, cookie, { expectedVersion: (await eventDraft()).flow.draftVersion })
  await ok('/api/app/connections/task', cookie, { url: 'https://receiver.example.test/tasks', apiKey: connectionSecret }, 'PUT')
  await ok('/api/app/connections/task', cookie, undefined, 'DELETE')
  const hook = await ok<{ endpoint: { id: string }; secret: string }>('/api/app/webhooks', cookie, { url: 'https://receiver.example.test/pencil' })
  await ok(`/api/app/webhooks/${hook.endpoint.id}`, cookie, undefined, 'DELETE')
  await ok(`/api/app/flows/${events.id}/responses/export/start?format=csv`, cookie)
  await ok('/api/app/backup/export', cookie, {}, 'POST')
  const eventSession = await ok<{ sessionId: string; sessionToken: string; loadTime: string; flow: { steps: Array<{ id: string; kind: string }> } }>(`/api/public/flows/${events.slug}/sessions`, '', { deviceClass: 'desktop', source: 'direct' })
  await matureLoad(eventSession)
  const submitted = await ok<{ responseId: string }>(`/api/public/flows/${events.slug}/responses`, '', { sessionId: eventSession.sessionId, sessionToken: eventSession.sessionToken, loadTime: eventSession.loadTime, idempotencyKey: crypto.randomUUID(), answers: [{ stepId: eventSession.flow.steps.find(step => step.kind === 'question')!.id, value: sentinel }], honeypot: '' })
  await ok(`/api/app/responses/${submitted.responseId}`, cookie, undefined, 'DELETE')
  const families = await ok<AuditPage>('/api/app/audit?limit=100', cookie)
  const rows = (kind: string) => families.rows.filter(row => row.kind === kind)
  expect(rows('flow.published')).toMatchObject([{ form: { id: events.id }, details: { revision: 1 }, actor: { id: owner!.id } }])
  expect(rows('connection.saved').map(row => row.details.connection).sort()).toEqual(['task', 'webhook'])
  expect(rows('connection.removed').map(row => row.details.connection).sort()).toEqual(['task', 'webhook'])
  expect(rows('export.created').map(row => row.details.export).sort()).toEqual(['backup', 'responses'])
  expect(rows('response.erased')).toHaveLength(1)
  expect(rows('contact.erased')[0].details).toMatchObject({ contacts: 1 })
  for (const text of [connectionSecret, hook.secret, sentinel]) expect(JSON.stringify(families)).not.toContain(text)
  expect((await ok<AuditPage>(`/api/app/audit?kind=export.created&flowId=${events.id}`, cookie)).rows).toHaveLength(1)
  const exports = await ok<AuditPage>('/api/app/audit?kind=export.created', cookie)
  const snapshot = await request(`/api/app/audit/export?kind=export.created&cursor=${encodeURIComponent(exports.snapshotCursor)}`, cookie)
  expect(snapshot.status).toBe(200)
  const eventsCsv = await snapshot.text()
  expect(eventsCsv.trim().split('\r\n')).toHaveLength(3)
  expect(eventsCsv).toContain('export.created')
  for (const text of [connectionSecret, hook.secret, sentinel, owner!.email]) expect(eventsCsv).not.toContain(text)
  // No door writes or deletes audit entries.
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) expect((await request('/api/app/audit', cookie, {}, method)).status, method).toBeGreaterThanOrEqual(400)
  expect((await env.DB.prepare("SELECT count(*) AS n FROM audit_entries WHERE kind IN ('flow.published','connection.saved','export.created')").first<{ n: number }>())!.n).toBe(5)

  const now = new Date().toISOString(), foreignWorkspace = crypto.randomUUID(), foreignActor = crypto.randomUUID()
  const { id: peer } = await ok<{id:string}>('/api/app/operators', cookie, {email:'peer-audit@example.test',displayName:'Removed private actor'})
  await env.DB.batch([
    env.DB.prepare('INSERT INTO workspaces(id,name,time_zone,created_at,updated_at) VALUES(?,?,?,?,?)').bind(foreignWorkspace, 'Foreign audit workspace', 'UTC', now, now),
    env.DB.prepare('INSERT INTO operators(id,workspace_id,email,display_name,is_setup_operator,created_at,updated_at) VALUES(?,?,?,?,0,?,?)').bind(foreignActor, foreignWorkspace, 'foreign-audit@example.test', 'Foreign audit actor', now, now),
  ])
  const [foreignCookie, peerCookie] = await Promise.all([login('foreign-audit@example.test'), login('peer-audit@example.test')])
  const foreignFlow = await ok<{ id: string }>('/api/app/flows', foreignCookie, { title: 'Foreign audit form', slug: 'foreign-audit-proof' })
  await addStep(foreignCookie, foreignFlow.id, 'Foreign audit event')
  expect((await ok<AuditPage>(`/api/app/audit?flowId=${foreignFlow.id}`, foreignCookie)).rows).toHaveLength(1)
  for (const kind of ['flow.published', 'connection.saved', 'export.created']) expect((await ok<AuditPage>(`/api/app/audit?kind=${kind}`, foreignCookie)).rows).toEqual([])
  for (const query of [`actorId=${foreignActor}`, `flowId=${foreignFlow.id}`, 'actorId=missing-audit-actor', 'flowId=missing-audit-form', `workspaceId=${foreignWorkspace}`]) {
    for (const path of ['/api/app/audit', '/api/app/audit/export']) expect((await request(`${path}?${query}`, cookie)).status).toBe(400)
  }
  const token = first.snapshotCursor.split('.')
  token[2] = (token[2][0] === 'A' ? 'B' : 'A') + token[2].slice(1)
  for (const path of ['/api/app/audit', '/api/app/audit/export']) {
    expect((await request(`${path}?${filter}&cursor=${token.join('.')}`, cookie)).status).toBe(400)
    expect((await request(`${path}?${filter}&cursor=${encodeURIComponent(first.snapshotCursor)}`, foreignCookie)).status).toBe(400)
    expect((await request(`${path}?${filter}&cursor=${encodeURIComponent(first.snapshotCursor)}`, peerCookie)).status).toBe(400)
    expect((await request(path)).status).toBe(401)
  }
  expect((await request('/api/app/audit/options')).status).toBe(401)
  expect((await request(`/api/app/audit?flowId=${flow.id}&cursor=${encodeURIComponent(first.snapshotCursor)}`, cookie)).status).toBe(400)
  await addStep(peerCookie, flow.id, 'Removed actor audit event')
  const peerRows = await ok<AuditPage>(`/api/app/audit?actorId=${peer}&flowId=${flow.id}`, cookie)
  expect(peerRows.rows).toHaveLength(1)
  expect(peerRows.rows[0].actor?.name).toBe('Removed private actor')
  await ok(`/api/app/operators/${peer}`, cookie, undefined, 'DELETE')
  const anonymised = await ok<AuditPage>(`/api/app/audit?flowId=${flow.id}`, cookie)
  expect(anonymised.rows.find(row => row.id === peerRows.rows[0].id)?.actor).toBeNull()
  expect(JSON.stringify(anonymised)).not.toContain('Removed private actor')
  expect((await request('/api/app/audit', peerCookie)).status).toBe(401)
}, 60_000)
