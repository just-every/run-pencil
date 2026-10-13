import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { createOperatorAuth, createAuthHandler, type MailMessage } from '../../src/base/operator-auth/index.mjs'
import { hashToken, opaqueToken } from '../../src/base/operator-auth/crypto.mjs'
import { createD1DevelopmentOutbox, createDevelopmentOutboxHandler } from '../../src/base/mail/src/development/index.mjs'
declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]

contract(['BASE-OPS-002', 'BASE-ACCESS-001', 'OPER-003'], 'additive cancellation and Base mail migrations retain prior operators, live credentials and product data', async () => {
  await applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__.slice(0, 12))
  const origin = 'http://localhost'
  const request = (path: string, body?: unknown) => new Request(origin + path, { method: body ? 'POST' : 'GET', headers: { Host: 'localhost', Origin: origin, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) })
  const messages: MailMessage[] = []
  const auth = createOperatorAuth({ db: env.DB, config: { origin, local: true, OWNER_EMAIL: 'upgrade@example.test',
    SESSION_SECRET: 'synthetic-upgrade-session-secret-long-enough', SETUP_TOKEN: 'synthetic-upgrade-setup-token-long-enough', MAIL_FROM: 'no-reply@example.test', branding: { productName: 'Pencil', accentColor: '#c89cf5', signInPath: '/signin' } },
    clientIp: () => 'loopback', mailSender: { async send(message) { messages.push(message); return { status: 'development', provider: 'development', providerMessageId: null } } } })
  // Model the predecessor's durable state, without asking today's auth service
  // to run against a database that has not received today's required migrations.
  const now = Date.now(), stamp = new Date(now).toISOString()
  const sessionToken = opaqueToken(), pendingToken = opaqueToken()
  const hash = (purpose: string, token: string) => hashToken('synthetic-upgrade-session-secret-long-enough', purpose, token)
  await env.DB.batch([
    env.DB.prepare("INSERT INTO workspaces(id,name,time_zone,created_at,updated_at) VALUES ('retained-workspace','Prior workspace','Australia/Brisbane',?,?)").bind(stamp,stamp),
    env.DB.prepare("INSERT INTO operators(id,workspace_id,email,display_name,is_setup_operator,created_at,updated_at) VALUES ('retained-operator','retained-workspace','upgrade@example.test','Prior operator',1,?,?)").bind(stamp,stamp),
    env.DB.prepare("INSERT INTO flows(id,workspace_id,slug,title,status,draft_version,last_activity_at,created_at,updated_at) VALUES ('retained-flow','retained-workspace','prior-flow','Prior flow','draft',7,?,?,?)").bind(stamp,stamp,stamp),
    env.DB.prepare("INSERT INTO oa_sessions(id,token_hash,operator_id,operator_version,kind,created_at,expires_at) VALUES ('retained-session',?,'retained-operator',1,'native',?,?)").bind(await hash('session', sessionToken), now, now + 86_400_000),
    env.DB.prepare("INSERT INTO oa_tokens(id,token_hash,kind,operator_id,operator_version,return_to,created_at,expires_at) VALUES ('retained-link',?,'magic','retained-operator',1,'/app',?,?)").bind(await hash('link', pendingToken), now, now + 900_000),
  ])
  const tables = ['oa_operators', 'oa_bootstrap', 'oa_sessions', 'oa_tokens', 'operators', 'workspaces', 'flows', 'operator_auth_links']
  const retainedQueries = await Promise.all(tables.map(async table => {
    const columns = await env.DB.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>()
    expect(columns.results.length).toBeGreaterThan(0)
    return `SELECT ${columns.results.map(column => `"${column.name.replaceAll('"', '""')}"`).join(', ')} FROM ${table}`
  }))
  const snapshot = async () => (await env.DB.batch(retainedQueries.map(query => env.DB.prepare(query)))).map(result => result.results)
  const before = await snapshot()
  await applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__.slice(0, 13))
  expect(await snapshot()).toEqual(before)
  await applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__)
  expect(await snapshot()).toEqual(before)
  expect(await env.DB.prepare('SELECT brand_configured, brand_supporting_line, brand_accent, brand_logo_base64, brand_logo_mime, brand_logo_version, public_flow_slug FROM workspaces WHERE id = ?').bind('retained-workspace').first()).toEqual({
    brand_configured: 0, brand_supporting_line: '', brand_accent: '#d4d4d4',
    brand_logo_base64: null, brand_logo_mime: null, brand_logo_version: null, public_flow_slug: null,
  })
  const handle = createAuthHandler(auth)
  const retainedSession = (await handle(new Request(origin + '/auth/session', { headers: { Host: 'localhost', Cookie: `operator_session_local=${sessionToken}` } })))!
  expect(retainedSession.status).toBe(200)
  expect(await retainedSession.json()).toMatchObject({ operatorId: 'retained-operator', operator: { email: 'upgrade@example.test' } })
  const confirmation = (await handle(request('/auth/confirm', { token: pendingToken })))!
  expect(confirmation.status).toBe(303)
  const renewedSession = (await handle(new Request(origin + '/auth/session', { headers: { Host: 'localhost', Cookie: confirmation.headers.get('set-cookie')!.split(';')[0] } })))!
  expect(await renewedSession.json()).toMatchObject({ operatorId: 'retained-operator' })
  expect((await handle(request('/auth/confirm', { token: pendingToken })))!.status).toBe(400)
  expect((await handle(request('/auth/magic-link', { email: 'upgrade@example.test' })))!.status).toBe(202)
  expect(messages).toHaveLength(1)
  const outbox = createD1DevelopmentOutbox({ db: env.DB })
  await outbox.put(messages[0])
  expect((await outbox.list())[0].message).toEqual(messages[0])
  expect(await env.DB.prepare('SELECT count(*) n FROM local_dev_inbox').first()).toEqual({ n: 0 })
  expect(await env.DB.prepare('SELECT count(*) n FROM local_mail_outbox').first()).toEqual({ n: 0 })
  const viewer = createDevelopmentOutboxHandler({ local: true, origin, outbox })
  expect((await viewer(request('/__dev/outbox')))?.status).toBe(200)
  expect(await createDevelopmentOutboxHandler({ local: false, origin, outbox })(request('/__dev/outbox'))).toBeNull()
  expect(await viewer(new Request(origin + '/__dev/outbox', { headers: { Host: 'evil.example' } }))).toBeNull()
  const message = messages[0]
  const link = message.text.match(/http[^\s]+/)![0]
  const beforePreview = await snapshot()
  for (const method of ['GET', 'HEAD']) {
    const response = (await handle(new Request(link, { method, headers: { Host: 'localhost' } })))!
    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie')).toBeNull()
    expect(response.headers.get('content-security-policy')).toContain("style-src 'sha256-")
    const body = await response.text()
    if (method === 'HEAD') expect(body).toBe('')
    else { expect(body).toContain('action="/auth/confirm"'); expect(body).not.toContain('<script') }
    expect(await snapshot()).toEqual(beforePreview)
  }
  const invalid = (await handle(request('/auth/confirm?token=expired')))!
  expect(invalid.status).toBe(400)
  expect(await invalid.text()).toContain('href="/signin"')
  expect(await snapshot()).toEqual(beforePreview)
})
