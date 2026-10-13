import AxeBuilder from '@axe-core/playwright'
import { contract } from './contract'
import { expect } from './fixtures'
import { signInEmptyWorkspace } from './authoring-helpers'

contract(['IMPORT-002', 'IMPORT-004', 'BASE-PUBLIC-003'], 'private preparation can be cancelled by keyboard before any form is created on both screens', async ({ page }, info) => {
  await page.setViewportSize(info.project.name === 'desktop' ? { width: 1440, height: 900 } : { width: 390, height: 844 })
  await signInEmptyWorkspace(page)
  const definition = JSON.stringify({ title: 'Cancelled private form', fields: [{ ref: 'answer', title: 'Answer', type: 'short_text' }] })
  const review = await (await page.request.post('/api/app/imports/review', { data: { definition, csv: '' } })).json()
  const response = await page.request.post('/api/app/imports/commit', { data: { definition, csv: '', plannedAt: review.plannedAt, columns: review.columns, fingerprint: review.fingerprint, acknowledged: true } })
  expect(response.status()).toBe(200)
  const prepared = await response.json()
  expect(prepared).toMatchObject({ state: 'preparing', checkpoint: 0, total: 1 })
  await page.getByRole('link', { name: 'Import a form' }).click()
  await expect(page.getByRole('heading', { name: 'Ready to verify · 0 / 1' })).toBeVisible()
  await page.getByRole('button', { name: 'Cancel preparation', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Preparation cancelled · 0 / 1' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Continue import', exact: true })).toHaveCount(0)
  expect(await (await page.request.get('/api/app/imports')).json()).toEqual([])
  expect((await page.request.post(`/api/app/imports/${prepared.id}/resume`, { data: {} })).status()).toBe(400)
  await page.screenshot({ path: info.outputPath('cancelled-private-preparation.png'), fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  expect((await new AxeBuilder({ page }).analyze()).violations.filter(v => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual([])
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Import history' })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Ready to verify|Preparation cancelled/ })).toHaveCount(0)
})
