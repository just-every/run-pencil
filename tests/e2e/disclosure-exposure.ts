import { expect, type Page } from '@playwright/test'
import { createRequire } from 'node:module'
import readXlsxFile from 'read-excel-file/node'
import type * as SavReaderModule from 'sav-reader'
import type { Crosstab } from '../../src/core/features/reporting'
import type { Ledger, LedgerResponse } from '../../src/core/app/api'
import { collectDisclosureScenario } from '../disclosure-scenario'
import type { ScenarioCall } from '../results-scenario'
import { csvRows, downloadedBytes } from './export-helpers'
import { openFilters, clearResponseFilters } from './filter-helpers'

const { SavBufferReader } = createRequire(import.meta.url)('sav-reader') as typeof SavReaderModule

/** An additional phase of the existing results journey, not another permanent test case. */
export async function operatorDisclosureExposure(page: Page, call: ScenarioCall, slug: string, capture: (name: string) => Promise<void>) {
  const scenario = await collectDisclosureScenario(call, slug)
  await page.goto(`/app/flows/${scenario.flow.id}/results`)
  await page.getByLabel('Published revision').selectOption(scenario.revisionId)
  const plan = page.getByRole('region', { name: 'Answers', exact: true }).locator('article').filter({ has: page.getByRole('heading', { name: 'Plan', exact: true }) })
  await expect(plan.getByText('43 answers', { exact: true })).toBeVisible()
  await expect(plan.locator('.answer-bucket').filter({ hasText: 'Scale' })).toContainText('8 of 43 answers')
  await expect(page.locator('.metric-card').filter({ has: page.getByText('Responses', { exact: true }) }).locator('strong')).toHaveText('43')
  const cross = page.locator('section.crosstab')
  await cross.getByRole('combobox', { name: 'Rows', exact: true }).selectOption({ label: 'Plan' })
  await cross.getByRole('combobox', { name: 'Columns', exact: true }).selectOption({ label: 'Renewal' })
  const response = page.waitForResponse(value => new URL(value.url()).pathname === scenario.path + '/crosstab')
  await cross.getByRole('button', { name: 'Cross', exact: true }).click()
  const table = await (await response).json() as Crosstab
  expect(table.revision.id).toBe(scenario.revisionId)
  expect(table.filter).toEqual({ revisionId: scenario.revisionId })
  await expect(cross.getByRole('columnheader')).toHaveText(['Plan', 'Renew', 'Churn', 'Row total'])
  const scale = cross.getByRole('row', { name: /^Scale/ }).getByRole('cell')
  await expect(scale.nth(0)).toHaveText('suppressed')
  await expect(scale.nth(1).locator('strong')).toHaveText('5')
  await expect(scale.nth(2)).toHaveText('withheld')
  await expect(cross.locator('.crosstab-notes')).toContainText('withheld figures can be derived from the answer summaries')
  await expect(cross.locator('.crosstab-notes')).toContainText('ledger and exports, which stay complete for operators')
  await expect(cross.locator('.crosstab-notes')).toContainText('no non-reconstruction guarantee beyond this table')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await capture('operator-exposure')

  // LEDG-003 supports one structured answer plus search; Scale occurs only as this plan's published label.
  const ledger = page.getByRole('region', { name: 'Response ledger', exact: true })
  await openFilters(ledger)
  await ledger.getByRole('combobox', { name: 'Question, hidden field or calculation', exact: true }).selectOption(scenario.renewalId)
  await ledger.getByLabel('Answer contains / equals').selectOption({ label: 'Renew' })
  await ledger.getByRole('searchbox', { name: 'Search responses', exact: true }).fill('Scale')
  const selection = page.waitForResponse(value => {
    const url = new URL(value.url())
    return url.pathname === scenario.path + '/ledger' && url.searchParams.get('search') === 'Scale' && url.searchParams.get('answerValue') === scenario.renewId
  })
  await ledger.getByRole('searchbox', { name: 'Search responses', exact: true }).press('Enter')
  const selected = await (await selection).json() as Ledger
  expect(selected.total).toBe(3)
  expect(selected.responses.map(row => row.id).sort()).toEqual([...scenario.exposedIds].sort())
  await expect(ledger.getByText('3 matching completed responses', { exact: false })).toBeVisible()
  await expect(ledger.getByRole('button', { name: 'View answers', exact: true })).toHaveCount(3)
  for (const row of selected.responses) {
    expect(row.state).toBe('released'); expect(row.revisionId).toBe(scenario.revisionId)
    expect(row.completedAt <= table.cutoff && row.releasedAt! <= table.cutoff).toBe(true)
    expect(row.answers.find(answer => answer.stepId === scenario.planId)?.value).toBe(scenario.scaleId)
    expect(row.answers.find(answer => answer.stepId === scenario.renewalId)?.value).toBe(scenario.renewId)
  }
  for (const button of await ledger.getByRole('button', { name: 'View answers', exact: true }).all()) {
    await button.click()
    await expect(ledger.locator('.ledger-row--open .ledger-answer dd')).toHaveText(['Scale', 'Renew'])
    await button.click()
  }
  const download = async (name: string) => {
    const pending = page.waitForEvent('download')
    await ledger.getByRole('button', { name: `Export ${name}`, exact: true }).click()
    return downloadedBytes(await pending)
  }
  const json = JSON.parse((await download('JSON')).toString('utf8')) as { filter: unknown; responses: LedgerResponse[] }
  expect(json.filter).toMatchObject(scenario.filter)
  expect(json.responses).toEqual(selected.responses.map(row => ({ ...row, answers: row.answers.map(answer => ({ ...answer, value: answer.stepId === scenario.planId ? 'scale' : 'renew' })) })))
  const [header, ...csv] = csvRows((await download('CSV')).toString('utf8'))
  expect(csv).toHaveLength(3)
  expect(csv.map(row => row[header.indexOf('response_id')])).toEqual(selected.responses.map(row => row.id))
  for (const row of csv) expect(JSON.parse(row[header.indexOf('answers_json')])).toEqual(json.responses.find(item => item.id === row[0])!.answers)
  const workbook = await readXlsxFile(await download('XLSX'))
  expect(workbook[0].data[0]).toEqual(header)
  expect(workbook[0].data).toHaveLength(4)
  for (const [index, row] of workbook[0].data.slice(1).entries()) {
    expect(row.map(value => String(value ?? '')).filter((_, i) => header[i] !== 'cutoff')).toEqual(csv[index].filter((_, i) => header[i] !== 'cutoff'))
  }
  const reader = new SavBufferReader(await download('SPSS')); await reader.open()
  const sav = await reader.readAllRows(true)
  expect(sav.map(row => row.response_id)).toEqual(selected.responses.map(row => row.id))
  const [metadataHeader, ...metadata] = workbook[1].data
  for (const [stepId, choiceId] of [[scenario.planId, scenario.scaleId], [scenario.renewalId, scenario.renewId]]) {
    const entry = metadata.find(row => row[metadataHeader.indexOf('step_id')] === stepId && row[metadataHeader.indexOf('choice_id')] === choiceId)!
    for (const row of sav) expect(row[String(entry[metadataHeader.indexOf('sav_variable')])]).toBe(entry[metadataHeader.indexOf('sav_code')])
  }
  await capture('operator-exposure-ledger')
  await ledger.getByRole('button', { name: 'Remove Search filter', exact: true }).click()
  await ledger.getByRole('combobox', { name: 'Question, hidden field or calculation', exact: true }).selectOption('')
  await expect(ledger.getByText('43 matching completed responses', { exact: false })).toBeVisible()
  const raw = JSON.parse((await download('JSON')).toString('utf8')) as { responses: LedgerResponse[] }
  expect(raw.responses.map(row => row.id).sort()).toEqual([...scenario.receipts].sort())
}
