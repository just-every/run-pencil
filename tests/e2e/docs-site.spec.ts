import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { expect } from './fixtures'
import { contract } from './contract'

contract('DOCS-001', 'the documentation renders with navigation and contents, answers an unknown page with 404, and sets no cookies or third-party requests', async ({ page, context, baseURL }, info) => {
  const cdp=await page.context().newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:4})
  const origin = new URL(baseURL!).origin
  const foreign: string[] = []
  page.on('request', request => { if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== origin) foreign.push(request.url()) })
  const wide = (page.viewportSize()?.width ?? 0) >= 1200
  const navigation = page.getByRole('navigation', { name: 'Documentation' })

  const home = await page.goto('/docs')
  expect(home?.status()).toBe(200)
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
  await expect(page).toHaveTitle(/Pencil docs/)
  await expect(page.locator('meta[name=description]')).toHaveAttribute('content', /.{20}/)
  const overview = info.outputPath(`overview-${info.project.name}.png`)
  await page.screenshot({ path: overview, fullPage: true })
  await info.attach('Overview payment boundaries', { path: overview, contentType: 'image/png' })

  const guide = await page.goto('/docs/build-a-form')
  expect(guide?.status()).toBe(200)
  await expect(page.getByRole('heading', { level: 1, name: 'Build a form' })).toBeVisible()
  await expect(page).toHaveTitle('Build a form · Pencil docs')
  // The sidebar is the navigation from 861px and the menu above the page below it; the current page is marked either way.
  const menu = page.locator('details', { hasText: 'Docs menu' })
  if (await menu.isVisible()) await menu.locator('summary').click()
  await expect(navigation.getByRole('link', { name: 'Build a form' })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('navigation', { name: 'Previous and next pages' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Edit on GitHub' })).toHaveAttribute('href', 'https://github.com/just-every/run-pencil/edit/main/docs/guide/build-a-form.md')
  if (wide) await expect(page.getByRole('navigation', { name: 'On this page' })).toBeVisible()
  else await expect(page.locator('details.docs-toc-compact')).toBeVisible()
  await expect(page.getByRole('region', { name: /^Table: / }).first()).toBeAttached()

  // Following a link in the navigation shows that page.
  await navigation.getByRole('link', { name: 'Answer paths' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Answer paths' })).toBeVisible()

  // The response guide carries the editing, alert and chat doors without changing the docs shell.
  const resultsGuide=await page.goto('/docs/results')
  expect(resultsGuide?.status()).toBe(200)
  await expect(page.locator('.docs-prose')).toBeVisible()
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  const guideCapture=process.env.PENCIL_CAPTURE_DIR?join(process.env.PENCIL_CAPTURE_DIR,`results-guide-${info.project.name}.png`):info.outputPath(`results-guide-${info.project.name}.png`)
  if(process.env.PENCIL_CAPTURE_DIR)await mkdir(process.env.PENCIL_CAPTURE_DIR,{recursive:true})
  await page.screenshot({path:guideCapture,fullPage:true})

  const missing = await page.goto('/docs/no-such-page')
  expect(missing?.status()).toBe(404)
  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
  await expect(page).toHaveTitle(/Page not found/)
  await expect(page.locator('.docs-prose').getByRole('link', { name: 'overview' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)

  expect(await context.cookies()).toEqual([])
  expect(foreign).toEqual([])
})
