import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect, vi } from 'vitest'
import { ulid } from 'ulid'
import { contract } from '../../src/test/contract'
import worker from '../../src/core/app/worker'
import type { WorkerBindings } from '../../src/core/app/environment'
import { createPencilServices } from '../../src/core/app/services'
import { createPencilPlatform } from '../../src/core/platform/runtime'

declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(() => applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__))
const origin = 'https://pencil.example.test'
const bindings = () => ({ ...env, APP_ORIGIN: origin,
  SESSION_SECRET: 'synthetic-private-auth-secret-at-least-32-characters',
  SETUP_TOKEN: 'synthetic-private-auth-setup-at-least-32-characters', SEED_ADMIN_EMAIL: 'setup@example.test',
  MAIL_PROVIDER: 'sendgrid', MAIL_API_KEY: 'synthetic-mail-key', MAIL_FROM: 'no-reply@example.test',
  PENCIL_LOCAL_DEVELOPMENT: 'false', SEED_SAMPLE_DATA: 'false' }) as WorkerBindings

function request(path: string, cookie = '', method = 'GET') {
  return new Request(origin + path, { method, headers: { Host: 'pencil.example.test', Origin: origin,
    'CF-Connecting-IP': '192.0.2.91', Cookie: cookie } })
}

async function productOperator() {
  const id = ulid(), workspaceId = ulid(), now = new Date().toISOString()
  const email = `${id.toLowerCase()}@example.test`
  await env.DB.batch([
    env.DB.prepare('INSERT INTO workspaces(id,name,time_zone,created_at,updated_at) VALUES(?,?,?,?,?)')
      .bind(workspaceId, 'Original workspace', 'UTC', now, now),
    env.DB.prepare('INSERT INTO operators(id,workspace_id,email,display_name,is_setup_operator,created_at,updated_at) VALUES(?,?,?,?,0,?,?)')
      .bind(id, workspaceId, email, 'Original operator', now, now),
  ])
  return { id, workspaceId, email }
}

async function fixture() {
  const product = await productOperator()
  const auth = createPencilServices(createPencilPlatform(origin, bindings())).auth
  const send = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 202 }))
  let token: string
  try {
    await auth.native.requestMagicLink(request('/auth/magic-link', '', 'POST'), { email: product.email })
    const message = JSON.parse(String(send.mock.calls[0][1]!.body))
    const link = message.content.find((part: { type: string }) => part.type === 'text/plain').value.match(/https[^\s]+/)[0]
    token = new URL(link).searchParams.get('token')!
  } finally { send.mockRestore() }
  const completed = await auth.native.confirmLink(request('/auth/confirm', '', 'POST'), { token })
  const cookie = completed.cookie.split(';')[0]
  const read = (path = '/api/app/workspace') => worker.fetch(request(path, cookie), bindings(), {} as ExecutionContext)
  expect((await read()).status).toBe(200)
  const sessionRequest = request('/app', cookie)
  const expected = { id: completed.session.id, expiresAt: new Date(completed.session.expiresAt).toISOString(),
    operatorId: product.id, email: product.email, displayName: 'Original operator', workspaceId: product.workspaceId }
  expect(await auth.getSession(sessionRequest)).toEqual(expected)
  return { ...product, auth, cookie, read, sessionRequest, expected }
}

async function warmedPrivateRouteDeniesInvalidatedSession(invalidation: 'revocation' | 'expiry') {
  const f = await fixture()
  if (invalidation === 'revocation') await f.auth.native.signOut(request('/auth/signout', f.cookie, 'POST'))
  else await env.DB.prepare('UPDATE oa_sessions SET expires_at=? WHERE id=?').bind(Date.now() - 1, f.expected.id).run()
  expect(await f.auth.native.getSession(f.sessionRequest)).toBeNull()
  expect(await f.auth.getSession(f.sessionRequest)).toBeUndefined()
  expect((await f.read()).status).toBe(401)
}

contract(["BASE-ACCESS-001","SHELL-001"], 'a warmed private route denies revoked native sessions and missing durable product identity', async () => {
  for (const [name, run] of [
    ["a warmed private route denies native session revocation", () =>
  warmedPrivateRouteDeniesInvalidatedSession('revocation')],
    ["a valid native session without its durable product mapping or operator fails closed", async () => {
  const f = await fixture()
  await env.DB.prepare('DELETE FROM operator_auth_links WHERE auth_id=?').bind(f.id).run()
  expect(await f.auth.native.getSession(f.sessionRequest)).not.toBeNull()
  expect(await f.auth.getSession(f.sessionRequest)).toBeUndefined()
  expect((await f.read()).status).toBe(401)
  await env.DB.prepare('INSERT INTO operator_auth_links(operator_id,auth_id) VALUES(?,?)').bind(f.id, f.id).run()
  expect((await f.read()).status).toBe(200)
  await env.DB.prepare('DELETE FROM operators WHERE id=?').bind(f.id).run()
  expect(await f.auth.native.getSession(f.sessionRequest)).not.toBeNull()
  expect(await f.auth.getSession(f.sessionRequest)).toBeUndefined()
  expect((await f.read()).status).toBe(401)
}],
  ] as const) {
    try { await run() } catch (cause) { throw new Error(`Private authentication case "${name}" failed`, { cause }) }
  }
})
