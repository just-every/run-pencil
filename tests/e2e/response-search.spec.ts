import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { contract } from './contract'
import { expect, openMailLink, test } from './fixtures'
import { operatorEmail } from './auth-identity'
import { appHeaders } from './api-headers'
import { downloadedText } from './export-helpers'
import { collectResponseSearchScenario } from '../response-search-scenario'
import type { ScenarioCall } from '../results-scenario'

contract('LEDG-006', 'operators search responses, see matching answers and download the same filtered records', async ({ page }, info) => {
  test.setTimeout(120_000)
  const email = operatorEmail()
  await page.goto('/signin'); await page.getByLabel('Operator email').fill(email)
  await page.getByRole('button', { name: /Send.*link/i }).click()
  await openMailLink(page, email); await page.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your flows' })).toBeVisible()
  let serial = 0
  const call: ScenarioCall = async <T,>(path: string, data?: unknown, method = data === undefined ? 'GET' : 'POST'): Promise<T> => {
    const response = await page.request.fetch(path, { method, headers: { ...appHeaders, 'CF-Connecting-IP': `198.18.181.${++serial % 250}` }, ...(data === undefined ? {} : { data }) })
    expect(response.status(), path).toBeGreaterThanOrEqual(200); expect(response.status(), path).toBeLessThan(300)
    return response.status() === 204 ? undefined as T : await response.json() as T
  }
  const scenario = await collectResponseSearchScenario(call, `search-${info.project.name}-${Date.now()}`)
  await page.goto(`/app/flows/${scenario.flowId}/results`)
  const ledger = page.getByRole('region', { name: 'Response ledger' })
  await ledger.getByLabel('Response revision').selectOption('')
  await ledger.getByRole('searchbox', { name: 'Search responses', exact: true }).fill('queue')
  await ledger.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(ledger.getByRole('button', { name: 'View answers', exact: true })).toHaveCount(2)
  await expect(ledger.locator('mark')).toHaveCount(2)
  await ledger.getByLabel('Response revision').selectOption(scenario.firstRevision)
  await expect(ledger.getByRole('button', { name: 'View answers', exact: true })).toHaveCount(1)
  await ledger.getByRole('button', { name: 'View answers', exact: true }).click()
  await expect(ledger.locator('.ledger-answer mark')).toHaveText('queue')
  const download = page.waitForEvent('download')
  await ledger.getByRole('button', { name: 'Export JSON' }).click()
  const snapshot = JSON.parse(await downloadedText(await download))
  expect(snapshot.filter).toMatchObject({ search: 'queue', revisionId: scenario.firstRevision })
  expect(snapshot.responses.map((response: {id:string}) => response.id)).toEqual([scenario.slow])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  if (process.env.PENCIL_CAPTURE_DIR) {
    await mkdir(process.env.PENCIL_CAPTURE_DIR, { recursive: true })
    await ledger.scrollIntoViewIfNeeded()
    await ledger.screenshot({ path: join(process.env.PENCIL_CAPTURE_DIR, `response-search-${info.project.name}.png`) })
  }
  await ledger.getByRole('button', { name: 'Clear search' }).click()
  await expect(ledger.getByRole('button', { name: 'View answers', exact: true })).toHaveCount(2)
})
