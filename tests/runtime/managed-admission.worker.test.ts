import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect, test } from 'vitest'
import worker from '../../src/core/app/worker'
import type { WorkerBindings } from '../../src/core/app/environment'
import { editorPolicy } from '../../src/core/platform/management'

declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(async () => {
  await applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__)
  await applyD1Migrations(env.IMPORT_SECOND, __PENCIL_CORE_MIGRATIONS__)
})
const origin = 'http://localhost', issuer = 'https://management.example.test'
const installationId = crypto.randomUUID()
const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
const bindings = { ...env, APP_ORIGIN: origin, SEED_ADMIN_EMAIL: 'owner@example.test', SEED_SAMPLE_DATA: 'false', PENCIL_LOCAL_DEVELOPMENT: 'true', MAIL_PROVIDER: 'local',
  SESSION_SECRET: 'synthetic-managed-session-secret-at-least-32-characters', SETUP_TOKEN: 'synthetic-managed-setup-token-at-least-32-characters',
  RER_OWNER_CLAIM_ISSUER: issuer, RER_OWNER_CLAIM_INSTALLATION_ID: installationId, RER_OWNER_CLAIM_APP_ORIGIN: origin,
  RER_OWNER_CLAIM_PUBLIC_KEYS: JSON.stringify({ synthetic: await crypto.subtle.exportKey('jwk', pair.publicKey) }),
  RER_MANAGEMENT_ORIGIN: issuer, RER_INSTALLATION_ID: installationId } as WorkerBindings
