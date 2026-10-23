import { appHeaders } from './api-headers'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { operatorEmail } from './auth-identity'
import { contract } from './contract'
import { expect, test, openMailLink } from './fixtures'
import AxeBuilder from '@axe-core/playwright'
import { beginHistoricalScenario } from '../import-results-scenario'
import type { ScenarioCall } from '../results-scenario'
import type { Ledger, FlowResults } from '../../src/core/app/api'
contract(['RSLT-001', 'RSLT-002', 'RSLT-003', 'IMPORT-004', 'LEDG-001', 'BASE-PUBLIC-003'], 'historical-only results show imported answers and actual zero native telemetry', async ({ page }, info) => {
  test.setTimeout(90000)
  await page.setViewportSize(info.project.name === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 900 })
  const email = operatorEmail()
  await page.goto('/signin'); await page.getByLabel('Operator email').fill(email)
  await page.getByRole('button', { name: /Send.*link/i }).click()
  await openMailLink(page, email)
  await page.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your flows' })).toBeVisible()
  let serial = 0
  const call: ScenarioCall = async <T,>(path: string, data?: unknown, method = data === undefined ? 'GET' : 'POST'): Promise<T> => {
    const response = await page.request.fetch(path, { method, headers: { ...appHeaders, 'CF-Connecting-IP': `198.18.167.${++serial % 250}` }, ...(data === undefined ? {} : { data }) })
    expect(response.status(), path).toBeGreaterThanOrEqual(200); expect(response.status(), path).toBeLessThan(300)
    return response.status() === 204 ? undefined as T : await response.json() as T
  }
  const imported = await beginHistoricalScenario(call, false, `${info.project.name} historical answer study ${Date.now()}`)
  await imported.finish()
  const path = `/api/app/flows/${imported.review.flowId}`
  const ledgerData = await call<Ledger>(`${path}/ledger?source=imported`)
  const sourceRevision = ledgerData.responses[0].revisionId
  expect(await call<FlowResults>(`${path}/results?revisionId=${sourceRevision}`)).toMatchObject({ completedResponses: 1, importedResponses: 1, liveCompletedResponses: 0, starts: 0, completionRate: 0, averageCompletionMilliseconds: 0 })
  await page.goto(`/app/flows/${imported.review.flowId}/results`)
  await page.getByLabel('Published revision').selectOption(sourceRevision)
  const answers = page.getByRole('region', { name: 'Answers', exact: true })
  await expect(answers.getByText('1 answer imported')).toBeVisible()
  await expect(answers.getByText('Hello', { exact: true })).toBeVisible()
  await expect(page.getByText('0 live · 1 imported', { exact: true })).toBeVisible()
  const summary=page.locator('.results-summary')
  const metric=(label:string)=>summary.locator('article').filter({has:page.getByText(label,{exact:true})})
  await expect(metric('Completion rate')).toContainText('0 native completions / 0 views')
  await expect(metric('Average time')).toContainText('0ms total / 0 native completed responses')
  const counts = answers.getByText('How we count', { exact: true }); await counts.click()
  await expect(answers.getByText('0 distinct sessions reached · 0 expired sessions ended here · No rate drop-off (0 / 0 reached sessions)')).toBeVisible()
  const ledger = page.getByRole('region', { name: 'Response ledger' })
  await ledger.getByLabel('Source', { exact: true }).selectOption('imported')
  await ledger.getByLabel('Device class',{exact:true}).selectOption('unknown')
  await expect(metric('Responses').locator('strong')).toHaveText('1')
  await expect(metric('Starts').locator('strong')).toHaveText('0')
  await expect(metric('Completion rate')).toContainText('0 native completions / 0 filtered native response starts')
  await expect(metric('Average time').locator('strong')).toHaveText('0s')
  await expect(metric('Average time')).toContainText('0ms total / 0 native completed responses')
  await expect(answers.getByText('1 answer imported')).toBeVisible()
  await expect(answers.getByText('Hello',{exact:true})).toBeVisible()
  await expect(page.locator('.device-card')).toContainText('0 filtered native responses')
  await expect(page.locator('.device-card')).toContainText('1 imported responses have no native session')
  expect(await call<FlowResults>(`${path}/results?${new URLSearchParams({revisionId:sourceRevision,source:'imported',deviceClass:'unknown'})}`)).toMatchObject({completedResponses:1,importedResponses:1,liveCompletedResponses:0,starts:0,rateBasis:'responses',rateNumerator:0,rateDenominator:0,durationSamples:0,totalCompletionMilliseconds:0})
  await page.getByLabel('Published revision').selectOption('all')
  await expect(metric('Responses').locator('strong')).toHaveText('1')
  await expect(answers.getByText('Hello',{exact:true})).toBeVisible()
  await page.getByLabel('Published revision').selectOption(sourceRevision)
  await ledger.getByRole('button', { name: 'View answers', exact: true }).click()
  await expect(ledger.getByText('Hello', { exact: true })).toBeVisible()
  await ledger.getByRole('button',{name:'Clear response filters',exact:true}).click()
  await expect(metric('Completion rate')).toContainText('0 native completions / 0 views')
  await expect(metric('Responses').locator('strong')).toHaveText('1')
  await expect(page.getByLabel('Email me about completed responses')).toHaveValue('off')
  expect(await page.locator('.operator-content').innerText()).not.toMatch(/\b[0-9A-HJKMNP-TV-Z]{26}\b/)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect((await new AxeBuilder({ page }).include('.operator-content').analyze()).violations).toEqual([])
  if (process.env.PENCIL_CAPTURE_DIR) {
    await mkdir(process.env.PENCIL_CAPTURE_DIR, { recursive: true })
    await page.screenshot({ path: join(process.env.PENCIL_CAPTURE_DIR, `${info.project.name}-imported-results.png`), fullPage: true })
  }
})
