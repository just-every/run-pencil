import { developmentInbox } from '../helpers/development-outbox'
import { devKeyHeaders } from '../helpers/dev-key.mjs'
import { operatorEmail } from './auth-identity'
import AxeBuilder from '@axe-core/playwright'
import { mkdir } from 'node:fs/promises'
import type { APIRequestContext } from '@playwright/test'
import type { BuilderDraft, PublicFlow, WorkspaceSettings } from '../../src/core/app/api'
import { expect, test } from './fixtures'
import { contract } from './contract'

const origin = new URL(process.env.PENCIL_E2E_BASE_URL ?? 'http://127.0.0.1:4173').origin
const mutationHeaders = { Origin: origin, 'CF-Connecting-IP': '198.19.156.20' }

async function login(request: APIRequestContext) {
  expect((await request.post('/auth/magic-link', { headers: mutationHeaders, data: { email: operatorEmail() } })).status()).toBe(202)
  const inbox = await developmentInbox(path => request.get(path, { headers: devKeyHeaders }), operatorEmail())
  expect((await request.post('/auth/confirm', { headers: { Origin: new URL(process.env.PENCIL_E2E_BASE_URL!).origin }, data: { token: inbox.messages[0].magicLinkToken },  maxRedirects: 0 })).status()).toBe(303)
}

async function form(request: APIRequestContext, slug: string, target?: number, text?: Record<string, string>) {
  const title = `Synthetic closed review ${slug}`
  const create = await request.post('/api/app/flows', { headers: mutationHeaders, data: { title, slug } })
  expect(create.status()).toBe(201)
  const { id } = await create.json()
  const path = `/api/app/flows/${id}`
  const draft = async () => await (await request.get(`${path}/draft`)).json() as BuilderDraft
  for (const step of [{ kind: 'question', questionType: 'short_text', prompt: 'Your feedback', required: true }, { kind: 'completion', questionType: null, prompt: 'Feedback recorded.' }]) {
    expect((await request.post(`${path}/draft/steps`, { headers: mutationHeaders, data: { expectedVersion: (await draft()).flow.draftVersion, step } })).status()).toBe(201)
  }
  const current = await draft()
  expect((await request.put(`${path}/draft`, { headers: mutationHeaders, data: { stepId: current.steps[0].id, prompt: 'Your feedback', required: true, nextStepId: current.steps[1].id, expectedVersion: current.flow.draftVersion } })).status()).toBe(200)
  if (text) { const base = await draft(); expect((await request.put(`${path}/draft/settings`, { headers: mutationHeaders, data: { expectedVersion: base.flow.draftVersion, settings: { ...base.formSettings, text, marketing: { purpose: 'email_marketing', wording: 'By submitting you agree to receive our newsletter; unsubscribe any time.' } } } })).status()).toBe(200) }
  const unpublished = await request.get(`/f/${slug}`)
  expect(unpublished.status()).toBe(404)
  expect((await request.post(`${path}/publish`, { headers: mutationHeaders, data: { expectedVersion: (await draft()).flow.draftVersion, ...(target ? { targetCompletedResponses: target } : {}) } })).status()).toBe(201)
  const published = await (await request.get(`/api/public/flows/${slug}`)).json() as PublicFlow
  return { id, path, title, published }
}

