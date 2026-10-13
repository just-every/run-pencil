import AxeBuilder from '@axe-core/playwright'
import { contract } from './contract'
import { expect } from './fixtures'
import { signInEmptyWorkspace } from './authoring-helpers'
import { formJson, csv, simpleJson, simpleCsv } from '../fixtures/form-import/fixture'
import { readReviewStream } from '../../src/core/features/importing/review-stream'
contract(['IMPORT-001', 'IMPORT-002', 'IMPORT-003', 'IMPORT-004', 'BASE-PUBLIC-003'], 'import review, loss acknowledgement, bounded progress, repeat and undo are accessible at both viewport sizes', async ({ page }, info) => {
  await page.setViewportSize(info.project.name === 'desktop' ? { width: 1440, height: 900 } : { width: 390, height: 844 })
  await signInEmptyWorkspace(page)
  await page.getByRole('link', { name: 'Import a form' }).click()
  await expect(page.getByRole('heading', { name: 'Import a form', exact: true })).toBeVisible()
  let screenshot = 0
  const check = async () => { await page.screenshot({ path: info.outputPath(`import-${++screenshot}.png`), fullPage: true }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true); expect((await new AxeBuilder({ page }).analyze()).violations.filter(v => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual([]) }
  await check()
  await page.getByLabel('Form definition JSON').setInputFiles({ name: 'form.json', mimeType: 'application/json', buffer: Buffer.from(formJson) })
  await page.getByLabel('Response CSV (optional)').setInputFiles({ name: 'responses.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) })
  await page.getByRole('button', { name: 'Review import', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Review the mapping' })).toBeVisible()
  await expect(page.getByText(/27 valid response rows/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Import reviewed form' })).toBeDisabled()
  await expect(page.getByLabel(/Network ID/)).toBeDisabled()
  await check()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  expect(await (await page.request.get('/api/app/imports')).json()).toEqual([])
  await page.getByLabel('Form definition JSON').setInputFiles({ name: 'simple.json', mimeType: 'application/json', buffer: Buffer.from(simpleJson) })
  await page.getByLabel('Response CSV (optional)').setInputFiles({ name: 'simple.csv', mimeType: 'text/csv', buffer: Buffer.from(simpleCsv) })
  await page.getByRole('button', { name: 'Review import', exact: true }).click()
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Import reviewed form' }).click()
  await expect(page.getByRole('heading', { name: 'Ready to verify · 0 / 2' })).toBeVisible()
  await check()
  await page.getByRole('button', { name: 'Continue import', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'completed · 2 / 2' })).toBeVisible()
  await check()
  const historyBeforeRefresh = await (await page.request.get('/api/app/imports')).json()
  expect(historyBeforeRefresh).toHaveLength(1)
  expect(historyBeforeRefresh[0]).toMatchObject({ state: 'completed', checkpoint: 2, total: 2 })
  const refreshResponse = page.waitForResponse(response => response.url().endsWith('/api/app/imports/review') && response.request().method() === 'POST')
  await page.getByRole('button', { name: 'Refresh mapping report' }).click()
  const response = await refreshResponse
  expect(response.status()).toBe(200)
  const body = new Uint8Array(await response.body())
  const review = await readReviewStream(new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(body); controller.close() } }))
  expect(review).toMatchObject({ alreadyImported: true, jobId: historyBeforeRefresh[0].id, jobState: 'completed' })
  const historyAfterRefresh = await (await page.request.get('/api/app/imports')).json()
  expect(historyAfterRefresh).toEqual(historyBeforeRefresh)
  expect(historyAfterRefresh[0]).toMatchObject({ id: historyBeforeRefresh[0].id, checkpoint: historyBeforeRefresh[0].checkpoint, total: historyBeforeRefresh[0].total })
  await expect(page.getByRole('button', { name: 'Import reviewed form', exact: true })).toHaveCount(0)
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Undo import', exact: true }).click()
  await expect(page.getByRole('heading', { name: /undone/ })).toBeVisible()
  await check()
})
