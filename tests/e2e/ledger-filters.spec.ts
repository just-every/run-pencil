import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import AxeBuilder from '@axe-core/playwright'
import { contract } from './contract'
import { expect, test, openLocalOutbox } from './fixtures'
import { operatorEmail } from './auth-identity'
import { downloadedText, csvRows } from './export-helpers'
import { collectLedgerFilterScenario, consentStatement } from '../ledger-filter-scenario'
import type { ScenarioCall } from '../results-scenario'
import type { LedgerResponse } from '../../src/core/app/api'

contract(['LEDG-001', 'LEDG-003', 'LEDG-004', 'FLOW-019', 'IMPORT-003', 'BASE-PUBLIC-003'], 'native and imported typed filters download exact response snapshots with readable decisions and compact rows at both widths', async ({ page }, info) => {
  test.setTimeout(180_000)
  await page.setViewportSize(info.project.name === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 900 })
  const email = operatorEmail()
  await page.goto('/signin'); await page.getByLabel('Operator email').fill(email)
  await page.getByRole('button', { name: /Send.*link/i }).click()
  await openLocalOutbox(page)
  await page.locator('article').filter({ hasText: email }).getByRole('link', { name: 'Read message' }).first().click()
  await page.getByRole('link', { name: 'Open this link' }).click()
  await page.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your flows' })).toBeVisible()
  let serial = 0
  const call: ScenarioCall = async <T,>(path: string, data?: unknown, method = data === undefined ? 'GET' : 'POST'): Promise<T> => {
    const response = await page.request.fetch(path, { method, headers: { 'CF-Connecting-IP': `198.18.171.${++serial % 250}` }, ...(data === undefined ? {} : { data }) })
    expect(response.status(), path).toBeGreaterThanOrEqual(200); expect(response.status(), path).toBeLessThan(300)
    return response.status() === 204 ? undefined as T : await response.json() as T
  }
  const scenario = await collectLedgerFilterScenario(call, `Response filter study ${info.project.name} ${Date.now()}`)
  const workspace = await call<{ timeZone: string }>('/api/app/workspace')
  await page.goto(`/app/flows/${scenario.flowId}/results`)
  const ledger = page.getByRole('region', { name: 'Response ledger' })
  const checkLayout = async () => {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const violations = (await new AxeBuilder({ page }).include('.operator-content').analyze()).violations
    expect(violations.filter(violation => violation.impact === 'serious' || violation.impact === 'critical')).toEqual([])
  }
  for (const source of ['direct', 'imported'] as const) {
    const revisionId = source === 'direct' ? scenario.nativeRevisionId : scenario.importedRevisionId
    await page.getByLabel('Published revision').selectOption(revisionId)
    await expect(ledger.getByRole('button', { name: 'View answers', exact: true })).toHaveCount(2)
    await ledger.getByLabel('Source', { exact: true }).selectOption(source)
    if (source === 'imported') await expect(page.getByText('0 live · 2 imported', { exact: true })).toBeVisible()
    const choice = scenario.current.choices.find(choice => choice.stepId === scenario.stepId('dropdown'))!
    const cases = [['yes_no', 'true', 'Yes'], ['yes_no', 'false', 'No'], ['consent', 'true', 'Accepted'], ['consent', 'false', 'Declined'], ['number', '11.0', null], ['nps', '0', null], ['rating', '5', null], ['date', '2024-02-29', null], ['dropdown', choice.id, 'Coffee']] as const
    for (const [type, value, label] of cases) {
      await ledger.getByLabel('Structured question').selectOption(scenario.stepId(type))
      const input = ledger.getByLabel('Answer contains / equals')
      const loaded = page.waitForResponse(response => {
        const url = new URL(response.url())
        return url.pathname === `${scenario.path}/ledger` && url.searchParams.get('answerStepId') === scenario.stepId(type) && url.searchParams.get('answerValue') === value
      })
      if (label) await input.selectOption({ label })
      else await input.fill(value)
      expect((await loaded).status()).toBe(200)
      await expect(ledger.getByRole('button', { name: 'View answers', exact: true })).toHaveCount(1)
      const positive = value !== 'false' && !(type === 'nps' && value === '0')
      const expectedId = source === 'direct' ? (positive ? scenario.nativePositive.responseId : scenario.nativeNegative.responseId) : (positive ? scenario.importedPositive.id : scenario.importedNegative.id)
      let downloaded: LedgerResponse | undefined
      for (const format of ['JSON', 'CSV']) {
        const download = page.waitForEvent('download')
        await ledger.getByRole('button', { name: `Export ${format}` }).click()
        const text = await downloadedText(await download)
        if (format === 'JSON') {
          const snapshot = JSON.parse(text)
          expect(snapshot.filter).toMatchObject({ revisionId, source, answerStepId: scenario.stepId(type), answerValue: value })
          expect(snapshot.responses.map((response: LedgerResponse) => response.id)).toEqual([expectedId])
          expect(snapshot.excludedQuarantined).toBe(0)
          downloaded = snapshot.responses[0]
          expect(downloaded!.revisionId).toBe(revisionId)
          expect(downloaded!.source).toBe(source)
          expect(downloaded!.completedAt <= snapshot.cutoff && downloaded!.releasedAt <= snapshot.cutoff).toBe(true)
          expect(downloaded!.answers.find(answer => answer.questionType === 'consent')?.value).toEqual({ accepted: positive, statement: consentStatement })
        } else {
          const [header, ...rows] = csvRows(text)
          expect(rows).toHaveLength(1)
          const record = Object.fromEntries(header.map((name, index) => [name, rows[0][index]]))
          expect(record.response_id).toBe(expectedId); expect(record.revision_id).toBe(revisionId); expect(record.source).toBe(source)
          expect(record.revision_number).toBe(String(downloaded!.revisionNumber))
          expect(JSON.parse(record.answers_json)).toEqual(downloaded!.answers)
          expect(record.completed_at <= record.cutoff && record.released_at <= record.cutoff).toBe(true)
          expect(record.excluded_quarantined).toBe('0')
        }
      }
      const article = ledger.locator('.ledger-list article')
      const date = await page.evaluate(({ value, timeZone }) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(new Date(value)), { value: downloaded!.completedAt, timeZone: workspace.timeZone })
      await expect(article.locator(':scope > p').first()).toHaveText(`${date} · ${source === 'direct' ? 'Direct link' : 'Imported'}`)
      await expect(article.getByText(`Revision ${downloaded!.revisionNumber}`, { exact: true })).toHaveCount(0)
      const answers = article.getByRole('button', { name: 'View answers', exact: true })
      await answers.click()
      await expect(article.getByText(`Revision ${downloaded!.revisionNumber}`, { exact: true })).toBeVisible()
      await expect(article.locator('.ledger-answer').filter({ hasText: consentStatement }).locator('dd')).toHaveText(`${positive ? 'Accepted' : 'Declined'}\n${consentStatement}`)
      await checkLayout()
      if (process.env.PENCIL_CAPTURE_DIR && type === 'consent') {
        await mkdir(process.env.PENCIL_CAPTURE_DIR, { recursive: true })
        await page.screenshot({ path: join(process.env.PENCIL_CAPTURE_DIR, `${info.project.name}-ledger-${source}-${value}.png`), fullPage: true })
      }
      await answers.click()
    }
  }
})