contract('RESP-009', 'a respondent losing manual or final target admission sees a named closed page and saves no response', async ({ page }, info) => {
  test.setTimeout(90_000)
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  await login(page.request)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  for (const reason of ['manual', 'target'] as const) {
    const slug = `closed-${reason}-${info.project.name}-${Date.now()}`
    // LANG-002: this form's published Submit label and closed or response-limit message replace Pencil's wording.
    const label = `Send my ${reason} feedback`, message = reason === 'target' ? 'All places for this survey are taken.' : 'We have paused this survey.'
    const f = await form(page.request, slug, reason === 'target' ? 1 : undefined, { submitLabel: label, ...(reason === 'target' ? { limitMessage: message } : { closedMessage: message }) })
    if (reason === 'manual') {
      // LANG-002 and GOV-007: the builder's respondent text and marketing opt-in settings save to the draft; the live form keeps its published wording.
      await page.goto(`/app/flows/${f.id}/builder`)
      await expect(page.locator('.operator-shell[data-hydrated=true]')).toBeVisible()
      await page.locator('.step-button').last().click()
      await page.getByText('Respondent text', { exact: true }).click()
      await page.getByLabel('Start button label').fill('Go')
      await page.getByRole('button', { name: 'Save respondent text' }).click()
      await expect(page.getByText('Respondent text saved to the draft. Publish to apply it.')).toBeVisible()
      await page.getByText('Email marketing opt-in', { exact: true }).click()
      await page.getByLabel('This form is an email-marketing opt-in').check()
      await page.getByRole('button', { name: 'Save marketing opt-in' }).click()
      await expect(page.getByText('Marketing opt-in saved to the draft. Publish to apply it.')).toBeVisible()
      for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
        await page.setViewportSize(viewport)
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
        await expect(new AxeBuilder({ page }).analyze().then((result) => result.violations)).resolves.toEqual([])
        await page.screenshot({ path: info.outputPath(`respondent-settings-${viewport.width}.png`), fullPage: true })
      }
      await page.setViewportSize(info.project.name === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 900 })
    }
    const contender = reason === 'target' ? await (await page.request.post(`/api/public/flows/${slug}/sessions`, { headers: mutationHeaders, data: { deviceClass: 'desktop', source: 'direct' } })).json() : undefined
    await page.goto(`/f/${slug}`)
    await expect(page.locator('[data-hydrated=true]')).toBeVisible()
    const started = page.waitForResponse((response) => response.url().endsWith(`/flows/${slug}/sessions`) && response.request().method() === 'POST')
    await page.getByRole('textbox').fill('Unsaved synthetic answer')
    expect((await started).status()).toBe(201)
    // Both sessions genuinely exceed the minimum fill time; no D1 backdating.
    if (reason === 'target') {
      await page.waitForTimeout(3100)
      const winner = await page.request.post(`/api/public/flows/${slug}/responses`, { headers: mutationHeaders, data: { ...contender, idempotencyKey: `closed-winner-${slug}`, answers: [{ stepId: f.published.steps[0].id, value: 'Winner synthetic answer' }] } })
      expect(winner.status()).toBe(201)
      expect(await winner.json()).toMatchObject({ disposition: 'released' })
    } else expect((await page.request.post(`${f.path}/close`, { headers: mutationHeaders })).status()).toBe(204)
    const admission = page.waitForResponse((response) => response.url().endsWith(`/flows/${slug}/responses`))
    // GOV-007: the form's email-marketing opt-in wording sits directly above the submit button.
    const optIn = page.getByTestId('marketing-opt-in'), submit = page.getByRole('button', { name: label, exact: true })
    await expect(optIn).toHaveText('By submitting you agree to receive our newsletter; unsubscribe any time.')
    expect((await optIn.boundingBox())!.y).toBeLessThan((await submit.boundingBox())!.y)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await expect(page.getByRole('button', { name: 'Submit response' })).toHaveCount(0)
    await submit.click()
    expect((await admission).status()).toBe(409)
    await expect(page.locator('[data-state=closed]')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'This feedback flow is closed.' })).toBeVisible()
    await expect(page.getByText(f.title, { exact: true })).toBeVisible()
    await expect(page.getByText(message, { exact: true })).toBeVisible()
    const brand = await (await page.request.get('/api/app/brand')).json()
    await expect(page.getByText(brand.name, { exact: true }).first()).toBeVisible()
    await expect(page.getByRole('textbox')).toHaveCount(0)
    await expect(page.getByRole('button', { name: label })).toHaveCount(0)
    const ledger = await (await page.request.get(`${f.path}/ledger`)).json()
    expect(ledger.total).toBe(reason === 'target' ? 1 : 0)
    expect(JSON.stringify(ledger)).not.toContain('Unsaved synthetic answer')
    await expect(new AxeBuilder({ page }).analyze().then((result) => result.violations)).resolves.toEqual([])
    await page.reload()
    await expect(page.locator('[data-state=closed]')).toBeVisible()
    if (reason === 'manual') {
      expect((await page.request.post(`${f.path}/reopen`, { headers: mutationHeaders })).status()).toBe(204)
      expect((await (await page.request.get(`/api/public/flows/${slug}`)).json()).revision.id).toBe(f.published.revision.id)
    } else expect((await page.request.post(`${f.path}/reopen`, { headers: mutationHeaders })).status()).toBe(400)
    await mkdir('test-results/review-evidence', { recursive: true })
    await page.screenshot({ path: `test-results/review-evidence/${info.project.name}-closed-${reason}.png`, fullPage: true })
    if (reason === 'target') {
      await page.goto(`/app/flows/${f.id}/results`)
      await expect(page.locator('.operator-shell[data-hydrated=true]')).toBeVisible()
      await page.getByRole('button', { name: 'View answers', exact: true }).first().click()
      await expect(page.getByText('By submitting you agree to receive our newsletter; unsubscribe any time.', { exact: true })).toBeVisible()
      await page.screenshot({ path: info.outputPath(`consent-records-${info.project.name}.png`), fullPage: true })
    }
  }
  expect(errors).toEqual([])
})

