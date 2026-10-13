import { devKeyHeaders } from '../helpers/dev-key.mjs'
import { applyD1Migrations, env, SELF, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect, test } from 'vitest'
import { developmentInbox } from '../helpers/development-outbox'
declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
const origin = 'http://localhost'
const request = (path: string, init?: RequestInit) => SELF.fetch(origin + path, { ...init, headers: { Host: 'localhost', Origin: origin, ...devKeyHeaders, ...init?.headers }, redirect: 'manual' })
const post = (path: string, body: unknown, cookie = '', suppliedOrigin = origin) => request(path, { method: 'POST', headers: { Cookie: cookie, Origin: suppliedOrigin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
beforeAll(async () => { await applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__); await request('/health') })
test('first-run mutation uses the authenticated native owner and tenant, refuses unsafe bodies/origins and preserves other workspaces', async () => {
  const email = 'owner@aurora-coffee.test'
  await post('/auth/magic-link', { email })
  const inbox = await developmentInbox(path => request(path), email)
  const response = await post('/auth/confirm', { token: inbox.messages[0].magicLinkToken })
  expect(response.status).toBe(303)
  const cookie = response.headers.get('set-cookie')!.split(';')[0]
  const owner = await env.DB.prepare('SELECT o.workspace_id, a.id FROM operators o JOIN operator_auth_links l ON l.operator_id=o.id JOIN oa_operators a ON a.id=l.auth_id WHERE o.email=?').bind(email).first<{ workspace_id: string; id: string }>()
  const now = new Date().toISOString()
  await env.DB.prepare('INSERT INTO workspaces(id,name,time_zone,sending_window_start,sending_window_end,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').bind('synthetic-other-workspace','Other tenant','UTC','09:00','17:00',now,now).run()
  await env.DB.prepare('UPDATE workspaces SET first_run_completed_at=NULL WHERE id=?').bind(owner!.workspace_id).run()
  const input = { name: 'Configured tenant', timeZone: 'Australia/Brisbane' }
  expect((await post('/setup', input)).status).toBe(401)
  expect((await post('/setup', input, cookie, 'https://other.example.test')).status).toBe(403)
  expect((await post('/setup', { ...input, workspaceId: 'synthetic-other-workspace' }, cookie)).status).toBe(400)
  expect((await post('/setup', { ...input, timeZone: 'invented/zone' }, cookie)).status).toBe(400)
  await env.DB.prepare("INSERT INTO oa_operators(id,email,display_name,role,status,created_at) VALUES('synthetic-setup-member','setup-member@example.test','Member','member','active',?)").bind(Date.now()).run()
  expect((await post('/auth/magic-link', { email: 'setup-member@example.test' })).status).toBe(202)
  const memberInbox = await developmentInbox(path => request(path), 'setup-member@example.test')
  const memberSignIn = await post('/auth/confirm', { token: memberInbox.messages[0].magicLinkToken })
  expect(memberSignIn.status).toBe(303)
  const memberCookie = memberSignIn.headers.get('set-cookie')!.split(';')[0]
  expect((await post('/setup', input, memberCookie)).status).toBe(403)
  const complete = await post('/setup', input, cookie)
  expect(complete.status).toBe(303); expect(complete.headers.get('location')).toBe('/app')
  const workspace = await env.DB.prepare('SELECT name,time_zone,first_run_completed_at FROM workspaces WHERE id=?').bind(owner!.workspace_id).first<{ name: string; time_zone: string; first_run_completed_at: string }>()
  expect(workspace!.name).toBe(input.name); expect(workspace!.time_zone).toBe(input.timeZone); expect(Number.isFinite(Date.parse(workspace!.first_run_completed_at))).toBe(true)
  expect(await env.DB.prepare('SELECT name,first_run_completed_at FROM workspaces WHERE id=?').bind('synthetic-other-workspace').first()).toEqual({ name: 'Other tenant', first_run_completed_at: null })
})
