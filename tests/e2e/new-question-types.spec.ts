import { developmentInbox } from '../helpers/development-outbox'
import { devKeyHeaders } from '../helpers/dev-key.mjs'
import { downloadedText, csvRows } from './export-helpers'
import { operatorEmail } from './auth-identity'
import AxeBuilder from '@axe-core/playwright'
import { contract } from './contract'
import { expect, test } from './fixtures'
import type { BuilderDraft } from '../../src/core/app/api'
// Isolate this new journey's API traffic; actual per-address rate limits stay enabled.
test.use({ locale: 'en-GB', extraHTTPHeaders: { 'CF-Connecting-IP': '198.18.240.31' } })
contract(['FLOW-003', 'RESP-003', 'LEDG-004', 'BASE-PUBLIC-003'], 'six additional question types reject an empty required answer and complete through native controls at both widths', async ({ page }, info) => {
  const request = page.request
  test.setTimeout(120_000)
  await page.setViewportSize(info.project.name === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 900 })
  const origin = new URL(info.project.use.baseURL!).origin
  const slug = `question-matrix-${info.project.name}-${Date.now()}`
  const call = async <T,>(path: string, data?: unknown) => {
    const response = await request.fetch(path, { method: data === undefined ? 'GET' : 'POST', headers: { Origin: origin }, ...(data === undefined ? {} : { data }) })
    expect(response.status(), path).toBeLessThan(300)
    return await response.json() as T
  }
  const email = operatorEmail()
  await call('/auth/magic-link', { email })
  const inbox = await developmentInbox(path => request.get(path, { headers: devKeyHeaders }), email)
  await request.post('/auth/confirm', { headers: { Origin: new URL(process.env.PENCIL_E2E_BASE_URL!).origin }, data: { token: inbox.messages[0].magicLinkToken }, maxRedirects: 0 })
  const created = await call<{ id: string }>('/api/app/flows', { title: 'Synthetic question matrix', slug })
  const path = `/api/app/flows/${created.id}`
  const types = ['dropdown','yes_no','nps','number','date','consent'] as const
  for (const questionType of types) {
    const draft = await call<BuilderDraft>(`${path}/draft`)
    await call(`${path}/draft/steps`, { expectedVersion: draft.flow.draftVersion, step: { kind: 'question', questionType, prompt: `Answer ${questionType}`, required: true, questionSettings: questionType === 'consent' ? { statement: 'I agree to the published statement.' } : questionType === 'number' ? { min: -2, max: 2, decimalPlaces: 2 } : questionType === 'date' ? { earliest: '2024-02-01', latest: '2024-03-01' } : {}, ...(questionType === 'dropdown' ? { choices: ['A','B','C'].map(label => ({ label, value: label })) } : {}) } })
  }
  let draft = await call<BuilderDraft>(`${path}/draft`)
  await call(`${path}/draft/steps`, { expectedVersion: draft.flow.draftVersion, step: { kind: 'completion', questionType: null, prompt: 'All six answered' } })
  draft = await call<BuilderDraft>(`${path}/draft`)
  await call(`${path}/publish`, { expectedVersion: draft.flow.draftVersion })
  const tabTo = async (locator: import('@playwright/test').Locator) => {
    for (let i = 0; i < 100; i++) { await page.keyboard.press('Tab'); if (await locator.evaluate(element => element === document.activeElement)) return }
    throw new Error('Question control was not reachable by keyboard.')
  }
  const check = async () => {
    expect((await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()).violations).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await page.goto(`/app/flows/${created.id}/builder`)
  await expect(page.locator('.operator-shell[data-hydrated=true]')).toBeVisible()
  for (const [index, type] of types.entries()) {
    await tabTo(page.locator('.step-button').nth(index)); await page.keyboard.press('Enter')
    await expect(page.getByLabel('Question type')).toHaveValue(type)
    await expect(page.getByLabel('Draft question canvas')).toBeVisible()
    if (type === 'consent') await expect(page.getByLabel('Consent statement')).toHaveValue('I agree to the published statement.')
    if (type === 'number') await expect(page.getByLabel('Decimal places')).toHaveValue('2')
    if (type === 'date') await expect(page.getByLabel('Earliest date')).toHaveValue('2024-02-01')
    if (type === 'nps') { await expect(page.getByLabel('Zero label')).toBeVisible(); await expect(page.getByLabel('Ten label')).toBeVisible() }
    await check()
  }
  await page.goto(`/f/${slug}`)
  for (const [index, type] of types.entries()) {
    await expect(page.getByRole('heading', { name: `Answer ${type}`, exact: true })).toBeVisible()
    expect(await page.locator('[data-selected=true]').count()).toBe(0)
    await expect(page.locator('fieldset [aria-required=true]')).toHaveCount(1)
    const next = page.getByRole('button', { name: index === types.length - 1 ? 'Submit response' : 'Continue', exact: true })
    await tabTo(next); await page.keyboard.press('Enter')
    await expect(page.getByRole('alert')).toContainText(`Answer ${type}`)
    await check()
    expect(await page.locator('.respondent-card > .respondent-top').evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16)
    if (type === 'dropdown') {
      await tabTo(page.getByRole('combobox', { name: 'Answer dropdown' })); await page.keyboard.press('a'); await page.keyboard.press('Enter')
    } else if (type === 'yes_no') {
      await tabTo(page.getByRole('radio', { name: 'Yes', exact: true })); await page.keyboard.press('ArrowDown')
    } else if (type === 'nps') {
      await tabTo(page.getByRole('radio', { name: '0', exact: true })); await page.keyboard.press('Space')
    } else if (type === 'consent') {
      await tabTo(page.getByRole('checkbox', { name: 'Answer consent' })); await page.keyboard.press('Space')
    } else if (type === 'number') {
      await tabTo(page.getByRole('spinbutton', { name: 'Answer number' })); await page.keyboard.type('-1.25')
    } else {
      const date = page.locator('input[type=date][aria-label="Answer date"]')
      await tabTo(date)
      // Native mobile date pickers do not expose desktop keyboard segments.
      // Use the browser's date input, then submit through the same form.
      await date.fill('2024-02-29')
      await expect(date).toHaveValue('2024-02-29')
    }
    await expect(page.getByText('Required', { exact: true })).toBeVisible()
    await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', String(Math.round((index + 1) / types.length * 100)))
    if (type === 'consent') {
      // Keep the actual admission policy: automated input needs real reading time.
      await page.waitForTimeout(3200)
      const submitted = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === `/api/public/flows/${slug}/responses`)
      await tabTo(next); await page.keyboard.press('Enter')
      expect((await (await submitted).json()).disposition).toBe('released')
    } else { await tabTo(next); await page.keyboard.press('Enter') }
  }
  await expect(page.getByRole('heading', { name: 'All six answered' })).toBeVisible()
  await check()
  await page.goto(`/app/flows/${created.id}/results`)
  const ledger = page.getByRole('region', { name: 'Response ledger' })
  await expect(ledger.getByText('1 matching completed responses', { exact: false })).toBeVisible()
  const jsonDownload = page.waitForEvent('download')
  await tabTo(ledger.getByRole('button', { name: 'Export JSON' })); await page.keyboard.press('Enter')
  const exported = JSON.parse(await downloadedText(await jsonDownload))
  expect(exported.responses).toHaveLength(1)
  expect(exported.responses[0].answers.map((answer: { value: unknown }) => answer.value)).toEqual([draft.choices[0].value, false, 0, -1.25, '2024-02-29', { accepted: true, statement: 'I agree to the published statement.' }])
  const csvDownload = page.waitForEvent('download')
  await tabTo(ledger.getByRole('button', { name: 'Export CSV' })); await page.keyboard.press('Enter')
  const csv = csvRows(await downloadedText(await csvDownload))
  expect(csv).toHaveLength(2)
  expect(csv[1][0]).toBe(exported.responses[0].id)
  expect(JSON.parse(csv[1][8])).toEqual(exported.responses[0].answers)

})
