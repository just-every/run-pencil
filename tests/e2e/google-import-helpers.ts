import AxeBuilder from '@axe-core/playwright'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { Page, TestInfo } from '@playwright/test'
import { expect } from './fixtures'
import type { ImportReview } from '../../src/core/features/importing/model'
export const googleFixture = (name: string) => join(process.cwd(), 'tests/fixtures/form-import', name)
export async function captureGoogle(page: Page, info: TestInfo, step: string) {
  const directory = process.env.PENCIL_GOOGLE_CAPTURE_DIR
  if (directory) await mkdir(directory, { recursive: true })
  const name = `${info.project.name}-${step}.png`
  await page.screenshot({ path: directory ? join(directory, name) : info.outputPath(name), fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
}
export async function googleReview(page: Page): Promise<ImportReview> {
  const response = page.waitForResponse(response => response.url().endsWith('/api/app/imports/review') && response.request().method() === 'POST')
  await page.getByRole('button', { name: /^(Review import|Refresh mapping report)$/ }).click()
  const result = await response; expect(result.status()).toBe(200)
  const text = await result.text(), data = result.headers()['content-type']?.includes('ndjson') ? JSON.parse(text.split('\n')[0]).review : JSON.parse(text)
  await expect(page.getByRole('heading', { name: 'Review the mapping' })).toBeVisible()
  return data
}
export async function completeGoogle(page: Page) {
  await page.getByRole('checkbox', { name: /I have reviewed every/ }).check()
  await page.getByRole('button', { name: 'Import reviewed form', exact: true }).click()
  await expect(page.getByRole('heading', { name: /Ready to verify/ })).toBeVisible()
}
export async function continueGoogle(page: Page) {
  await page.getByRole('button', { name: 'Continue import', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: /^completed/ })).toBeVisible({ timeout: 60_000 })
}
export async function startGoogle(page: Page, definition?: string, csv?: string) {
  await page.getByRole('link', { name: 'Import a form', exact: true }).click()
  await page.getByRole('combobox', { name: 'Source', exact: true }).selectOption('google-forms')
  if (definition) await page.getByLabel(/Form definition JSON/).setInputFiles(googleFixture(definition))
  if (csv) await page.getByLabel(/Response CSV/).setInputFiles(googleFixture(csv))
}
export async function openAllFlows(page: Page) {
  await page.getByRole('link', { name: 'All flows', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your flows', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'All flows', exact: true })).toHaveAttribute('aria-pressed', 'true')
}
export async function openGoogleFlowCard(page: Page, flowId: string, action: 'Builder' | 'Results') {
  await openAllFlows(page)
  const destination = `/app/flows/${flowId}/${action === 'Builder' ? 'builder' : 'results'}`
  const card = page.locator('.flow-card').filter({ has: page.locator(`a[href="${destination}"]`) })
  await expect(card).toHaveCount(1)
  const title = await card.getByRole('heading', { level: 2 }).innerText()
  await card.getByRole('link', { name: action, exact: true }).click()
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
}
export async function openGoogleImport(page: Page) {
  await openAllFlows(page)
  await page.getByRole('link', { name: 'Import a form', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Import a form', exact: true })).toBeVisible()
}
