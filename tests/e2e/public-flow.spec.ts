import { appHeaders } from './api-headers'
import { developmentInbox } from '../helpers/development-outbox'
import { devKeyHeaders } from '../helpers/dev-key.mjs'
import { operatorEmail } from './auth-identity'
import AxeBuilder from '@axe-core/playwright'
import type { FrameLocator, Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { contract } from './contract'
import manifest from '../../seed.json' with { type: 'json' }

const slug = 'aurora-coffee-post-visit'
type FlowSurface = Page | FrameLocator

async function verifyHealth(page: Page) {
  const response = await page.request.get('/health')
  expect(response.status()).toBe(200)
  const health = await response.json() as { status: string; product: string; version: string; deployment: { sourceSha: string | null } }
  expect(health).toMatchObject({
    status: 'ok',
    product: 'pencil',
    version: manifest.version,
    // A local run has no deployment identity; rer deploy records the commit it shipped.
    deployment: { sourceSha: null },
  })
}

async function completeResponse(surface: FlowSurface) {
  await surface.getByRole('button', { name: 'Begin' }).click()
  await surface.getByRole('radio', { name: '5 out of 5' }).click()
  await surface.getByRole('button', { name: 'Continue' }).click()
  await surface.getByRole('radio', { name: 'The coffee' }).click()
  await new Promise((resolve) => setTimeout(resolve, 3_100))
  await surface.getByRole('button', { name: 'Submit response' }).click()
  await expect(surface.getByRole('heading', { name: 'Thank you for your feedback.' })).toBeVisible()
  await expect(surface.getByRole('button', { name: /Back|Continue|Submit response/ })).toHaveCount(0)
}

contract(["DIST-001","RESP-001","RESP-011","DIST-002","DIST-022"], "direct and embedded respondents complete the same accessible flow without an operator session", async ({ page, request }, info) => {
  await test.step("a sessionless direct flow presents one accessible screen at a time and reaches immutable completion", async () => {
    await verifyHealth(page)
    const requestedOrigins: string[] = []
    page.on('request', (request) => requestedOrigins.push(new URL(request.url()).origin))
    await page.goto(`/f/${slug}`)
    await test.step('DIST-001: the public link needs no operator session or third-party requests', async () => {
    await expect(page.getByRole('heading', { name: 'Thank you for visiting Aurora Coffee.' })).toBeVisible()
    await expect(page.getByRole('link', { name: /Operator sign in/i })).toHaveCount(0)
    expect([...new Set(requestedOrigins)]).toEqual([new URL(page.url()).origin])
    await expect(page.context().cookies()).resolves.toEqual([])
  })
    await test.step('RESP-001: the opening screen is singular and accessible', async () => {
    await expect(page.getByRole('heading')).toHaveCount(1)
    await expect(page.getByRole('button', { name: 'Begin' })).toBeVisible()
    await expect(page.getByRole('link', { name: /Operator sign in/i })).toHaveCount(0)
    const results = await new AxeBuilder({ page }).include('.respondent-shell').analyze()
    expect(results.violations).toEqual([])
  })
    await test.step('RESP-011: submission reaches an immutable completion screen', async () => {
    await completeResponse(page)
  })
  });
  await test.step("the accessible embedded route completes the same flow inside a real iframe", async () => {
    await page.context().clearCookies();
    await verifyHealth(page)
    await page.goto(`/f/${slug}`)
    const source = new URL(`/embed/${slug}`, page.url()).toString()
    await request.post('/auth/magic-link', { headers: appHeaders, data: { email: operatorEmail() } })
    const inbox = await developmentInbox(path => request.get(path, { headers: devKeyHeaders }), operatorEmail())
    await request.post('/auth/confirm', { headers: { Origin: new URL(process.env.PENCIL_E2E_BASE_URL!).origin }, data: { token: inbox.messages[0].magicLinkToken }, maxRedirects: 0 })
    const workspace = await request.get('/api/app/workspace').then((response) => response.json())
    const configured = await request.put('/api/app/workspace', { headers: { ...appHeaders, origin: new URL(page.url()).origin }, data: { timeZone: workspace.timeZone, sendingWindowStart: workspace.sendingWindowStart, sendingWindowEnd: workspace.sendingWindowEnd, embedAllowedOrigins: [new URL(page.url()).origin] } })
    expect(configured.status()).toBe(200)
    await page.goto(`/embed/${slug}`)
    await expect(page.getByRole('heading')).toBeVisible()
    const results = await new AxeBuilder({ page }).include('.respondent-shell').analyze()
    expect(results.violations).toEqual([])
    await page.route('**/pencil-embed-test-host', (route) => route.fulfill({ contentType: 'text/html', body: `<main><h1>Host page</h1><iframe title="Pencil feedback" src="${source}"></iframe></main>` }))
    await page.goto('/pencil-embed-test-host')
    const flow = page.frameLocator('iframe[title="Pencil feedback"]')
    await expect(flow.getByRole('heading', { name: 'Thank you for visiting Aurora Coffee.' })).toBeVisible()
    await completeResponse(flow)
  });
})
