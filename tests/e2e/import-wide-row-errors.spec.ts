import AxeBuilder from '@axe-core/playwright'
import { contract } from './contract'
import { expect } from './fixtures'
import { signInEmptyWorkspace } from './authoring-helpers'

contract(['IMPORT-002', 'IMPORT-004', 'BASE-PUBLIC-003'], 'an interrupted commit offers authenticated private-custody cancellation on both screens', async ({ page }, info) => {
  await page.setViewportSize(info.project.name === 'desktop' ? { width: 1440, height: 900 } : { width: 390, height: 844 })
  await signInEmptyWorkspace(page)
  await page.getByRole('link', { name: 'Import a form' }).click()
  const definition = JSON.stringify({ title: 'Interrupted import', fields: [{ ref: 'answer', title: 'Answer', type: 'short_text' }] })
  const csv = 'Answer,Submit Date\nkept source value,2026-09-12 10:03:00\n'
  await page.getByLabel('Form definition JSON').setInputFiles({ name: 'form.json', mimeType: 'application/json', buffer: Buffer.from(definition) })
  await page.getByLabel('Response CSV (optional)').setInputFiles({ name: 'responses.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) })
  await page.getByRole('button', { name: 'Review import', exact: true }).click()
  await page.getByRole('checkbox', { name: /I have reviewed every changed/ }).check()
  await page.route('**/api/app/imports/commit', route => route.abort('failed'), { times: 1 })
  await page.getByRole('button', { name: 'Import reviewed form', exact: true }).click()
  await expect(page.getByText(/An interrupted commit may have private import data/)).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect((await new AxeBuilder({ page }).analyze()).violations.filter(value => ['serious', 'critical'].includes(value.impact ?? ''))).toEqual([])
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  const cancelled = page.waitForResponse(response => response.url().endsWith('/api/app/imports/cancel-staging'))
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  expect((await cancelled).status()).toBe(200)
  await expect(page.getByText(/An interrupted commit may have private import data/)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Review import', exact: true })).toBeDisabled()
  expect(await (await page.request.get('/api/app/imports')).json()).toEqual([])
})