test('closed documents render their business and flow without JavaScript, honor embed hosts, and archive to a genuine 404', async ({ page, browser }, info) => {
  test.setTimeout(90_000)
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  await login(page.request)
  const slug = `closed-document-${info.project.name}-${Date.now()}`
  const f = await form(page.request, slug)
  expect((await page.request.post(`${f.path}/close`, { headers: mutationHeaders })).status()).toBe(204)
  const workspace = await (await page.request.get('/api/app/workspace')).json() as WorkspaceSettings
  const settings = { timeZone: workspace.timeZone, sendingWindowStart: workspace.sendingWindowStart, sendingWindowEnd: workspace.sendingWindowEnd, embedAllowedOrigins: [origin] }
  const noScript = await browser.newContext({ javaScriptEnabled: false })
  try {
    const view = await noScript.newPage()
    expect((await view.goto(`${origin}/f/${slug}`))?.status()).toBe(200)
    await expect(view.getByRole('heading', { name: 'This feedback flow is closed.' })).toBeVisible()
    await expect(view.getByText(f.title, { exact: true })).toBeVisible()
    expect((await page.request.put('/api/app/workspace', { headers: mutationHeaders, data: settings })).status()).toBe(200)
    const allowed = await page.request.get(`/embed/${slug}`, { headers: { 'Sec-Fetch-Dest': 'iframe', Referer: `${origin}/closed-host` } })
    expect(allowed.status()).toBe(200)
    expect(await allowed.text()).toContain(f.title)
    expect(allowed.headers()['content-security-policy']).toBe(`frame-ancestors ${origin}; sandbox allow-scripts allow-forms allow-top-navigation-by-user-activation`)
    const blocked = await page.request.get(`/embed/${slug}`, { headers: { 'Sec-Fetch-Dest': 'iframe', Referer: 'https://unapproved.invalid/' } })
    expect(blocked.status()).toBe(403)
    expect(await blocked.text()).not.toContain(f.title)
    await page.route('**/closed-host', (route) => route.fulfill({ contentType: 'text/html', body: `<html lang="en"><title>Local embed review</title><iframe title="Closed form" src="/embed/${slug}" style="width:100%;height:800px;border:0"></iframe></html>` }))
    await page.goto('/closed-host')
    await expect(page.frameLocator('iframe').getByRole('heading', { name: 'This feedback flow is closed.' })).toBeVisible()
    await expect(page.frameLocator('iframe').getByText(f.title, { exact: true })).toBeVisible()
    expect((await page.request.post(`${f.path}/archive`, { headers: mutationHeaders })).status()).toBe(204)
    for (const path of [`/f/${slug}`, `/embed/${slug}`]) expect((await page.request.get(path)).status()).toBe(404)
    const dashboard = await (await page.request.get('/api/app/dashboard')).json()
    expect(dashboard.some((flow: { id: string }) => flow.id === f.id)).toBe(false)
  } finally {
    expect((await page.request.put('/api/app/workspace', { headers: mutationHeaders, data: { ...settings, embedAllowedOrigins: workspace.embedAllowedOrigins } })).status()).toBe(200)
    await noScript.close()
  }
})
