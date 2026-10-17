import { appHeaders } from './api-headers'
import AxeBuilder from '@axe-core/playwright'
import { contract } from './contract'
import { expect, test } from './fixtures'
import { signInEmptyWorkspace } from './authoring-helpers'

contract(['IMPORT-002', 'IMPORT-004', 'BASE-PUBLIC-003'], 'paged imports pause at durable progress and continue through completion and undo on both screens', async ({ page }, info) => {
  // Completion and undo each retain their existing 90-second assertion bound.
  test.setTimeout(240_000)
  await page.setViewportSize(info.project.name === 'desktop' ? { width: 1440, height: 900 } : { width: 390, height: 844 })
  await signInEmptyWorkspace(page)
  const definition = JSON.stringify({ title: 'Paged response import', fields: [{ ref: 'answer', title: 'Answer', type: 'short_text' }] })
  const csv = 'Answer,Submit Date\n' + Array.from({ length: 201 }, (_, i) => `distinct-${i},2026-09-12 10:03:00`).join('\n')
  const review = await (await page.request.post('/api/app/imports/review', { headers: appHeaders, data: { definition, csv } })).json()
  const committed = await page.request.post('/api/app/imports/commit', { headers: appHeaders, data: { definition, csv, plannedAt: review.plannedAt, columns: review.columns, fingerprint: review.fingerprint, acknowledged: true } })
  expect(committed.status()).toBe(200)
  expect(await committed.json()).toMatchObject({ state: 'preparing', checkpoint: 0 })
  await page.getByRole('link', { name: 'Import a form' }).click()
  await expect(page.getByRole('heading', { name: 'Ready to verify · 0 / 202' })).toBeVisible()
  await expect(page.getByText('No form or responses have been created. Continue to verify the stored preparation and begin importing.')).toBeVisible()
  await page.screenshot({ path: info.outputPath('private-preparation.png'), fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  expect((await new AxeBuilder({ page }).analyze()).violations.filter(v => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual([])
  let release: (() => void) | undefined
  await page.route('**/api/app/imports/*/resume', async route => { await new Promise<void>(resolve => { release = resolve }); await route.continue() }, { times: 1 })
  await page.getByRole('button', { name: 'Continue import', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: 'Pause after this batch' })).toBeVisible()
  await expect.poll(() => Boolean(release)).toBe(true)
  await page.getByRole('button', { name: 'Pause after this batch' }).click()
  release!()
  await expect(page.getByRole('button', { name: 'Continue import', exact: true })).toBeEnabled()
  await page.screenshot({ path: info.outputPath('paused-import-progress.png'), fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  expect((await new AxeBuilder({ page }).analyze()).violations.filter(v => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual([])
  await page.getByRole('button', { name: 'Continue import', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'completed · 202 / 202' })).toBeVisible({ timeout: 90_000 })
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Undo import', exact: true }).click()
  await expect(page.getByRole('heading', { name: /undone/ })).toBeVisible({ timeout: 90_000 })
  expect((await (await page.request.get('/api/app/imports')).json())[0].state).toBe('undone')
  await page.screenshot({ path: info.outputPath('undone-paged-import.png'), fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  expect((await new AxeBuilder({ page }).analyze()).violations.filter(v => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual([])
})
