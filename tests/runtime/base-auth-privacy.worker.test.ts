import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect, vi } from 'vitest'
import { contract } from '../../src/test/contract'
import { authPrivacyFixture, origin, publicResponse } from './auth-privacy-fixture'

declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(() => applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__))

const senderScenarios = {
  accepted: { name: 'accepted', http: 202 },
  uncertain: { name: 'uncertain', code: 'transport_uncertain' },
  rejected: { name: 'rejected', http: 422, code: 'provider_rejected' },
  rate_limited: { name: 'rate_limited', http: 429, code: 'provider_rate_limited' },
  exception: { name: 'exception', code: 'provider_exception' },
} as const

async function assertMagicLinkPrivacy(scenario: typeof senderScenarios[keyof typeof senderScenarios]) {
  const failureLog = vi.spyOn(console, 'error').mockImplementation(() => {})
  const provider = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
    if (!('http' in scenario)) throw new Error('private-provider-transport-exception')
    return new Response(scenario.http === 202 ? null : 'private-provider-response-body', { status: scenario.http })
  })
  try {
    const f = await authPrivacyFixture(scenario.name === 'exception')
    const { known, unknown } = f
    const absent = await publicResponse(await f.app.request(f.request(unknown)))
    const admitted = await publicResponse(await f.app.request(f.request(known)))
    expect(admitted).toEqual(absent)
    expect(admitted.status).toBe(202)
    expect(JSON.parse(admitted.body)).toEqual({ status: 'accepted', delivery: 'email', inboxAvailable: false })
    expect(admitted.headers['cache-control']).toContain('no-store')
    expect(admitted.headers['set-cookie']).toBeUndefined()
    expect(f.send).toHaveBeenCalledTimes(1)
    const operatorCounts = await env.DB.batch(['oa_operators', 'operators'].map(table => env.DB.prepare(`SELECT count(*) n FROM ${table}`)))
    expect(operatorCounts.map(result => result.results)).toEqual(f.operatorCounts)
    const token = new URL(f.messages[0].text.match(/https[^\s]+/)![0]).searchParams.get('token')!
    const failed = scenario.name !== 'accepted'
    expect(await env.DB.prepare('SELECT count(*) n FROM oa_tokens WHERE operator_id=? AND revoked_at IS NOT NULL').bind(f.operatorId).first()).toEqual({ n: failed ? 1 : 0 })
    expect(await f.auth.previewLink(new Request(origin + '/auth/confirm'), token)).toEqual(failed ? null : { kind: 'magic', expiresInMinutes: 15 })
    if (failed) {
      // The product HTTP privacy boundary must not make native delivery succeed.
      await expect(f.auth.requestMagicLink(f.request(known), { email: known })).rejects.toMatchObject({ code: 'mail_unavailable', status: 503 })
      expect(await env.DB.prepare('SELECT count(*) n FROM oa_tokens WHERE operator_id=? AND revoked_at IS NULL').bind(f.operatorId).first()).toEqual({ n: 0 })
      await expect(f.auth.confirmLink(f.request(known), { token })).rejects.toMatchObject({ code: 'invalid_or_expired', status: 400 })
      const audits = await env.DB.prepare("SELECT details_json FROM audit_entries WHERE kind='auth.magic_link_failed' AND subject_id=?").bind(f.operatorId).all<{ details_json: string }>()
      expect(audits.results).toHaveLength(2)
      const details = { feature: 'operator-auth', adapter: 'mail.sender.v1', error: 'mail_unavailable', provider: 'sendgrid', outcome: scenario.name, code: scenario.code }
      for (const row of audits.results) expect(JSON.parse(row.details_json)).toEqual(details)
      expect(failureLog).toHaveBeenCalledTimes(2)
      expect(failureLog).toHaveBeenCalledWith('auth.magic_link_failed', details)
      const diagnostics = JSON.stringify([failureLog.mock.calls, audits.results, admitted])
      for (const privateValue of [known, unknown, token, f.messages[0].deliveryId, 'private-provider', 'synthetic-privacy-mail-key']) {
        expect(diagnostics).not.toContain(privateValue)
      }
    } else {
      expect(failureLog).not.toHaveBeenCalled()
      expect(await env.DB.prepare("SELECT count(*) n FROM audit_entries WHERE kind='auth.magic_link_sent' AND subject_id=?").bind(f.operatorId).first()).toEqual({ n: 1 })
    }
    expect((await f.app.request(origin + '/api/app/dashboard', { headers: { Cookie: f.cookie } })).status).toBe(200)
    expect((await f.app.request(origin + '/health')).status).toBe(200)
  } finally { provider.mockRestore(); failureLog.mockRestore() }
}

contract(['BASE-ACCESS-001', 'BASE-SECRET-001', 'DIST-007'], 'public magic-link responses conceal operator admission when the sender is accepted', () => assertMagicLinkPrivacy(senderScenarios.accepted))

contract(['BASE-ACCESS-001', 'BASE-SECRET-001', 'DIST-007'], 'public magic-link responses conceal operator admission when the sender is uncertain', () => assertMagicLinkPrivacy(senderScenarios.uncertain))

contract(['BASE-ACCESS-001', 'BASE-SECRET-001', 'DIST-007'], 'public magic-link responses conceal operator admission when the sender is rejected', () => assertMagicLinkPrivacy(senderScenarios.rejected))

contract(['BASE-ACCESS-001', 'BASE-SECRET-001', 'DIST-007'], 'public magic-link responses conceal operator admission when the sender is rate_limited', () => assertMagicLinkPrivacy(senderScenarios.rate_limited))

contract(['BASE-ACCESS-001', 'BASE-SECRET-001', 'DIST-007'], 'public magic-link responses conceal operator admission when the sender is exception', () => assertMagicLinkPrivacy(senderScenarios.exception))

contract(['BASE-ACCESS-001', 'BASE-ACCESS-003', 'BASE-INPUT-001'], 'privacy acceptance retains validation, origin, edge-IP and per-address admission controls', async () => {
  const f = await authPrivacyFixture()
  const { known, unknown } = f
  const failureLog = vi.spyOn(console, 'error').mockImplementation(() => {})
  const provider = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 422 }))
  try {
    for (const email of [known, unknown]) {
      expect((await f.app.request(f.request(email, { Origin: 'https://other.example.test' }))).status).toBe(403)
      const noEdge = f.request(email)
      noEdge.headers.delete('CF-Connecting-IP')
      expect(await publicResponse(await f.app.request(noEdge))).toMatchObject({ status: 503, body: JSON.stringify({ error: 'client_ip_unavailable' }) })
    }
    expect((await f.app.request(f.request('invalid-address'))).status).toBe(400)
    expect(f.send).not.toHaveBeenCalled()
    for (let attempt = 0; attempt < 5; attempt++) {
      const admitted = await publicResponse(await f.app.request(f.request(known)))
      expect(admitted).toEqual(await publicResponse(await f.app.request(f.request(unknown))))
      expect(admitted.status).toBe(202)
    }
    for (const email of [known, unknown]) {
      const limited = await f.app.request(f.request(email))
      expect(limited.status).toBe(429)
      expect(await limited.json()).toEqual({ error: 'rate_limited' })
    }
    expect(f.send).toHaveBeenCalledTimes(5)
    expect(await env.DB.prepare('SELECT count(*) n FROM oa_tokens WHERE operator_id=? AND revoked_at IS NULL').bind(f.operatorId).first()).toEqual({ n: 0 })
  } finally { provider.mockRestore(); failureLog.mockRestore() }
})
