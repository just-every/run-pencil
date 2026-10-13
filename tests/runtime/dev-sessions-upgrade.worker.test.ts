import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { hashToken } from '../../src/base/operator-auth/crypto.mjs'
import { createPencilPlatform } from '../../src/core/platform/runtime'
import { createPencilServices } from '../../src/core/app/services'
declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]

// A store that already holds operators, sessions of every kind and credentials upgrades to the dev-sessions schema with
// every row identical and every session still deciding exactly as before.
contract(['BASE-ACCESS-001'], 'the dev-sessions migration keeps every existing operator, session and credential, and live sessions stay valid', async () => {
  const index = __PENCIL_CORE_MIGRATIONS__.findIndex(migration => migration.name === '0023_dev_sessions.sql')
  expect(index).toBeGreaterThan(0)
  await applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__.slice(0, index))
  const now = Date.now(), later = now + 86_400_000, stamp = new Date(now).toISOString()
  const live = 'liveliveliveliveliveliveliveliveliveliveliv', revoked = 'revokedrevokedrevokedrevokedrevokedrevok', expired = 'expiredexpiredexpiredexpiredexpiredexpire'
  const secret = (env as { SESSION_SECRET: string }).SESSION_SECRET
  const hash = (token: string) => hashToken(secret, 'session', token)
  const kinds = [['live', 'native', live, later, null], ['revoked', 'native', revoked, later, now], ['expired', 'oidc', expired, now - 1, null], ['review', 'review', 'review-token', later, null], ['password', 'password', 'password-token', later, null]] as const
  const sessions = await Promise.all(kinds.map(async ([id, kind, token, expiresAt, revokedAt]) => env.DB.prepare('INSERT INTO oa_sessions(id,token_hash,operator_id,operator_version,kind,source_token_id,created_at,expires_at,revoked_at) VALUES (?,?,?,1,?,NULL,1,?,?)')
    .bind(id, await hash(token), 'p', kind, expiresAt, revokedAt)))
  await env.DB.batch([
    env.DB.prepare("INSERT INTO workspaces(id,name,time_zone,created_at,updated_at,setup_operator_initialized_at) VALUES ('w','Prior workspace','UTC',?,?,?)").bind(stamp, stamp, stamp),
    env.DB.prepare("INSERT INTO operators(id,workspace_id,email,display_name,is_setup_operator,created_at,updated_at) VALUES ('p','w','owner@example.test','Owner',1,?,?)").bind(stamp, stamp),
    env.DB.prepare("INSERT INTO oa_tokens(id,token_hash,kind,operator_id,operator_version,return_to,created_at,expires_at) VALUES ('t','token-hash','magic','p',1,'/app',1,?)").bind(later),
    ...sessions,
  ])
  const rows = async () => ({
    sessions: (await env.DB.prepare('SELECT * FROM oa_sessions ORDER BY id').all()).results, tokens: (await env.DB.prepare('SELECT * FROM oa_tokens ORDER BY id').all()).results,
    operators: (await env.DB.prepare('SELECT * FROM oa_operators ORDER BY id').all()).results,
    index: await env.DB.prepare("SELECT sql FROM sqlite_schema WHERE type='index' AND name='oa_sessions_operator'").first(),
  })
  const before = await rows()
  const platform = () => createPencilPlatform('http://localhost', env)
  const session = (token: string) => createPencilServices(platform()).auth.getSession(new Request('http://localhost/app', { headers: { Host: 'localhost', Cookie: `operator_session_local_80=${token}` } }))
  await applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__)
  expect(await rows()).toEqual(before)
  expect(await session(live)).toMatchObject({ operatorId: 'p', email: 'owner@example.test' })
  expect(await session(revoked)).toBeUndefined()
  expect(await session(expired)).toBeUndefined()
  // The rebuilt table now admits the dev kind, and the credential record exists.
  await env.DB.prepare("INSERT INTO oa_sessions(id,token_hash,operator_id,operator_version,kind,created_at,expires_at) VALUES ('dev','dev-hash','p',1,'dev',1,?)").bind(later).run()
  expect(await env.DB.prepare('SELECT count(*) n FROM oa_dev_credentials').first()).toEqual({ n: 0 })
})
