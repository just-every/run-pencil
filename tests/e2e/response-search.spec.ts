import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { contract } from './contract'
import { expect, openMailLink, test } from './fixtures'
import { operatorEmail } from './auth-identity'
import { appHeaders } from './api-headers'
import { downloadedText } from './export-helpers'
import { collectResponseSearchScenario } from '../response-search-scenario'
import type { ScenarioCall } from '../results-scenario'

contract(["LEDG-006","LEDG-008"], 'operators search responses, see matching answers and download the same filtered records', async ({ page }, info) => {
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
  const selectRevision = async (revision: string) => {
    const report = page.waitForResponse(response => {
      const url = new URL(response.url())
      return url.pathname === `${scenario.path}/results` && (revision === 'all'
        ? url.searchParams.get('allRevisions') === 'true'
        : url.searchParams.get('revisionId') === revision)
    })
    await page.getByLabel('Published revision').selectOption(revision)
    expect((await report).ok()).toBe(true)
    // The ledger loads independently, then remounts when the combined report's
    // revision arrives. Wait for that report before opening or searching rows.
    await expect(page.locator('section.results')).toHaveAttribute('aria-busy', 'false')
  }
  // The static "All published revisions" option exists before the client loads results; choose it once the ledger has.
  await expect(ledger.getByText('matching completed responses', { exact: false })).toBeVisible()
  await selectRevision('all')
  await ledger.getByRole('searchbox', { name: 'Search responses', exact: true }).fill('queue')
  await ledger.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(ledger.getByRole('button', { name: 'View answers', exact: true })).toHaveCount(2)
  await expect(ledger.locator('mark')).toHaveCount(2)
  await selectRevision(scenario.firstRevision)
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
    await ledger.locator('.ledger-answer mark').scrollIntoViewIfNeeded()
    await page.screenshot({ scale: 'css', path: join(process.env.PENCIL_CAPTURE_DIR, `response-search-${info.project.name}.png`) })
  }
  await ledger.getByRole('button', { name: 'Clear search' }).click()
  await expect(ledger.getByRole('button', { name: 'View answers', exact: true })).toHaveCount(2)
  await selectRevision('all')
  await ledger.getByRole('searchbox', { name: 'Search responses', exact: true }).fill('café et la STRASSE')
  await ledger.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(ledger.getByRole('button', { name: 'View answers', exact: true })).toHaveCount(1)
  await ledger.getByRole('button', { name: 'View answers', exact: true }).click()
  await expect(ledger.locator('.ledger-answer mark')).toHaveText('CAFE\u0301 et la Straße')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  if (process.env.PENCIL_CAPTURE_DIR) {
    await ledger.locator('.ledger-answer mark').scrollIntoViewIfNeeded()
    await page.screenshot({ scale: 'css', path: join(process.env.PENCIL_CAPTURE_DIR, `response-search-unicode-${info.project.name}.png`) })
  }
})
