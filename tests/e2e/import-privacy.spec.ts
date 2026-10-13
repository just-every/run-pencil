import AxeBuilder from '@axe-core/playwright'
import { contract } from './contract'
import { expect } from './fixtures'
import { signInEmptyWorkspace } from './authoring-helpers'

contract(['IMPORT-002', 'IMPORT-003', 'BASE-PUBLIC-003'], 'hidden names and neutral network titles stay visibly locked to Skip on both screens', async ({ page }, info) => {
  await page.setViewportSize(info.project.name === 'desktop' ? { width: 1440, height: 900 } : { width: 390, height: 844 })
  await signInEmptyWorkspace(page)
  await page.getByRole('link', { name: 'Import a form' }).click()
  const definition = JSON.stringify({ title: 'Private metadata review', hidden: ['customer_id'], fields: [{ ref: 'answer', type: 'short_text', title: 'Answer' }, { ref: 'ip_address', type: 'short_text', title: 'Technical identifier' }] })
  const csv = 'customer_id,Technical identifier,Answer,Submit Date\nprivate-hidden-value,private-network-value,Publicly supplied answer,2026-09-12 10:03:00'
  await page.getByLabel('Form definition JSON').setInputFiles({ name: 'form.json', mimeType: 'application/json', buffer: Buffer.from(definition) })
  await page.getByLabel('Response CSV (optional)').setInputFiles({ name: 'responses.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) })
  await page.getByRole('button', { name: 'Review import', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Review the mapping' })).toBeVisible()
  for (const label of ['1. customer_id', '2. Technical identifier']) {
    await expect(page.getByRole('combobox', { name: label, exact: true })).toBeDisabled()
    await expect(page.getByRole('combobox', { name: label, exact: true })).toHaveValue('skip')
  }
  await expect(page.getByRole('combobox', { name: '3. Answer', exact: true })).toBeEnabled()
  expect(await page.getByRole('combobox', { name: '3. Answer', exact: true }).locator('option').allTextContents()).not.toContain('Technical identifier (short_text)')
  expect(await page.locator('body').innerText()).not.toMatch(/private-hidden-value|private-network-value/)
  const malicious = await page.request.post('/api/app/imports/review', { data: { definition, csv, columns: [{ column: 0, target: 'startedAt' }, { column: 1, target: 'submittedAt' }, { column: 2, target: 'skip' }, { column: 3, target: 'submittedAt' }] } })
  expect(malicious.status()).toBe(200)
  expect((await malicious.json()).columns.slice(0, 2)).toEqual([{ column: 0, target: 'skip' }, { column: 1, target: 'skip' }])
  await page.screenshot({ path: info.outputPath('private-source-columns.png'), fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  expect((await new AxeBuilder({ page }).analyze()).violations.filter(violation => ['serious', 'critical'].includes(violation.impact ?? ''))).toEqual([])
})
