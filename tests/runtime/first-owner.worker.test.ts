import { devKeyHeaders } from '../helpers/dev-key.mjs'
import { checkConfirmation, checkMail } from '../../src/base/operator-auth/conformance/presentation.mjs'
import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import worker from '../helpers/mail-worker'
import { createPencilPlatform } from '../../src/core/platform/runtime'
import { initializePencil } from '../../src/core/app/worker'
import { developmentInbox } from '../helpers/development-outbox'
import type { WorkerBindings } from '../../src/core/app/environment'
declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(() => applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__))
contract(['BASE-ACCESS-001', 'BASE-SECRET-001', 'DASH-001', 'OPER-002'], 'local first-owner setup preserves identity and requires email proof before inviting an equal operator', async () => {
  const origin = 'http://localhost'
  const bindings = { ...env, SEED_SAMPLE_DATA: 'false', SEED_ADMIN_EMAIL: 'configured-owner@example.test', SETUP_TOKEN: 'synthetic-local-setup-token-with-32-characters' } as WorkerBindings
  const services = await initializePencil(createPencilPlatform(origin, bindings))
  const request = (path: string, body?: unknown, cookie?: string) => worker.fetch(new Request(origin + path, { method: body ? 'POST' : 'GET', headers: { Host: 'localhost', Origin: origin, ...devKeyHeaders, 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }), bindings, {} as ExecutionContext)
  expect(await services.auth.needsBootstrap()).toBe(true)
  expect((await request('/auth/bootstrap', { token: 'incorrect', displayName: 'Owner' })).status).toBe(403)
  expect(await services.auth.needsBootstrap()).toBe(true)
  const result = await request('/auth/bootstrap', { token: bindings.SETUP_TOKEN, displayName: 'Owner' })
  expect(result.status).toBe(303)
  expect(await services.auth.needsBootstrap()).toBe(false)
  expect(await env.DB.prepare('SELECT email,is_setup_operator FROM operators').first()).toEqual({ email: bindings.SEED_ADMIN_EMAIL, is_setup_operator: 1 })
  expect(await env.DB.prepare('SELECT count(*) n FROM flows').first()).toEqual({ n: 0 })
  expect((await request('/auth/bootstrap', { token: bindings.SETUP_TOKEN, displayName: 'Replacement' })).status).toBe(409)
  const known = await request('/auth/magic-link', { email: bindings.SEED_ADMIN_EMAIL })
  const unknown = await request('/auth/magic-link', { email: 'unknown@example.test' })
  expect(await known.json()).toEqual(await unknown.json())
  const messages = (await developmentInbox(path => request(path), bindings.SEED_ADMIN_EMAIL!)).messages
  expect(messages).toHaveLength(1)
  expect((await request('/auth/local-inbox?email=configured-owner%40example.test')).status).toBe(404)
  expect(await env.DB.prepare('SELECT count(*) n FROM local_dev_inbox').first()).toEqual({ n: 0 })
  expect(await env.DB.prepare('SELECT count(*) n FROM local_mail_outbox').first()).toEqual({ n: 0 })
  const captured = await env.DB.prepare('SELECT message FROM rer_mail_development_outbox').first<{ message: string }>()
  const mail = JSON.parse(captured!.message)
  const token = messages[0].magicLinkToken
  checkMail(mail, { kind: 'magic', productName: 'Pencil', token })
  await checkConfirmation(await request('/auth/confirm?token=' + token), { kind: 'magic', productName: 'Pencil', token, theme: '/rer-theme.css' })
  await checkConfirmation(await request('/auth/confirm?token=expired'), { productName: 'Pencil', theme: '/rer-theme.css' })
  const bootstrapCookie = result.headers.get('set-cookie')!.split(';')[0]
  expect((await request('/setup', { name: 'Owner workspace', timeZone: 'Australia/Brisbane' }, bootstrapCookie)).status).toBe(303)
  const invitationInput = { email: 'invited-owner@example.test', displayName: 'Invited owner' }
  const invitationState = async () => (await env.DB.batch(['oa_operators', 'operators', 'oa_tokens', 'rer_mail_development_outbox'].map(table => env.DB.prepare(`SELECT * FROM ${table} ORDER BY id`)))).map(result => result.results)
  const beforeInvitation = await invitationState()
  const denied = await request('/api/app/operators', invitationInput, bootstrapCookie)
  expect(denied.status).toBe(403)
  expect(await denied.json()).toEqual({ error: 'step_up_required' })
  expect(await invitationState()).toEqual(beforeInvitation)
  // The same public email-link flow offered on /signin provides fresh proof.
  // Merely previewing the link above did not authorize the bootstrap session.
  const confirmed = await request('/auth/confirm', { token })
  expect(confirmed.status).toBe(303)
  const cookie = confirmed.headers.get('set-cookie')!.split(';')[0]
  expect((await request('/auth/confirm', { token })).status).toBe(400)
  expect((await request('/api/app/operators', invitationInput, bootstrapCookie)).status).toBe(403)
  const invitation = await request('/api/app/operators', { email: 'invited-owner@example.test', displayName: 'Invited owner' }, cookie)
  expect(invitation.status).toBe(201)
  const invite = (await developmentInbox(path => request(path), 'invited-owner@example.test')).messages[0]
  const invitedMail = JSON.parse((await env.DB.prepare('SELECT message FROM rer_mail_development_outbox WHERE id=?').bind(invite.id).first<{ message: string }>())!.message)
  checkMail(invitedMail, { kind: 'invite', productName: 'Pencil', token: invite.magicLinkToken })
  await checkConfirmation(await request('/auth/confirm?token=' + invite.magicLinkToken), { kind: 'invite', productName: 'Pencil', token: invite.magicLinkToken, theme: '/rer-theme.css' })
  const joined = await request('/auth/confirm', { token: invite.magicLinkToken })
  expect(joined.status).toBe(303)
  const joinedCookie = joined.headers.get('set-cookie')!.split(';')[0]
  const joinedSession = await request('/auth/session', undefined, joinedCookie)
  expect(joinedSession.status).toBe(200)
  expect(await joinedSession.json()).toMatchObject({ operator: { email: invitationInput.email, role: 'owner', status: 'active' } })
  const operators = await request('/api/app/operators', undefined, joinedCookie)
  expect(operators.status).toBe(200)
  expect(await operators.json()).toEqual(expect.arrayContaining([
    expect.objectContaining({ email: bindings.SEED_ADMIN_EMAIL, isSetupOperator: true }),
    expect.objectContaining({ email: invitationInput.email, isSetupOperator: false }),
  ]))
  expect((await request('/auth/confirm', { token: invite.magicLinkToken })).status).toBe(400)
})
