import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect, vi } from 'vitest'
import { contract } from '../../src/test/contract'
import worker from '../../src/core/app/worker'
import type { WorkerBindings } from '../../src/core/app/environment'
declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(() => applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__))
const origin = 'https://pencil.example.test'
const secret = 'synthetic-auth-session-secret-at-least-32-characters'
const setup = 'synthetic-setup-secret-distinct-at-least-32-characters'
const bindings = () => ({ ...env, APP_ORIGIN: origin, PENCIL_BUILD_ID: 'base-auth-proof', SESSION_SECRET: secret,
  SETUP_TOKEN: setup, SEED_ADMIN_EMAIL: 'first@example.test', MAIL_PROVIDER: 'sendgrid', MAIL_API_KEY: 'synthetic-mail-key', MAIL_FROM: 'no-reply@example.test', PENCIL_LOCAL_DEVELOPMENT: 'false', SEED_SAMPLE_DATA: 'false' }) as WorkerBindings
function run(path: string, body?: unknown, cookie?: string) {
  return raw(new Request(origin + path, { method: body === undefined ? 'GET' : 'POST', headers: { Host: 'pencil.example.test', Origin: origin, 'CF-Connecting-IP': '192.0.2.60', 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }))
}
const raw = (request: Request) => worker.fetch(request, bindings(), {} as ExecutionContext)
const credential = (response: Response) => response.headers.get('set-cookie')!.split(';')[0]
let setupCookie: string | undefined
async function bootstrap() { if (setupCookie) return setupCookie; const response = await run('/auth/bootstrap', { token: setup, displayName: 'First operator' }); expect(response.status).toBe(303); setupCookie = credential(response); return setupCookie }
async function counts() {
  return (await env.DB.batch(['oa_tokens', 'oa_sessions', 'oa_operators', 'operators', 'operator_auth_links'].map(table => env.DB.prepare(`SELECT * FROM ${table} ORDER BY id`.replace('operator_auth_links ORDER BY id', 'operator_auth_links ORDER BY operator_id'))))).map(row => row.results)
}
contract(['BASE-ACCESS-001','OPER-003','BASE-SECRET-001'], 'Base bootstraps once, signs in only existing operators and confirms with a read-only GET before a single-use POST', async () => {
  const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 202, headers: { 'X-Message-Id': 'synthetic-sendgrid' } }))
  try {
    const incomplete = await worker.fetch(new Request(origin+'/health'), {...bindings(), SETUP_TOKEN:undefined}, {} as ExecutionContext)
    expect(incomplete.status).toBe(503)
    expect(await incomplete.json()).toEqual({status:'not-ready',message:'SETUP_TOKEN is required until the first operator is established.'})
    expect((await run('/auth/bootstrap', { token: 'incorrect', displayName: 'Unadmitted' })).status).toBe(403)
    expect(await env.DB.prepare('SELECT count(*) n FROM oa_operators').first()).toEqual({ n: 0 })
    const first = await bootstrap()
    expect(first).toMatch(/^__Host-operator_session=[A-Za-z0-9_-]{43}$/)
    expect((await run('/auth/bootstrap', { token: setup, displayName: 'Replacement' })).status).toBe(409)
    const product = await env.DB.prepare('SELECT id,is_setup_operator FROM operators').first<{ id: string; is_setup_operator: number }>()
    expect(product!.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/)
    expect(product!.is_setup_operator).toBe(1)
    expect(await env.DB.prepare('SELECT count(*) n FROM operator_auth_links').first()).toEqual({ n: 1 })
    const unknown = await run('/auth/magic-link', { email: 'unknown@example.test' })
    const known = await run('/auth/magic-link', { email: 'FIRST@example.test' })
    expect(unknown.status).toBe(202); expect(known.status).toBe(202)
    expect(await unknown.json()).toEqual(await known.json())
    expect(fetcher).toHaveBeenCalledTimes(1)
    const [url, options] = fetcher.mock.calls[0]
    expect(url).toBe('https://api.sendgrid.com/v3/mail/send')
    const payload = JSON.parse(String(options!.body))
    const link = payload.content.find((part: { type: string }) => part.type === 'text/plain').value.match(/https[^\s]+/)[0]
    const token = new URL(link).searchParams.get('token')!
    expect(payload.subject).toBe('Your sign-in link for Pencil')
    expect(payload.content.map((part: { type: string }) => part.type).sort()).toEqual(['text/html', 'text/plain'])
    for (const part of payload.content) {
      expect(part.value).toContain('This link works once and expires in 15 minutes.')
      expect(part.value.split(token)).toHaveLength(2)
    }
    expect(JSON.stringify(payload)).not.toContain(secret)
    expect(JSON.stringify(payload)).not.toContain('synthetic-mail-key')
    const before = await counts()
    for (const method of ['GET','HEAD']) {
      const response = await raw(new Request(link, { method }))
      expect(response.status).toBe(200)
      expect(response.headers.get('set-cookie')).toBeNull()
      const document = await response.text()
      if (method === 'HEAD') expect(document).toBe('')
      else { expect(document).toContain('Confirm sign-in to Pencil'); expect(document).toContain('This link works once') }
      expect(await counts()).toEqual(before)
    }
    const responses = await Promise.all([run('/auth/confirm', { token }), run('/auth/confirm', { token })])
    expect(responses.map(response => response.status).sort()).toEqual([303,400])
    const cookie = responses.find(response => response.status === 303)!.headers.get('set-cookie')!
    expect(cookie).toContain('; Secure'); expect(cookie).toContain('HttpOnly'); expect(cookie).toContain('SameSite=Lax')
    expect(await env.DB.prepare('SELECT count(*) n FROM oa_sessions').first()).toEqual({ n: 2 })
    expect((await run('/api/app/dashboard', undefined, cookie.split(';')[0])).status).toBe(200)
    expect((await run('/auth/signout', {}, cookie.split(';')[0])).status).toBe(204)
    expect((await run('/api/app/dashboard', undefined, cookie.split(';')[0])).status).toBe(401)
    expect((await run('/api/app/dashboard', undefined, 'pencil_operator_session=old-credential')).status).toBe(401)
    expect((await run('/auth/operator/role', { operatorId: product!.id, role: 'admin' }, first)).status).toBe(404)
  } finally { fetcher.mockRestore() }
})
contract(['BASE-ACCESS-001','BASE-INPUT-001','BASE-ACCESS-004'], 'real missing and mismatched headers, duplicate credential sources and absent edge address fail closed without mail or provisioning', async () => {
  await bootstrap()
  const send = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('No provider should be called'))
  const before = await counts()
  const body = JSON.stringify({ email: 'first@example.test' })
  try {
    for (const headers of [
      { 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.61' },
      { 'Content-Type': 'application/json', Origin: 'https://evil.test', 'CF-Connecting-IP': '192.0.2.61' },
      { 'Content-Type': 'application/json', Origin: origin, Host: 'evil.test', 'CF-Connecting-IP': '192.0.2.61' },
      { 'Content-Type': 'application/json', Origin: origin, 'Sec-Fetch-Site': 'cross-site', 'CF-Connecting-IP': '192.0.2.61' },
    ]) expect((await raw(new Request(origin + '/auth/magic-link', { method: 'POST', headers, body }))).status).toBe(403)
    expect((await raw(new Request(origin + '/auth/magic-link', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body }))).status).toBe(503)
    for (const [path, malformed] of [
      ['/auth/magic-link', '{"email":"first@example.test","\\u0065mail":"unknown@example.test"}'],
      ['/auth/confirm?token=' + 'a'.repeat(43), JSON.stringify({ token: 'b'.repeat(43) })],
      ['/auth/signout', JSON.stringify({ ignored: 'private-secret' })],
    ]) {
      const response = await raw(new Request(origin + path, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.61' }, body: malformed }))
      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({ error: 'VALIDATION_ERROR', message: 'Invalid request body.' })
    }
    expect(send).not.toHaveBeenCalled()
    expect(await counts()).toEqual(before)
    expect(await env.DB.prepare('SELECT count(*) n FROM oa_operators').first()).toEqual({ n: 1 })
  } finally { send.mockRestore() }
})
contract(['DIST-007','OPER-003','BASE-ACCESS-001','BASE-SECRET-001'], 'an uncertain Base SendGrid send revokes its link, leaks no provider error and leaves existing sessions usable', async () => {
  const cookie = await bootstrap()
  const send = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('synthetic-private-provider-secret'))
  try {
    const response = await run('/auth/magic-link', { email: 'first@example.test' })
    // Public acceptance is address-independent; native delivery still fails and
    // revokes the link (asserted independently in base-auth-privacy.worker.test).
    expect(response.status).toBe(202)
    expect(await response.text()).not.toContain('synthetic-private-provider-secret')
    expect(send).toHaveBeenCalledTimes(1)
    expect(await env.DB.prepare('SELECT count(*) n FROM oa_tokens WHERE revoked_at IS NOT NULL').first()).toEqual({ n: 1 })
    expect((await run('/api/app/dashboard', undefined, cookie)).status).toBe(200)
    expect((await run('/health')).status).toBe(200)
    expect(await env.DB.prepare('SELECT count(*) n FROM local_dev_inbox').first()).toEqual({ n: 0 })
  } finally { send.mockRestore() }
})
