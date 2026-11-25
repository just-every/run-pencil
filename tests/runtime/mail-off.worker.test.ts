import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect, vi } from 'vitest'
import { contract } from '../../src/test/contract'
import worker from '../../src/core/app/worker'
import type { WorkerBindings } from '../../src/core/app/environment'
import { ownerSigninDigest, OWNER_SIGNIN_SECONDS } from '../../src/base/operator-auth/owner-signin-grant.mjs'
declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(() => applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__))
const origin = 'https://pencil.example.test'
const setup = 'synthetic-mail-off-setup-token-at-least-32-characters'
// A Business has no mail provider: MAIL_PROVIDER=none, and no sender or key is bound.
const bindings = { ...env, APP_ORIGIN: origin, SESSION_SECRET: 'synthetic-mail-off-session-secret-at-least-32-characters',
  SETUP_TOKEN: setup, SEED_ADMIN_EMAIL: 'owner@example.test', MAIL_PROVIDER: 'none', MAIL_API_KEY: undefined, MAIL_FROM: undefined,
  PENCIL_LOCAL_DEVELOPMENT: 'false', SEED_SAMPLE_DATA: 'false' } as unknown as WorkerBindings
const call = (path: string, body?: unknown) => worker.fetch(new Request(origin + path, { method: body === undefined ? 'GET' : 'POST',
  headers: { Host: 'pencil.example.test', Origin: origin, 'CF-Connecting-IP': '192.0.2.77', 'Content-Type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }) }), bindings, {} as ExecutionContext)

contract(['WS-003', 'OPER-003'], 'with mail off a Pencil deployment is ready without a sender, sends nothing, and its owner signs in with the link rer signin mints', async () => {
  const fetcher = vi.spyOn(globalThis, 'fetch')
  try {
    expect((await call('/health')).status).toBe(200)
    expect((await call('/auth/bootstrap', { token: setup, displayName: 'Owner' })).status).toBe(303)
    expect((await call('/auth/magic-link', { email: 'owner@example.test' })).status).toBe(202)
    expect(fetcher).not.toHaveBeenCalled()
    // What `rer signin` writes into the deployment's own D1: only the token's digest, for the active owner.
    const token = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
    const owner = await env.DB.prepare("SELECT id, version FROM oa_operators WHERE role='owner'").first<{ id: string; version: number }>()
    const now = Date.now()
    await env.DB.prepare('INSERT INTO oa_owner_signins(id,token_hash,operator_id,operator_version,created_at,expires_at) VALUES (?,?,?,?,?,?)')
      .bind(crypto.randomUUID(), await ownerSigninDigest(token), owner!.id, owner!.version, now, now + OWNER_SIGNIN_SECONDS * 1000).run()
    const used = await call('/auth/owner-signin', { token })
    expect(used.status).toBe(303)
    expect(used.headers.get('set-cookie')).toContain('__Host-operator_session=')
    expect((await call('/auth/owner-signin', { token })).status).toBe(400)
  } finally { fetcher.mockRestore() }
})
