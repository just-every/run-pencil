import { env } from 'cloudflare:test'
import { expect, vi } from 'vitest'
import { ulid } from 'ulid'
import type { MailMessage, MailSender } from '../../src/base/operator-auth/index.mjs'
import { createWorkerApp } from '../../src/core/app/worker'
import { createPencilServices } from '../../src/core/app/services'
import { AuthRepository } from '../../src/core/features/auth/repository'
import { AuthService } from '../../src/core/features/auth/service'
import { createPencilPlatform } from '../../src/core/platform/runtime'
import { baseMailSender } from '../../src/core/platform/mail/base.server'

export const origin = 'https://auth-privacy.example.test'
const setup = 'synthetic-privacy-setup-token-at-least-32-characters'
let bootstrapCookie: string | undefined

export async function authPrivacyFixture(exception = false) {
  const platform = createPencilPlatform(origin, { ...env, APP_ORIGIN: origin,
    SESSION_SECRET: 'synthetic-privacy-session-secret-at-least-32-characters', SETUP_TOKEN: setup,
    SEED_ADMIN_EMAIL: 'privacy-owner@example.test', MAIL_PROVIDER: 'sendgrid', MAIL_API_KEY: 'synthetic-privacy-mail-key',
    MAIL_FROM: 'no-reply@example.test', PENCIL_LOCAL_DEVELOPMENT: 'false', SEED_SAMPLE_DATA: 'false' })
  const services = createPencilServices(platform)
  const workspaceId = await services.workspace.ensurePrimaryWorkspace()
  const sender = baseMailSender(platform.configuration.mail, env.DB)
  const messages: MailMessage[] = []
  const send = vi.fn<MailSender['send']>(async message => {
    messages.push(message)
    if (exception) throw new Error(`Provider exception with private mail ${JSON.stringify(message)}`)
    return sender.send(message)
  })
  services.auth = new AuthService(new AuthRepository(platform.database, platform.databaseBatch), platform, services.audit, { send })
  const app = createWorkerApp(services, platform)
  const request = (email: string, overrides: Record<string, string> = {}) => new Request(origin + '/auth/magic-link', {
    method: 'POST', headers: { Host: new URL(origin).host, Origin: origin, 'CF-Connecting-IP': '192.0.2.71',
      'content-type': 'application/json', ...overrides }, body: JSON.stringify({ email }),
  })
  if (!bootstrapCookie) {
    const boot = await app.request(origin + '/auth/bootstrap', { method: 'POST',
      headers: request('privacy-owner@example.test').headers, body: JSON.stringify({ token: setup, displayName: 'Privacy owner' }) })
    expect(boot.status).toBe(303)
    bootstrapCookie = boot.headers.get('set-cookie')!.split(';')[0]
  }
  // Each case owns an additive synthetic operator; admission limits stay enabled
  // and the shared Worker database retains previous cases unchanged.
  const operatorId = ulid()
  const known = `admitted-${operatorId.toLowerCase()}@example.test`
  const unknown = `unlisted-${operatorId.toLowerCase()}@example.test`
  const now = new Date().toISOString()
  await env.DB.prepare('INSERT INTO operators(id,workspace_id,email,display_name,created_at,updated_at) VALUES (?,?,?,?,?,?)')
    .bind(operatorId, workspaceId, known, 'Privacy operator', now, now).run()
  const operatorCounts = await env.DB.batch(['oa_operators', 'operators'].map(table => env.DB.prepare(`SELECT count(*) n FROM ${table}`)))
  return { app, auth: services.auth.native, request, send, messages, cookie: bootstrapCookie, operatorId, known, unknown, operatorCounts: operatorCounts.map(result => result.results) }
}

export async function publicResponse(response: Response) {
  return { status: response.status, body: await response.text(), headers: Object.fromEntries(response.headers) }
}
