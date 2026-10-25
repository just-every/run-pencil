import AxeBuilder from '@axe-core/playwright'
import { expect, test } from './fixtures'
import { contract } from './contract'

// The product page is the run site's (run-pencil.com), built by rer build --site.
test.use({ baseURL: process.env.PENCIL_E2E_SITE_URL })

contract('SITE-001', 'the run site\'s product page tells its story in order, closes on Run Pencil and the docs, and stays cookieless, same-origin and accessible', async ({ page, context, baseURL }) => {
  const origin = new URL(baseURL!).origin
  const foreign: string[] = []
  const errors: string[] = []
  page.on('request', request => { if (!request.url().startsWith('data:') && new URL(request.url()).origin !== origin) foreign.push(request.url()) })
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('pageerror', error => errors.push(error.message))

  expect((await page.goto('/'))?.status()).toBe(200)
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/\S/)
  const sections = page.locator('main section:has(h2)')
  await expect(sections.first().getByRole('heading', { level: 2 })).toBeVisible()

  // Scroll the whole page so every lazy image loads and every plate reveals, then check it as a reader finishes it.
  const height = await page.evaluate(() => document.documentElement.scrollHeight)
  for (let y = 0; y <= height; y += 500) {
    await page.evaluate(top => new Promise<void>(done => {
      window.scrollTo(0, top)
      requestAnimationFrame(() => requestAnimationFrame(() => done()))
    }), y)
  }
  await page.waitForLoadState('networkidle')
  await expect(page.locator('[data-reveal="waiting"]')).toHaveCount(0)
  for (const section of await sections.all()) {
    const heading = section.getByRole('heading', { level: 2 })
    await expect(heading).toBeVisible()
    await expect(heading).toHaveText(/\S/)
  }

  const close = page.locator('main section').filter({ has: page.locator('a[href="/run"]') }).filter({ has: page.locator('a[href="/docs"]') }).last()
  await expect(close.locator('a[href="/run"]').first()).toBeVisible()
  await expect(close.locator('a[href="/docs"]').first()).toBeVisible()

  // Axe reads settled colours: wait for fonts and every finite reveal transition to end rather than for a fixed time.
  await page.evaluate(() => document.fonts.ready)
  await expect.poll(() => page.evaluate(() => document.getAnimations().filter(animation => animation.playState === 'running' && animation.effect?.getComputedTiming().iterations !== Infinity).length)).toBe(0)
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  expect(await context.cookies()).toEqual([])
  expect(foreign).toEqual([])
  expect(errors).toEqual([])
})
