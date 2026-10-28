import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { Page, TestInfo } from '@playwright/test'
import type { Ledger } from '../../src/core/app/api'
import type { SubmissionOptions } from '../../src/core/features/submissions/model'
import type { ScenarioCall } from '../results-scenario'
import { expect } from './fixtures'

/** Continue the response search journey through the team's real triage screens. */
export async function triageSubmission(page: Page, info: TestInfo, call: ScenarioCall, flowId: string, responseId: string) {
  const root = `/api/app/flows/${flowId}`
  const options = await call<SubmissionOptions>(root + '/submissions/options')
  const assignee = options.operators[0]
  const tag = 'synthetic-pencil-1'
  const note = 'Ask the morning shift to review the queue before Friday.'
  await page.getByRole('link', { name: 'Submission inbox', exact: true }).click()
  const inbox = page.getByRole('region', { name: 'Submission inbox', exact: true })
  const row = inbox.locator('tbody tr').filter({ hasText: 'The queue moved slowly.' })
  await expect(row).toHaveCount(1)
  await row.getByRole('checkbox').check()
  await inbox.getByRole('combobox', { name: 'Assign', exact: true }).selectOption(assignee.id)
  await inbox.getByLabel('Add tag', { exact: true }).fill(tag)
  await inbox.getByRole('button', { name: 'Apply changes', exact: true }).click()
  await expect(row).toContainText(assignee.displayName)
  await expect(row.locator('.tag')).toHaveText(tag)
  const open = row.getByRole('button', { name: /^Open / })
  await open.focus()
  await expect(row.getByRole('tooltip')).toBeVisible()
  await open.click()
  const detail = page.locator('#submission-detail')
  await detail.getByLabel('Add a note', { exact: true }).fill(note)
  await detail.getByRole('button', { name: 'Add note', exact: true }).click()
  await expect(detail.locator('.history .note')).toContainText(note)
  await expect(detail).toContainText(`Assigned to ${assignee.displayName}.`)
  await expect(detail.locator('.tags .tag')).toHaveText(tag)
  await row.getByRole('checkbox').check()
  await inbox.getByRole('combobox', { name: 'Set status', exact: true }).selectOption('done')
  await inbox.getByRole('button', { name: 'Apply changes', exact: true }).click()
  await expect(row.locator('.workflow-badge')).toHaveText('Done')
  await inbox.getByRole('combobox', { name: 'Workflow status', exact: true }).selectOption('done')
  await inbox.getByRole('button', { name: 'Apply filters', exact: true }).click()
  await expect(inbox.locator('tbody tr')).toHaveCount(1)
  await row.getByRole('button', { name: /^Open / }).click()
  await expect(detail.locator('.history .note')).toContainText(note)
  await expect(detail.locator('.workflow-badge')).toHaveText('Done')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const smallText = await inbox.locator('p, th, td, label, button, select, input, textarea, .tag, .workflow-badge, time, .privacy').evaluateAll(elements => elements.filter(element => {
    const style = getComputedStyle(element)
    return element.getClientRects().length && style.visibility !== 'hidden' && parseFloat(style.fontSize) < 13
  }).map(element => element.tagName))
  expect(smallText).toEqual([])
  const screenshot = info.outputPath('submission-inbox.png')
  await mkdir(dirname(screenshot), { recursive: true })
  await page.screenshot({ path: screenshot, fullPage: true, scale: 'css' })
  await info.attach('Submission inbox', { path: screenshot, contentType: 'image/png' })
  await page.reload()
  await expect(inbox.locator('tbody tr')).toHaveCount(4)
  await row.getByRole('button', { name: /^Open / }).click()
  await expect(detail.locator('.history .note')).toContainText(note)
  await expect(detail.locator('.tags .tag')).toHaveText(tag)
  await expect(detail).toContainText(`Assigned to ${assignee.displayName}.`)
  await expect(detail.locator('.workflow-badge')).toHaveText('Done')
  await inbox.getByRole('link', { name: 'Back to form results', exact: false }).click()
  const ledger = page.getByRole('region', { name: 'Response ledger' })
  const allRevisions = page.waitForResponse(response => {
    const url = new URL(response.url())
    return url.pathname === root + '/results' && url.searchParams.get('allRevisions') === 'true'
  })
  await page.getByLabel('Published revision').selectOption('all')
  expect((await allRevisions).ok()).toBe(true)
  await expect(page.locator('section.results')).toHaveAttribute('aria-busy', 'false')
  await ledger.getByRole('combobox', { name: 'Workflow status', exact: true }).selectOption('done')
  await expect(ledger.getByRole('button', { name: 'View answers', exact: true })).toHaveCount(1)
  await ledger.getByRole('button', { name: 'View answers', exact: true }).click()
  await expect(ledger.locator('.ledger-answer')).toContainText(['The queue moved slowly.'])
  const selected = await call<Ledger>(root + '/ledger?workflowStatus=done')
  expect(selected.responses.map(response => response.id)).toEqual([responseId])
  type AuditRow = { kind: string; actor: { id: string } | null; form: { id: string } | null }
  const audit = await call<{ rows: AuditRow[] }>(`/api/app/audit?flowId=${flowId}&limit=100`)
  for (const kind of ['submission.assignment_changed', 'submission.tags_changed', 'submission.note_added', 'submission.status_changed']) {
    expect(audit.rows).toContainEqual(expect.objectContaining({ kind, actor: expect.objectContaining({ id: expect.any(String) }), form: expect.objectContaining({ id: flowId }) }))
  }
  expect(JSON.stringify(audit)).not.toContain(note)
}
