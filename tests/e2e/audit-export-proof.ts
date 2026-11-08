import type { Page, TestInfo } from '@playwright/test'
import { expect } from './fixtures'
import { appHeaders } from './api-headers'
import { csvRows, downloadedText } from './export-helpers'
import { openFilters } from './filter-helpers'
import type { Operator } from '../../src/core/app/api'
import type { AuditPage } from '../../src/core/features/audit/model'

/** Follow one real response download into its displayed audit event and CSV. */
export async function proveResponseExportAudit(page: Page, info: TestInfo, input: {
  flowId: string
  formName: string
  revisionId: string
  actorEmail: string
  responseIds: string[]
  privateValues: string[]
}) {
  const query = new URLSearchParams({ flowId: input.flowId, kind: 'export.created' })
  const before = await page.request.get(`/api/app/audit?${query}`, { headers: appHeaders })
  expect(before.status()).toBe(200)
  expect((await before.json() as AuditPage).rows).toEqual([])
  const operators = await page.request.get('/api/app/operators', { headers: appHeaders })
  expect(operators.status()).toBe(200)
  const actor = (await operators.json() as Operator[]).find(operator => operator.email === input.actorEmail)!
  expect(actor).toBeDefined()

  const resultsUrl = `/app/flows/${input.flowId}/results`
  await page.goto(resultsUrl)
  await page.getByLabel('Published revision').selectOption(input.revisionId)
  const ledger = page.getByRole('region', { name: 'Response ledger' })
  await expect(ledger.getByRole('button', { name: 'View answers', exact: true })).toHaveCount(2)
  const responseDownload = page.waitForEvent('download')
  await ledger.getByRole('button', { name: 'Export CSV', exact: true }).click()
  const responseCsv = await downloadedText(await responseDownload)
  const [responseHeader, ...responseRows] = csvRows(responseCsv.trimEnd())
  for (const privateValue of input.privateValues) expect(responseRows.map(row => row[responseHeader.indexOf('answers_json')]).join()).toContain(JSON.stringify(privateValue).slice(1, -1))
  expect(responseRows.map(row => row[responseHeader.indexOf('response_id')]).sort()).toEqual([...input.responseIds].sort())

  await page.goto('/app/audit')
  const viewer = page.locator('.audit-viewer')
  await expect(viewer.getByRole('heading', { name: 'Audit log', exact: true })).toBeVisible()
  await openFilters(viewer)
  await viewer.getByLabel('Form', { exact: true }).selectOption(input.flowId)
  const filtered = page.waitForResponse(response => {
    const url = new URL(response.url())
    return url.pathname === '/api/app/audit' && url.searchParams.get('flowId') === input.flowId && url.searchParams.get('kind') === 'export.created'
  })
  await viewer.getByLabel('Activity', { exact: true }).selectOption('export.created')
  const auditResponse = await filtered
  expect(auditResponse.status()).toBe(200)
  const audit = await auditResponse.json() as AuditPage
  expect(audit.rows).toHaveLength(1)
  const [event] = audit.rows
  expect(event).toMatchObject({ kind: 'export.created', actor: { id: actor.id, name: actor.displayName }, form: { id: input.flowId, name: input.formName }, details: { export: 'responses' } })
  expect(event.details).toEqual({ export: 'responses' })
  const recorded = viewer.getByRole('region', { name: 'Recorded activity' })
  const row = recorded.locator('tbody tr')
  await expect(row).toHaveCount(1)
  for (const [label, value] of [['Actor', actor.displayName], ['Form', input.formName], ['Activity', 'Export created'], ['Details', 'export: responses']]) {
    await expect(row.locator(`td[data-label="${label}"]`)).toHaveText(value)
    await expect(row.locator(`td[data-label="${label}"]`)).toBeVisible()
  }
  for (const filter of ['Form', 'Activity']) {
    const remove = viewer.getByRole('button', { name: `Remove ${filter} filter`, exact: true })
    await remove.focus()
    await expect(viewer.getByRole('tooltip', { name: `Remove ${filter} filter`, exact: true })).toBeVisible()
    await remove.blur()
  }
  const auditDownload = page.waitForEvent('download')
  await viewer.getByRole('link', { name: 'Export CSV', exact: true }).click()
  const file = await auditDownload
  expect(file.suggestedFilename()).toBe('pencil-audit.csv')
  const csv = await downloadedText(file)
  const [header, ...rows] = csvRows(csv.trimEnd())
  expect(rows).toHaveLength(1)
  const exported = Object.fromEntries(header.map((name, index) => [name, rows[0][index]]))
  expect(exported).toEqual({ event_id: event.id, created_at: event.createdAt, event_kind: 'export.created', actor_id: actor.id, actor_name: actor.displayName, form_id: input.flowId, form_name: input.formName, details: JSON.stringify({ export: 'responses' }) })
  for (const privateValue of [input.actorEmail, ...input.responseIds, ...input.privateValues]) {
    expect(await recorded.innerText()).not.toContain(privateValue)
    expect(csv).not.toContain(privateValue)
    expect(JSON.stringify(audit)).not.toContain(privateValue)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath(`audit-response-export-${info.project.name}.png`), fullPage: true })
  await page.goto(resultsUrl)
}
