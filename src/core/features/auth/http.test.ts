import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import type { WorkerEnvironment } from '../../app/environment'
import type { PencilServices } from '../../app/services'
import { requireSameOriginRequest } from './http'
// @ts-expect-error Maintained Base internal HTTP contract.
import { sessionCookie, readCookie } from '../../../base/operator-auth/http.mjs'
import { registerAuthRoutes } from './routes'
import { isLocalDevelopmentRequest } from '../../platform/config/runtime'

describe('operator session cookies', () => {
  it('uses an HttpOnly, same-site cookie and reads only its named value', () => {
    const cookie = sessionCookie('a'.repeat(43), { cookieName: '__Host-operator_session', secure: true, sessionSeconds: 60 })
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Lax')
    expect(cookie).toContain('Secure')
    expect(sessionCookie('', { cookieName: '__Host-operator_session', secure: true }, 0)).toContain('Max-Age=0')
    expect(readCookie(new Request('https://pencil.test', { headers: { cookie: `other=x; __Host-operator_session=${'a'.repeat(43)}` } }), { cookieName: '__Host-operator_session' })).toBe('a'.repeat(43))
  })

  it('rejects a cookie-bearing mutation from a different or absent origin', () => {
    expect(() => requireSameOriginRequest(new Request('https://pencil.test/auth/signout'))).toThrow(/configured Pencil origin/)
    expect(() => requireSameOriginRequest(new Request('https://pencil.test/auth/signout', { headers: { origin: 'https://attacker.test' } }))).toThrow(/configured Pencil origin/)
    expect(() => requireSameOriginRequest(new Request('https://pencil.test/auth/signout', { headers: { origin: 'https://pencil.test' } }))).not.toThrow()
  })
})

describe('local mail selection', () => {
  it('requires both explicit local settings and cannot become a production fallback', () => {
    expect(isLocalDevelopmentRequest('http://127.0.0.1:4173/auth/magic-links', { MAIL_PROVIDER: 'local', PENCIL_LOCAL_DEVELOPMENT: 'true' } as WorkerEnvironment['Bindings'])).toBe(true)
    expect(isLocalDevelopmentRequest('https://pencil.example/auth/magic-links', { MAIL_PROVIDER: 'local', PENCIL_LOCAL_DEVELOPMENT: 'true' } as WorkerEnvironment['Bindings'])).toBe(false)
    expect(isLocalDevelopmentRequest('http://localhost/auth/magic-links', { MAIL_PROVIDER: 'local', PENCIL_LOCAL_DEVELOPMENT: 'false' } as WorkerEnvironment['Bindings'])).toBe(false)
    expect(isLocalDevelopmentRequest('http://localhost/auth/magic-links', { MAIL_PROVIDER: 'resend', PENCIL_LOCAL_DEVELOPMENT: 'true' } as WorkerEnvironment['Bindings'])).toBe(false)
  })
})

describe('magic-link redemption', () => {
  it('returns a redirect with a mutable HttpOnly session header', async () => {
    const app = new Hono<WorkerEnvironment>()
    registerAuthRoutes(app, {
      auth: { native: { confirmLink: async () => ({ cookie: sessionCookie('a'.repeat(43), { cookieName: 'operator_session_local', secure: false, sessionSeconds: 60 }), returnTo: '/app' }) } },
    } as unknown as PencilServices, { sessionSecret: 'synthetic-unit-secret-at-least-32-characters', appOrigin: 'http://pencil.test', isLocalDevelopment: true, seedSampleData: false, mail: { kind: 'local-development' }, task: { kind: 'unavailable', message: 'External tasks are not set up.' } })

    const response = await app.request('http://pencil.test/auth/confirm', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: 'a'.repeat(43) }), redirect: 'manual' })
    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('/app')
    expect(response.headers.get('set-cookie')).toContain(`operator_session_local=${'a'.repeat(43)}`)
  })
})
