import { devKeyHeaders } from '../helpers/dev-key.mjs'
import { developmentInbox } from '../helpers/development-outbox'
import { applyD1Migrations, env, SELF, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { foundationFixture } from './foundation-fixture'
declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(() => applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__))
let serial = 0
async function request(path: string, method = 'GET', cookie = '', body?: string, origin = 'http://localhost') {
  return SELF.fetch(`http://localhost${path}`, { method, redirect: 'manual', headers: { Host: 'localhost', ...devKeyHeaders, cookie, origin, 'content-type': 'application/json', 'CF-Connecting-IP': `198.19.1.${++serial}` }, ...(body === undefined ? {} : { body }) })
}
async function login(email: string) {
  expect((await request('/auth/magic-link', 'POST', '', JSON.stringify({ email }))).status).toBe(202)
  const inbox = await developmentInbox(path => request(path), email)
  return (await request('/auth/confirm', 'POST', '', JSON.stringify({ token: inbox.messages[0].magicLinkToken }))).headers.get('set-cookie')!.split(';')[0]
}
contract(['BASE-INPUT-001', 'BASE-ACCESS-004'], 'every private mutation route rejects sessionless, cross-origin and malformed requests before product writes', async () => {
  const f = await foundationFixture('boundary-matrix')
  const cookie = await login('owner@aurora-coffee.test')
  const flow = `/api/app/flows/${f.flow.flowId}`
  const routes: Array<[string, string]> = [
    ['PUT','/api/app/workspace'],['POST','/api/app/operators'],['DELETE',`/api/app/operators/${f.operatorId}`],
    ['POST','/api/app/flows'],['POST',`${flow}/duplicate`],['PUT',`${flow}/draft`],['POST',`${flow}/draft/steps`],
    ['POST',`${flow}/draft/steps/nonexistent/duplicate`],['DELETE',`${flow}/draft/steps/nonexistent`],['PUT',`${flow}/draft/order`],
    ['PUT',`${flow}/draft/branches`],['POST',`${flow}/draft/preview`],['POST',`${flow}/publish`],['POST',`${flow}/close`],['POST',`${flow}/reopen`],['POST',`${flow}/archive`],
    ['POST','/api/app/responses/nonexistent/release'],['DELETE','/api/app/responses/nonexistent/quarantine'],['DELETE','/api/app/responses/nonexistent'],
    ['POST','/api/app/distribution/contacts'],['POST','/api/app/distribution/contacts/nonexistent/erase'],['POST','/api/app/distribution/contacts/nonexistent/consent'],
    ['POST',`${flow}/distribution`],['POST','/api/app/distribution/deliveries/nonexistent/retry'],
  ]
  const names = (await env.DB.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT IN ('public_rate_limit_windows','operator_sessions')").all<{ name: string }>()).results.map(r => r.name)
  const snapshot = async () => (await env.DB.batch(names.map(name => env.DB.prepare(`SELECT * FROM "${name}" ORDER BY rowid`)))).map(r => r.results)
  const before = await snapshot()
  for (const [method, path] of routes) {
    expect((await request(path, method, '', '{')).status, path).toBe(401)
    expect((await request(path, method, cookie, '{', 'https://untrusted.invalid')).status, path).toBe(403)
    const malformed = await request(path, method, cookie, '{')
    expect(malformed.status, path).toBe(400)
    expect(await malformed.json()).toMatchObject({ error: 'VALIDATION_ERROR' })
  }
  expect(await snapshot()).toEqual(before)
}, 60_000)
contract(['OPER-001', 'BASE-ACCESS-004'], 'a second equal operator edits another operators flow while foreign workspace IDs never become ownership authority', async () => {
  const f = await foundationFixture('equal-operators')
  await f.add({ kind: 'question', questionType: 'short_text', prompt: 'Original', required: true })
  await f.add({ kind: 'completion', questionType: null, prompt: 'Done' })
  const owner = await login('owner@aurora-coffee.test')
  expect((await request('/api/app/operators', 'POST', owner, JSON.stringify({ email: 'peer@example.test', displayName: 'Synthetic peer' }))).status).toBe(201)
  const peer = await login('peer@example.test')
  const draft = await f.draft()
  for (const path of ['/api/app/dashboard','/api/app/workspace','/api/app/operators',`/api/app/flows/${f.flow.flowId}/draft`,'/api/app/distribution/contacts']) expect((await request(path, 'GET', peer)).status).toBe(200)
  expect((await request(`/api/app/flows/${f.flow.flowId}/draft`, 'PUT', peer, JSON.stringify({ stepId: draft.steps[0].id, prompt: 'Peer accepted edit', required: true, expectedVersion: draft.flow.draftVersion, workspaceId: 'forged' }))).status).toBe(200)
  expect((await f.draft()).steps[0].prompt).toBe('Peer accepted edit')
  await f.publish()
  for (const path of ['results','ledger','distribution','responses/export/start?format=json']) expect((await request(`/api/app/flows/${f.flow.flowId}/${path}`, 'GET', peer)).status).toBe(200)
  const stamp = new Date().toISOString()
  await env.DB.prepare("INSERT INTO workspaces (id,name,time_zone,created_at,updated_at) VALUES ('foreign-boundary-workspace','Foreign','UTC',?,?)").bind(stamp,stamp).run()
  const other = await f.services.flows.createDraftFlow({ workspaceId: 'foreign-boundary-workspace', title: 'Private foreign title', slug: 'private-foreign-title' })
  for (const path of ['draft','results','ledger','distribution','responses/export/start?format=json']) {
    const response = await request(`/api/app/flows/${other.id}/${path}`, 'GET', peer)
    expect(response.status, path).toBe(404)
    expect(await response.text()).not.toContain('Private foreign title')
  }
  for (const suffix of ['close','archive','reopen']) expect((await request(`/api/app/flows/${other.id}/${suffix}`, 'POST', peer, '{}')).status).toBe(404)
  expect((await request(`/api/app/flows/${f.flow.flowId}/close`, 'POST', peer, '{}')).status).toBe(204)
  const actors = (await env.DB.prepare("SELECT actor_operator_id FROM audit_entries WHERE subject_id = ? AND kind = 'flow.closed'").bind(f.flow.flowId).all()).results
  const operator = await env.DB.prepare("SELECT id FROM operators WHERE email = 'peer@example.test'").first<{ id: string }>()
  expect(actors).toEqual([{ actor_operator_id: operator!.id }])
}, 60_000)

contract(['WS-001', 'WS-002', 'BASE-PUBLIC-002'], 'workspace settings persist through authenticated routes and reject invalid clocks and embed hosts without writes', async () => {
  await foundationFixture('workspace-settings-validation')
  const cookie = await login('owner@aurora-coffee.test')
  const read = async () => {
    const response = await request('/api/app/workspace', 'GET', cookie)
    expect(response.status).toBe(200)
    return response.json() as Promise<import('../../src/core/app/api').WorkspaceSettings>
  }
  const update = (input: unknown) => request('/api/app/workspace', 'PUT', cookie, JSON.stringify(input))
  const original = await read()
  const clock = { timeZone: 'Australia/Brisbane', sendingWindowStart: '09:00', sendingWindowEnd: '17:00' }
  const settings = { ...clock, reminderDelayHours: 37, embedAllowedOrigins: ['https://embed.example.test'] }
  try {
    const saved = await update(settings)
    expect(saved.status).toBe(200)
    expect(await saved.json()).toMatchObject(settings)
    const retained = await update(clock)
    expect(retained.status).toBe(200)
    expect(await retained.json()).toMatchObject(settings)
    const snapshot = () => env.DB.prepare('SELECT * FROM workspaces WHERE id = ?').bind(original.id).first()
    const before = await snapshot()
    expect(before).toMatchObject({ time_zone: clock.timeZone, sending_window_start: clock.sendingWindowStart, sending_window_end: clock.sendingWindowEnd, reminder_delay_hours: settings.reminderDelayHours, embed_allowed_origins_json: JSON.stringify(settings.embedAllowedOrigins) })
    expect(await read()).toMatchObject(settings)
    const invalidInputs = [
      { timeZone: 'GMT', sendingWindowStart: '09:00', sendingWindowEnd: '17:00' },
      { timeZone: 'UTC', sendingWindowStart: '17:00', sendingWindowEnd: '09:00' },
      { timeZone: 'UTC', sendingWindowStart: '24:00', sendingWindowEnd: '25:00' },
      ...['https://*.example.com', 'https://example.com/path', 'http://example.com', 'https://example.com?secret=x'].map(origin => ({ timeZone: 'UTC', sendingWindowStart: '09:00', sendingWindowEnd: '17:00', embedAllowedOrigins: [origin] })),
    ]
    for (const input of invalidInputs) {
      const response = await update({ ...settings, ...input })
      expect(response.status, JSON.stringify(input)).toBe(400)
      expect(await response.json()).toMatchObject({ error: 'VALIDATION_ERROR' })
      expect(await snapshot()).toEqual(before)
      expect(await read()).toMatchObject(settings)
    }
  } finally {
    expect((await update(original)).status).toBe(200)
  }
})
