import { expect, test } from './fixtures'
import { contract } from './contract'
import { nativeHost, signInBrand } from './brand-helpers'
import type { BrowserContext, Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

contract(['DIST-002', 'DIST-009', 'BASE-PUBLIC-001', 'BASE-PUBLIC-002'], 'copied async script mounts an opaque allowed-host iframe, resizes, emits only permitted events and rejects malicious messages', async ({ page, context, browser }, info) => {
  test.setTimeout(120_000)
  await page.setViewportSize(info.project.name === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 900 })
  await signInBrand(page)
  const origin = process.env.PENCIL_E2E_BASE_URL!
  const workspace = await page.request.get('/api/app/workspace').then(r => r.json())
  const headers = { Origin: origin }
  const flow = await page.request.post('/api/app/flows', { headers, data: { title: 'Embedded feedback', slug: `embed-${crypto.randomUUID().slice(0, 8)}`, template: 'feedback' } }).then(r => r.json())
  const draft = await page.request.get(`/api/app/flows/${flow.id}/draft`).then(r => r.json())
  expect((await page.request.post(`/api/app/flows/${flow.id}/publish`, { headers, data: { expectedVersion: draft.flow.draftVersion } })).status()).toBe(201)
  await page.goto(`/app/flows/${flow.id}/builder`)
  await page.getByRole('button', { name: 'Share', exact: true }).click()
  const snippet = await page.getByRole('textbox', { name: 'Script embed', exact: true }).inputValue()
  expect(snippet).toContain(`<script async src="${origin}/embed.js?flow=${flow.slug}"`)
  expect(snippet).not.toMatch(/token|response|answer|contact/i)
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.getByRole('button', { name: 'Copy script embed', exact: true }).click()
  await expect(page.getByText('Script embed copied.', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(snippet)
  const iframeAlternative = await page.getByRole('textbox', { name: 'Embed code', exact: true }).inputValue()
  expect(iframeAlternative).toContain('sandbox="allow-scripts allow-forms"')
  const host = await nativeHost(snippet)
  let visitor: Page | undefined
  let visitorContext: BrowserContext | undefined
  try {
    expect((await page.request.put('/api/app/workspace', { headers, data: { ...workspace, embedAllowedOrigins: [host.origin] } })).status()).toBe(200)
    // A real host browser has no operator test headers or cookies. In particular,
    // custom identity headers would trigger preflights in the opaque child.
    visitorContext = await browser.newContext({ extraHTTPHeaders: {} })
    visitor = await visitorContext.newPage()
    await visitor.setViewportSize(info.project.name === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 900 })
    // The browser supplies public API Origin=null from the opaque child.
    const errors: string[] = [], requested: string[] = []
    visitor.on('pageerror', error => errors.push(error.message))
    visitor.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
    visitor.on('request', request => requested.push(new URL(request.url()).origin))
    await visitor.goto(host.origin)
    const iframe = visitor.locator('iframe')
    await expect(iframe).toHaveAttribute('sandbox', 'allow-scripts allow-forms')
    const frame = visitor.frameLocator('iframe')
    await expect(frame.getByRole('radio', { name: 'Great', exact: true })).toBeVisible()
    await expect.poll(() => visitor!.evaluate(() => (window as unknown as { events: { type: string }[] }).events.some(e => e.type === 'pencil:loaded'))).toBe(true)
    expect(await visitor.evaluate(() => document.querySelector('iframe')!.contentDocument)).toBeNull()
    expect(await visitor.evaluate(() => { try { void document.querySelector('iframe')!.contentWindow!.document.body; return false } catch { return true } })).toBe(true)
    const child = visitor.frames().find(f => f.url().includes('/embed/'))!
    const assertHeight = async () => {
      const actual = await child.locator('main').evaluate(el => Math.ceil(el.getBoundingClientRect().height))
      await expect.poll(() => iframe.evaluate(el => parseInt((el as HTMLIFrameElement).style.height))).toBe(actual)
      expect(await child.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true)
      expect(await visitor!.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      expect((await new AxeBuilder({ page: visitor! }).analyze()).violations.filter(v => v.impact === 'serious' || v.impact === 'critical')).toEqual([])
      return actual
    }
    const firstHeight = await assertHeight()
    const before = await visitor.evaluate(() => JSON.stringify((window as unknown as { events: unknown[] }).events))
    await visitor.evaluate(() => {
      const frame = document.querySelector('iframe')!
      const challenge = new URLSearchParams(new URL(frame.src).hash.slice(1)).get('pencil-embed')!
      window.postMessage({ type: 'pencil:height', challenge, height: 1 }, '*')
      frame.contentWindow!.postMessage({ type: 'pencil:init', challenge, answers: 'must-be-refused' }, '*')
    })
    await child.evaluate(() => {
      const challenge = new URLSearchParams(location.hash.slice(1)).get('pencil-embed')!
      for (const data of [{ type: 'pencil:completed', challenge, responseId: 'must-be-refused' }, { type: 'pencil:height', challenge, height: 1, answers: [] }, { type: 'pencil:height', challenge: '00'.repeat(16), height: 1 }, { type: 'pencil:height', challenge, height: -1 }]) parent.postMessage(data, '*')
    })
    await visitor.waitForTimeout(100)
    expect(await visitor.evaluate(() => JSON.stringify((window as unknown as { events: unknown[] }).events))).toBe(before)
    await frame.getByRole('radio', { name: 'Great', exact: true }).click()
    await frame.getByRole('button', { name: 'Continue', exact: true }).click()
    await frame.getByRole('textbox', { name: 'What could we do better?' }).fill('Private answer never sent to the host.')
    await assertHeight()
    await visitor.waitForTimeout(3100)
    await frame.getByRole('button', { name: 'Submit response', exact: true }).click()
    await expect(frame.getByRole('heading', { name: 'Thank you. Your response has been received.' })).toBeVisible()
    const finalHeight = await assertHeight()
    expect(finalHeight).not.toBe(firstHeight)
    await expect.poll(() => visitor!.evaluate(() => (window as unknown as { events: { type: string }[] }).events.filter(e => e.type === 'pencil:completed').length)).toBe(1)
    const hostDom = await visitor.locator('body').innerText()
    expect(hostDom).not.toContain('Private answer')
    expect(visitor.url()).toBe(`${host.origin}/`)
    expect(await iframe.getAttribute('src')).toMatch(new RegExp(`/embed/${flow.slug}#pencil-embed=[a-f0-9]{32}$`))
    expect(await visitor.evaluate(() => (window as unknown as { events: unknown[] }).events)).not.toEqual([])
    const permitted = await visitor.evaluate(() => (window as unknown as { events: { type: string; detail: unknown }[] }).events)
    for (const event of permitted) {
      expect(['pencil:loaded', 'pencil:height', 'pencil:completed']).toContain(event.type)
      if (event.type === 'pencil:height') {
        expect(Object.keys(event.detail as object)).toEqual(['height'])
        expect(Number.isInteger((event.detail as { height: number }).height)).toBe(true)
      } else expect(event.detail).toBeNull()
    }
    const events = await visitor.evaluate(() => JSON.stringify((window as unknown as { events: unknown[] }).events))
    expect(events).not.toMatch(/answer|responseId|token|contact|Private/)
    expect([...new Set(requested)].sort()).toEqual([host.origin, origin].sort())
    expect(errors).toEqual([])
    for (const referer of ['https://hostile.invalid/page', `${host.origin}.hostile.invalid/page`, '']) {
      const refused = await page.request.get(`/embed.js?flow=${flow.slug}`, { headers: { Referer: referer } })
      expect(refused.status()).toBe(403)
      expect(await refused.text()).not.toContain('createElement')
      expect((await page.request.get(`/embed/${flow.slug}`, { headers: { Referer: referer, 'Sec-Fetch-Dest': 'iframe' } })).status()).toBe(403)
    }
  } finally {
    await visitor?.close(); await visitorContext?.close(); await host.close()
    await page.request.put('/api/app/workspace', { headers, data: workspace })
  }
})
