import { appHeaders } from './api-headers'
import { developmentInbox } from '../helpers/development-outbox'
import { devKeyHeaders } from '../helpers/dev-key.mjs'
import { operatorEmail } from './auth-identity'
import type { APIRequestContext } from '@playwright/test'
import { expect, test } from './fixtures'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { openStateDatabase } from './state-database'
import { createHmac } from 'node:crypto'
import { createRequire } from 'node:module'
import { contract } from './contract'

const origin = process.env.PENCIL_E2E_BASE_URL ?? `http://127.0.0.1:${process.env.PENCIL_E2E_PORT ?? '15621'}`
const emitted = !process.env.PENCIL_MIGRATION_DEV
const assets = 'dist/server/assets'
const manifest = emitted ? readFileSync(join(assets, readdirSync(assets).find((name) => name.includes('server-fn-resolver'))!), 'utf8') : ''
const ids = [...manifest.matchAll(/"([a-f0-9]{64})": \{\s*functionName: "(\w+)_createServerFn_handler"/g)].filter((match) => ['requireOperator', 'loadPrivateDashboard'].includes(match[2])).map((match) => match[1])
const require = createRequire(import.meta.url)
const serverDependencies = join(process.cwd(), 'node_modules/.pnpm', readdirSync('node_modules/.pnpm').find((name) => name.startsWith('@tanstack+start-server-core@'))!, 'node_modules')
const seroval = require(require.resolve('seroval', { paths: [serverDependencies] }))
const { defaultSerovalPlugins } = require(require.resolve('@tanstack/router-core', { paths: [serverDependencies] }))
const rpcHeaders = { Origin: origin, 'Sec-Fetch-Site': 'same-origin', 'x-tsr-serverFn': 'true', Accept: 'application/json' }

async function login(request: APIRequestContext) {
  const email = operatorEmail()
  expect((await request.post('/auth/magic-link', { headers: appHeaders, data: { email } })).status()).toBe(202)
  const inbox = await developmentInbox(path => request.get(path, { headers: devKeyHeaders }), email)
  const response = await request.post('/auth/confirm', { headers: { Origin: new URL(process.env.PENCIL_E2E_BASE_URL!).origin }, data: { token: inbox.messages[0].magicLinkToken },  maxRedirects: 0 })
  expect(response.status()).toBe(303)
  return response.headers()['set-cookie'].split(';')[0]
}

function expireCookie(cookie: string) {
  // The browser server keeps its session secret in its own private variables file, never in generated configuration.
  const secret = readFileSync(join('.pencil-e2e-state', '.dev.vars'), 'utf8').match(/^SESSION_SECRET=(.+)$/m)![1]
  const hash = createHmac('sha256',secret).update(`session\0${cookie.split('=')[1]}`).digest('hex')
  const directory = process.env.PENCIL_MIGRATION_STATE ?? '.wrangler/state/v3/d1/miniflare-D1DatabaseObject'
  const file = readdirSync(directory).find((name) => name.endsWith('.sqlite'))!
  const db = openStateDatabase(join(directory, file))
  try {
    db.prepare('UPDATE oa_sessions SET expires_at = ? WHERE token_hash = ?').run(946684800000, hash)
  } finally { db.close() }
}

contract('BASE-ACCESS-002', 'native document/API/generated transport session matrix preserves private data boundaries', async ({ request }) => {
  test.skip(!emitted, 'The generated IDs are derived from emitted code; dev hydration has its own probe.')
  expect(ids).toHaveLength(2)
  const valid = await login(request)
  for (const path of ['/app', '/app/settings', '/app/flows/01J00000000000000000000003/builder', '/app/flows/01J00000000000000000000003/results']) {
    const response = await request.get(path, { headers: { Cookie: valid }, maxRedirects: 0 })
    expect(response.status()).toBe(200)
  }
  for (const id of ids) {
    const response = await request.get(`/_serverFn/${id}`, { headers: { ...rpcHeaders, Cookie: valid } })
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('application/json')
    expect(response.headers()['x-tss-serialized']).toBe('true')
    const decoded = seroval.fromCrossJSON(await response.json(), { plugins: defaultSerovalPlugins })
    expect(JSON.stringify(decoded)).toContain('Aurora')
    expect(decoded).toHaveProperty('result')
  }
  const expired = await login(request)
  expireCookie(expired)
  const revoked = await login(request)
  expect((await request.post('/auth/signout', { data: {}, headers: { Origin: origin, Cookie: revoked } })).status()).toBe(204)
  for (const cookie of ['', expired, revoked]) {
    for (const path of ['/app', '/app/settings', '/app/flows/01J00000000000000000000003/builder', '/app/flows/01J00000000000000000000003/results']) {
      const response = await request.get(path, { headers: { Cookie: cookie, 'Sec-Fetch-Mode': 'navigate' }, maxRedirects: 0 })
      expect(response.status()).toBe(302)
      expect(response.headers().location).toBe(`${origin}/signin?returnTo=${encodeURIComponent(path)}`)
      expect(await response.text()).not.toContain('Aurora')
    }
    for (const path of ['/api/app/dashboard', '/api/app/no-such-route']) {
      const response = await request.get(path, { headers: { Cookie: cookie } })
      expect(response.status()).toBe(401)
      expect(await response.json()).toMatchObject({ error: 'AUTHENTICATION_REQUIRED' })
    }
    for (const id of ids) {
      const response = await request.get(`/_serverFn/${id}`, { headers: { ...rpcHeaders, Cookie: cookie } })
      expect(response.status()).toBe(200)
      const body = await response.text()
      expect(body).toContain('/signin')
      expect(body).not.toContain('Aurora')
      expect(body).not.toContain('workspaceId')
    }
  }
  expect((await request.get('/api/app/no-such-route', { headers: { Cookie: valid } })).status()).toBe(404)
  expect((await request.get('/app/no-such-route', { headers: { Cookie: valid } })).status()).toBe(404)
  const before = await (await request.get('/api/app/dashboard', { headers: { Cookie: valid } })).json()
  expect((await request.post('/api/app/flows', { headers: { Cookie: valid, Origin: 'https://untrusted.invalid' }, data: { title: 'Must not exist', slug: 'must-not-exist' } })).status()).toBe(403)
  expect(await (await request.get('/api/app/dashboard', { headers: { Cookie: valid } })).json()).toEqual(before)
})

contract(['SHELL-001','HOME-001','DIST-009','BASE-PUBLIC-002'], 'fresh public SSR, genuine 404s, declared assets, hydration and private client navigation', async ({ page, request }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('requestfailed', (request) => errors.push(`${request.url()}: ${request.failure()?.errorText}`))
  const document = await request.get('/f/aurora-coffee-post-visit')
  expect(document.status()).toBe(200)
  const html = await document.text()
  expect(html).toContain('Thank you for visiting Aurora Coffee.')
  expect(html).not.toContain('Loading this feedback flow')
  expect(html).toContain('<script')
  const assetPath = html.match(/(?:src|href)="([^"]*\/assets\/[^" ]+\.js)"/)?.[1]
  expect(assetPath).toBeTruthy()
  const asset = await request.get(assetPath!)
  expect(asset.status()).toBe(200)
  expect(asset.headers()['content-type']).toMatch(/javascript/)
  expect(asset.headers()['x-content-type-options']).toBe('nosniff')
  expect((await request.post(assetPath!, { headers: appHeaders })).status()).toBe(404)
  // Explicit loopback names are supported locally; an unrelated host is not.
  expect((await request.get('/f/aurora-coffee-post-visit', { headers: { Host: 'unapproved.invalid' } })).status()).toBe(404)
  for (const referrer of ['', 'https://unapproved.invalid/host']) {
    const blocked = await request.get('/embed/aurora-coffee-post-visit', { headers: { 'Sec-Fetch-Dest': 'iframe', Referer: referrer } })
    expect(blocked.status()).toBe(403)
    expect(blocked.headers()['content-security-policy']).toBe("frame-ancestors 'none'")
    expect(await blocked.text()).not.toContain('Aurora')
  }
  for (const path of ['/no-such-document', '/f/no-such-form', '/assets/missing.js', '/@vite/client']) {
    if (!emitted && path === '/@vite/client') continue
    const response = await request.get(path, { headers: { 'Sec-Fetch-Mode': 'navigate' } })
    expect(response.status(), path).toBe(404)
  }
  await page.goto('/f/aurora-coffee-post-visit')
  await expect(page.locator('[data-hydrated=true]')).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Begin' }).click()
  await expect(page.getByRole('radio', { name: '5 out of 5' })).toBeVisible()
  const cookie = await login(request)
  const [name, value] = cookie.split('=')
  await page.context().addCookies([{ name, value, url: origin }])
  await page.goto('/app')
  await expect(page.getByRole('heading', { name: 'Aurora Coffee post-visit feedback' })).toBeVisible()
  await expect(page.locator('.operator-shell[data-hydrated=true]')).toBeVisible()
  const timeOrigin = await page.evaluate(() => performance.timeOrigin)
  await page.getByRole('link', { name: 'Settings', exact: true }).click()
  await expect(page.getByRole('heading', { name: /Settings|Workspace/i })).toBeVisible()
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(timeOrigin)
  await page.getByRole('link', { name: 'Flows', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Aurora Coffee post-visit feedback' })).toBeVisible()
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(timeOrigin)
  expect(errors).toEqual([])
})


contract(['HOME-001'], 'public HTML follows changed D1 rather than build-time or cached state', async ({ request }) => {
  test.skip(!emitted, 'This test changes only the emitted runtime synthetic state.')
  const directory = process.env.PENCIL_MIGRATION_STATE ?? '.wrangler/state/v3/d1/miniflare-D1DatabaseObject'
  const db = openStateDatabase(join(directory, readdirSync(directory).find((name) => name.endsWith('.sqlite'))!))
  try {
    const step = db.prepare("SELECT id, prompt FROM flow_steps WHERE revision_id = '01J00000000000000000000004' AND kind = 'welcome'").get() as { id: string; prompt: string }
    let failed = false
    let failure: unknown
    try {
      db.prepare('UPDATE flow_steps SET prompt = ? WHERE id = ?').run('Synthetic SSR freshness proof', step.id)
      for (const path of ['/', '/f/aurora-coffee-post-visit', '/embed/aurora-coffee-post-visit']) {
        expect(await (await request.get(path)).text()).toContain('Synthetic SSR freshness proof')
      }
    } catch (error) {
      failed = true
      failure = error
      throw error
    } finally {
      try {
        db.prepare('UPDATE flow_steps SET prompt = ? WHERE id = ?').run(step.prompt, step.id)
      } catch (error) {
        if (failed) throw new AggregateError([failure, error], 'SSR freshness check and fixture restoration failed')
        throw error
      }
    }
  } finally { db.close() }
})

contract(["DIST-020","BASE-DATA-001"], "published revision previews preserve admission and restore their exact preview image bytes", async ({ page, request }, info) => {
  await test.step("emitted Worker serves revision previews and canonical-only indexing without weakening respondent admission", async () => {
    test.setTimeout(120_000)
    const {publishedPreviewJourney}=await import('./link-preview-http')
    await publishedPreviewJourney(page,request,await login(request),info.project.name)
  });
  await test.step("owner browser backup restores preview image bytes with the same archive checksum", async () => {
    await page.context().clearCookies();
    test.setTimeout(120_000)
    const {previewBackupJourney}=await import('./preview-backup-journey')
    await previewBackupJourney(page,request,await login(request),info.project.name)
  });
})