const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
async function signed(changes = {}) {
  const now = Math.floor(Date.now() / 1000)
  const input = encode({ alg: 'ES256', typ: 'rer-owner-claim+jwt', kid: 'synthetic' }) + '.' + encode({ v: 1, iss: issuer, aud: origin, installationId, email: bindings.SEED_ADMIN_EMAIL, jti: crypto.randomUUID(), iat: now, exp: now + 240, ...changes })
  return input + '.' + Buffer.from(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, pair.privateKey, new TextEncoder().encode(input))).toString('base64url')
}
const request = (path: string, body?: unknown, cookie?: string, override = bindings, method = body === undefined ? 'GET' : 'POST') => worker.fetch(new Request(origin + path, {
  method, headers: { Host: 'localhost', Origin: origin, 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
}), override, {} as ExecutionContext)
const call = request
async function authority() {
  return (await env.DB.batch(['oa_bootstrap', 'oa_operators', 'oa_sessions', 'oc_owner_claims'].map(name => env.DB.prepare(`SELECT * FROM ${name} ORDER BY rowid`)))).map(result => result.results)
}

test('signed installation claims create native authority once, preserve rejected claims and reach Pencil through a cold service', async () => {
  const empty = await authority()
  expect((await call('/auth/owner-claim')).status).toBe(200)
  expect(await authority()).toEqual(empty)
  for (const changes of [{ aud: 'https://other.example.test' }, { iss: 'https://other.example.test' }, { installationId: 'other-installation' }, { email: 'other@example.test' }, { exp: Math.floor(Date.now() / 1000) - 1 }]) {
    expect((await call('/auth/owner-claim', { token: await signed(changes) })).status).toBe(403)
    expect(await authority()).toEqual(empty)
  }
  const forged = (await signed()).split('.')
  forged[2] = Buffer.from(new Uint8Array(64)).toString('base64url')
  expect((await call('/auth/owner-claim', { token: forged.join('.') })).status).toBe(403)
  expect(await authority()).toEqual(empty)
  expect((await call('/auth/owner-claim?token=synthetic-forbidden-query')).status).toBe(400)
  const firstClaim = await signed()
  // A real storage refusal must roll native authority and claim consumption
  // back with the product mapping, so an owner is never stranded halfway in.
  await env.DB.exec("CREATE TRIGGER synthetic_owner_mapping_failure BEFORE INSERT ON operators BEGIN SELECT RAISE(ABORT,'synthetic storage refusal'); END")
  expect((await call('/auth/owner-claim', { token: firstClaim, displayName: 'Pencil owner' })).status).toBe(409)
  expect(await authority()).toEqual(empty)
  expect((await env.DB.prepare('SELECT COUNT(*) n FROM operators').first())!.n).toBe(0)
  await env.DB.exec('DROP TRIGGER synthetic_owner_mapping_failure')
  const accepted = await call('/auth/owner-claim', { token: firstClaim, displayName: 'Pencil owner', returnTo: '/app' })
  expect(accepted.status).toBe(303)
  const cookie = accepted.headers.get('set-cookie')!.split(';')[0]
  expect((await call('/api/app/workspace', undefined, cookie)).status).toBe(200)
  const claimed = await authority()
  expect((await call('/auth/owner-claim', { token: await signed(), displayName: 'Second owner' })).status).toBe(409)
  expect(await authority()).toEqual(claimed)
  expect((await call('/auth/bootstrap', { token: bindings.SETUP_TOKEN, displayName: 'Replacement' })).status).toBe(409)
  expect((await call('/api/app/workspace', undefined, cookie)).status).toBe(200)
  expect((await env.DB.prepare('SELECT COUNT(*) n FROM operators').first())!.n).toBe(1)
  await env.DB.prepare('DELETE FROM operator_auth_links').run()
  expect((await call('/api/app/workspace', undefined, cookie)).status).toBe(401)
  expect((await call('/api/editor/config', undefined, cookie)).status).toBe(403)
  expect((await env.DB.prepare('SELECT COUNT(*) n FROM operator_auth_links').first())!.n).toBe(0)
})

test('editor grants require native owners, expire with their session, reveal only public config and revoke after native signout', async () => {
  const editorBindings = { ...bindings, DB: env.IMPORT_SECOND }
  const call = (path: string, body?: unknown, cookie?: string, override = editorBindings) => request(path, body, cookie, override)
  expect((await call('/api/editor/config')).status).toBe(403)
  const accepted = await call('/auth/bootstrap', { token: bindings.SETUP_TOKEN, displayName: 'Editor owner' })
  expect(accepted.status).toBe(303)
  const cookie = accepted.headers.get('set-cookie')!.split(';')[0]
  expect((await call('/api/editor/config', {}, cookie)).status).toBe(405)
  const response = await call('/api/editor/config', undefined, cookie)
  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toContain('no-store')
  const grant = await response.json<{ config: unknown; expiresAt: number }>()
  expect(grant.config).toEqual({ enabled: true, managementOrigin: issuer, installationId })
  expect(grant.expiresAt).toBeGreaterThan(Date.now())
  const session = await (await call('/auth/session', undefined, cookie)).json<{ expiresAt: number }>()
  expect(grant.expiresAt).toBeLessThanOrEqual(session.expiresAt)
  expect(Object.keys(grant).sort()).toEqual(['config', 'expiresAt'])
  expect(editorPolicy("script-src 'self'; frame-ancestors 'none'", bindings)).toContain("script-src 'self'")
  expect(editorPolicy('', bindings)).toContain(`frame-src 'self' ${issuer}`)
  expect(editorPolicy('', { ...bindings, RER_MANAGEMENT_ORIGIN: 'https://evil.example.test/path' })).not.toContain('evil.example.test')
  expect((await call('/api/editor/config', undefined, cookie, { ...editorBindings, RER_MANAGEMENT_ORIGIN: undefined, RER_INSTALLATION_ID: undefined })).status).toBe(404)
  expect((await call('/api/editor/config', undefined, cookie, { ...editorBindings, RER_MANAGEMENT_ORIGIN: 'https://evil.example.test/path' })).status).toBe(503)
  expect((await call('/auth/signout', {}, cookie)).status).toBe(204)
  expect((await call('/api/editor/config', undefined, cookie)).status).toBe(403)
  // Obtain a real native session for a second principal; a signed-in member still
  // cannot receive the editor grant, independently of old-session revocation.
  await env.IMPORT_SECOND.prepare("INSERT INTO oa_operators(id,email,display_name,role,status,created_at) VALUES('synthetic-member','member@example.test','Member','member','active',?)").bind(Date.now()).run()
  expect((await call('/auth/magic-link', { email: 'member@example.test' })).status).toBe(202)
  const message = JSON.parse((await env.IMPORT_SECOND.prepare('SELECT message FROM rer_mail_development_outbox ORDER BY sequence DESC LIMIT 1').first<{ message: string }>())!.message)
  const token = new URL(message.text.match(/http[^\s]+/)[0]).searchParams.get('token')!
  const member = await call('/auth/confirm', { token })
  expect(member.status).toBe(303)
  const memberCookie = member.headers.get('set-cookie')!.split(';')[0]
  expect((await call('/auth/session', undefined, memberCookie)).status).toBe(200)
  expect((await call('/api/editor/config', undefined, memberCookie)).status).toBe(403)
})
