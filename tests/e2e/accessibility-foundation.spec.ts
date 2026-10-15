import { operatorEmail } from './auth-identity'
import AxeBuilder from '@axe-core/playwright'
import { expect, test, openMailLink } from './fixtures'
import { contract } from './contract'
import { mkdir } from 'node:fs/promises'
// Isolate this new journey's API traffic; actual per-address rate limits stay enabled.
test.use({ extraHTTPHeaders: { 'CF-Connecting-IP': '198.18.240.10' } })

async function tabTo(page: import('@playwright/test').Page, locator: import('@playwright/test').Locator) {
  for (let i = 0; i < 100; i++) {
    await page.keyboard.press('Tab')
    if (await locator.evaluate(element => element === document.activeElement)) return
  }
  throw new Error('The target could not be reached through keyboard navigation.')
}

contract(['SHELL-001', 'BASE-PUBLIC-003', 'HOME-001'], 'keyboard and axe cover the landing, sign-in, operator navigation, builder and reports at declared viewports', async ({ page }, info) => {
  test.setTimeout(120_000)
  const output = process.env.PENCIL_CAPTURE_DIR ?? 'test-results/foundation-captures'
  await mkdir(output, { recursive: true })
  const check = async (name: string) => {
    // Keyboard activation can expose SSR content before the next document's CSS has loaded.
    await page.waitForLoadState('load')
    await expect.poll(() => page.evaluate(() => {
      const links = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel=stylesheet]'))
      return links.length > 0 && links.every(link => link.sheet !== null)
    })).toBe(true)
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `${output}/${info.project.name}-${name}.jpg`, fullPage: true, type: 'jpeg' })
  }
  await page.goto('/')
  await expect(page.locator('[data-hydrated=true]')).toBeVisible()
  await expect(page.getByText('Powered by', { exact: false })).toHaveCount(0)
  await check('landing')
  await tabTo(page, page.getByRole('button', { name: 'Begin', exact: true }))
  await page.keyboard.press('Enter')
  await expect(page.getByRole('radio', { name: '5 out of 5' })).toBeVisible()
  await check('question')
  await tabTo(page, page.getByRole('radio', { name: '1 out of 5' }))
  await page.keyboard.press('End')
  await page.keyboard.press('Space')
  await tabTo(page, page.getByRole('button', { name: 'Continue', exact: true }))
  await page.keyboard.press('Enter')
  await expect(page.getByRole('radio', { name: 'The coffee' })).toBeVisible()
  await tabTo(page, page.getByRole('radio', { name: 'The coffee' }))
  await page.keyboard.press('Space')
  await tabTo(page, page.getByRole('button', { name: 'Submit response', exact: true }))
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Thank you for your feedback.' })).toBeVisible()
  await check('completion')
  await page.goto('/signin')
  await check('signin')
  await tabTo(page, page.getByLabel('Operator email'))
  await page.keyboard.type(operatorEmail())
  await page.keyboard.press('Tab')
  await page.keyboard.press('Enter')
  await openMailLink(page, operatorEmail())
  await expect(page.getByRole('heading', { name: 'Confirm sign-in to Pencil', exact: true })).toBeVisible()
  await page.waitForLoadState('load')
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await tabTo(page, page.getByRole('button', { name: 'Confirm', exact: true }))
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Your flows' })).toBeVisible()
  await check('dashboard')
  await tabTo(page, page.getByRole('link', { name: 'Settings', exact: true }))
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Workspace settings', exact: true })).toBeVisible()
  await check('settings')
  for (const [name, path] of [['builder', '/app/flows/01J00000000000000000000003/builder'], ['results', '/app/flows/01J00000000000000000000003/results']]) {
    await page.goto(path)
    await expect(page.locator('.operator-shell[data-hydrated=true]')).toBeVisible()
    await check(name)
  }
})
