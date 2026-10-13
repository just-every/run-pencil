import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import worker from '../../src/core/app/worker'
import { createPencilPlatform } from '../../src/core/platform/runtime'
import { initializePencil } from '../../src/core/app/worker'
import { publicBrandConfig } from '../../src/core/features/brand/brand'
import { publicSeedConfig } from '../../src/ext/config'
import { decodeLogo, logoByteLimit } from '../../src/core/features/brand/logo'
declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(() => applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__))
const origin = 'https://forms.example.test'
const bindings = { ...env, APP_ORIGIN: origin, PENCIL_BUILD_ID: 'brand-proof', SESSION_SECRET: 'synthetic-brand-session-secret-at-least-32-characters', SETUP_TOKEN: 'synthetic-brand-setup-secret-at-least-32-characters', SEED_ADMIN_EMAIL: 'brand-owner@example.test', MAIL_PROVIDER: 'sendgrid', MAIL_FROM: 'forms@example.test', MAIL_API_KEY: 'synthetic-unused-key', PENCIL_LOCAL_DEVELOPMENT: 'false', SEED_SAMPLE_DATA: 'false' }
const png = decodeLogo('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jU1sAAAAASUVORK5CYII=')
const raw = (path: string, init: RequestInit = {}) => worker.fetch(new Request(origin + path, init), bindings, {} as ExecutionContext)
contract(['BRAND-001', 'HOME-001', 'BASE-ACCESS-004', 'BASE-INPUT-001'], 'production D1 branding persists, refuses unauthorized and invalid writes, and selects only a published owned flow', async () => {
  const services = await initializePencil(createPencilPlatform(origin, bindings))
  expect(publicBrandConfig(await services.brand.get(), publicSeedConfig)).toMatchObject({ publicFlowBusinessName: 'Your business', publicFlowSlug: '', publicFlowPurpose: '' })
  const bootstrap = await raw('/auth/bootstrap', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'CF-Connecting-IP': '198.18.241.1' }, body: JSON.stringify({ token: bindings.SETUP_TOKEN, displayName: 'Business owner' }) })
  expect(bootstrap.status).toBe(303)
  const cookie = bootstrap.headers.get('set-cookie')!.split(';')[0]
  const headers = { Origin: origin, Cookie: cookie, 'Content-Type': 'application/json', 'CF-Connecting-IP': '198.18.241.1' }
  const save = (body: unknown) => raw('/api/app/brand', { method: 'PUT', headers, body: JSON.stringify(body) })
  const brand = { name: 'North Studio', supportingLine: 'Tell us what would help.', accent: '#757575', publicFlowSlug: null as string | null }
  expect((await raw('/api/app/brand', { method: 'PUT', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(brand) })).status).toBe(401)
  expect((await raw('/api/app/brand', { method: 'PUT', headers: { ...headers, Origin: 'https://hostile.test' }, body: JSON.stringify(brand) })).status).toBe(403)
  expect((await save(brand)).status).toBe(200)
  for (const patch of [{ name: '' }, { accent: '#fff' }, { accent: 'url(x)' }, { supportingLine: 'x'.repeat(241) }, { publicFlowSlug: 'missing' }]) expect((await save({ ...brand, ...patch })).status).toBe(400)
  const created = await raw('/api/app/flows', { method: 'POST', headers, body: JSON.stringify({ title: 'Customer feedback', slug: 'business-feedback', template: 'feedback' }) }).then(r => r.json()) as { id: string }
  expect((await save({ ...brand, publicFlowSlug: 'business-feedback' })).status).toBe(400)
  const draft = await raw(`/api/app/flows/${created.id}/draft`, { headers }).then(r => r.json()) as { flow: { draftVersion: number } }
  expect((await raw(`/api/app/flows/${created.id}/publish`, { method: 'POST', headers, body: JSON.stringify({ expectedVersion: draft.flow.draftVersion }) })).status).toBe(201)
  brand.publicFlowSlug = 'business-feedback'
  expect((await save(brand)).status).toBe(200)
  const restored = await initializePencil(createPencilPlatform(origin, bindings))
  expect(await restored.brand.get()).toMatchObject({ ...brand, configured: true })
  expect(JSON.stringify(publicBrandConfig(await restored.brand.get(), publicSeedConfig))).not.toMatch(/aurora|cafe/i)
  const upload = (body: Uint8Array, mime: string, authenticated = true) => raw('/api/app/brand/logo', { method: 'PUT', headers: { ...(authenticated ? headers : { Origin: origin }), 'Content-Type': mime }, body })
  expect((await upload(png, 'image/png', false)).status).toBe(401)
  for (const [bytes, mime] of [[png, 'image/jpeg'], [new TextEncoder().encode('<svg/>'), 'image/svg+xml'], [new Uint8Array(logoByteLimit + 1), 'image/png']] as const) expect((await upload(bytes, mime)).status).toBe(400)
  expect((await upload(png, 'image/png')).status).toBe(200)
  const config = publicBrandConfig(await restored.brand.get(), publicSeedConfig)
  const logo = await raw(config.publicFlowLogoUrl!)
  expect(logo.status).toBe(200); expect(logo.headers.get('Content-Type')).toBe('image/png'); expect(logo.headers.get('X-Content-Type-Options')).toBe('nosniff')
  expect(new Uint8Array(await logo.arrayBuffer())).toEqual(png)
  expect((await raw('/api/app/brand/logo', { method: 'DELETE', headers })).status).toBe(200)
  expect((await raw(config.publicFlowLogoUrl!)).status).toBe(404)
  expect((await restored.brand.get()).logoVersion).toBeNull()
  const workspace = await raw('/api/app/workspace', { headers }).then(r => r.json()) as { timeZone: string; sendingWindowStart: string; sendingWindowEnd: string }
  expect(workspace).toMatchObject({ name: brand.name, timeZone: 'UTC', sendingWindowStart: '09:00', sendingWindowEnd: '17:00' })
})
