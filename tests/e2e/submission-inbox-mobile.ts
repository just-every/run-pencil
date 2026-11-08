import type { Locator, Page, TestInfo } from '@playwright/test'
import type { BuilderDraft, Ledger } from '../../src/core/app/api'
import type { AuditPage } from '../../src/core/features/audit/model'
import type { SubmissionDetail, SubmissionOptions } from '../../src/core/features/submissions/model'
import type { ScenarioCall } from '../results-scenario'
import { expect } from './fixtures'
import { openFilters } from './filter-helpers'
import { captureSubmissionInbox } from './submission-inbox-journey'

/** A separate form and two native completions, independent of the search workload. */
async function collectMobileInbox(call: ScenarioCall, slug: string) {
  const flow = await call<{ id: string }>('/api/app/flows', { title: 'Phone inbox review', slug })
  const root = `/api/app/flows/${flow.id}`
  const draft = () => call<BuilderDraft>(root + '/draft')
  for (const step of [
    { kind: 'question', questionType: 'long_text', prompt: 'What should the team review?', required: true },
    { kind: 'completion', questionType: null, prompt: 'Your feedback is recorded.' },
  ]) await call(root + '/draft/steps', { expectedVersion: (await draft()).flow.draftVersion, step })
  const current = await draft()
  await call(root + '/publish', { expectedVersion: current.flow.draftVersion })
  const answers = ['The pickup counter needs clearer signs.', 'The seating area was comfortable.']
  const responses: string[] = []
  for (const answer of answers) {
    const session = await call<{ sessionId: string; sessionToken: string }>(`/api/public/flows/${slug}/sessions`, { deviceClass: 'mobile', source: 'direct' })
    const receipt = await call<{ responseId: string; disposition: string }>(`/api/public/flows/${slug}/responses`, {
      ...session, idempotencyKey: `synthetic-pencil-${session.sessionId}`, answers: [{ stepId: current.steps[0].id, value: answer }],
    })
    if (receipt.disposition === 'quarantined') await call(`/api/app/responses/${receipt.responseId}/release`, {})
    responses.push(receipt.responseId)
  }
  return { flowId: flow.id, root, answers, responses }
}

/** Run only the added phone leg at 360, then restore the existing mobile project. */
export async function reviewMobileSubmissionInbox(page: Page, info: TestInfo, call: ScenarioCall) {
  const scenario = await collectMobileInbox(call, `synthetic-pencil-${info.project.name}-${Date.now()}`)
  const session = await call<{ operator: { id: string } }>('/auth/session')
  const viewport = page.viewportSize()!
  const measurements: Array<{ control: string; width: number; height: number }> = []
  const hit = async (control: Locator, name: string) => {
    await expect(control).toBeVisible()
    await control.scrollIntoViewIfNeeded()
    const box = await control.boundingBox()
    expect(box, name).not.toBeNull()
    expect(box!.width, `${name} width`).toBeGreaterThanOrEqual(44)
    expect(box!.height, `${name} height`).toBeGreaterThanOrEqual(44)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), name).toBe(true)
    measurements.push({ control: name, width: box!.width, height: box!.height })
  }
  try {
    await page.setViewportSize({ width: 360, height: 844 })
    expect(await page.evaluate(() => innerWidth)).toBe(360)
    await page.goto(`/app/flows/${scenario.flowId}/inbox`)
    const inbox = page.getByRole('region', { name: 'Submission inbox', exact: true })
    const row = inbox.locator('tbody tr').filter({ hasText: scenario.answers[0] })
    const other = inbox.locator('tbody tr').filter({ hasText: scenario.answers[1] })
    const detail = page.locator('#submission-detail')
    const selection = row.locator('label.selection-hit')
    const open = row.getByRole('button', { name: /^Open / })
    const apply = inbox.getByRole('button', { name: 'Apply changes', exact: true })
    const options = await call<SubmissionOptions>(scenario.root + '/submissions/options')
    const assignee = options.operators[0]
    const tag = 'synthetic-pencil-360'
    const note = 'Private team review: replace the pickup sign before the next shift.'
    await expect(inbox.locator('tbody tr')).toHaveCount(2)
    await expect(other).toBeVisible()
    await captureSubmissionInbox(page, info, 'submission-inbox-360-initial')
    // The label is the effective checkbox target; its small glyph is deliberate.
    await hit(selection, 'Select submission label')
    await selection.click({ position: { x: 30, y: 22 } })
    await expect(row.getByRole('checkbox')).toBeChecked()
    const assign = inbox.getByRole('combobox', { name: 'Assign', exact: true })
    const addTag = inbox.getByLabel('Add tag', { exact: true })
    await hit(assign, 'Assign'); await assign.selectOption(assignee.id)
    await hit(addTag, 'Add tag'); await addTag.fill(tag)
    await captureSubmissionInbox(page, info, 'submission-inbox-360-bulk')
    await hit(apply, 'Apply assignment and tag'); await apply.click()
    await expect(row).toContainText(assignee.displayName)
    await expect(row.locator('.tag')).toHaveText(tag)
    await hit(open, 'Open submission')
    await open.focus(); await expect(row.getByRole('tooltip')).toHaveText('Open submission')
    await open.click()
    await expect(detail.locator('.answer')).toHaveText(scenario.answers[0])
    const noteEntry = detail.getByLabel('Add a note', { exact: true })
    const addNote = detail.getByRole('button', { name: 'Add note', exact: true })
    await hit(noteEntry, 'Private note'); await noteEntry.fill(note)
    await hit(addNote, 'Add note'); await addNote.click()
    await expect(detail.locator('.history .note')).toContainText(note)
    await expect(detail).toContainText('Private to your team')
    await captureSubmissionInbox(page, info, 'submission-inbox-360-note')
    await hit(selection, 'Select submission label for status'); await selection.click({ position: { x: 30, y: 22 } })
    await expect(row.getByRole('checkbox')).toBeChecked()
    const status = inbox.getByRole('combobox', { name: 'Set status', exact: true })
    await hit(status, 'Set status'); await status.selectOption('done')
    await hit(apply, 'Apply Done status'); await apply.click()
    await expect(row.locator('.workflow-badge')).toHaveText('Done')
    await hit(inbox.getByRole('button', { name: 'Filter', exact: true }), 'Filter')
    await openFilters(inbox)
    const filter = inbox.getByRole('combobox', { name: 'Workflow status', exact: true })
    await hit(filter, 'Workflow status filter'); await filter.selectOption('done')
    await expect(inbox.locator('tbody tr')).toHaveCount(1)
    await expect(other).toHaveCount(0)
    await open.click()
    await expect(detail.locator('.workflow-badge')).toHaveText('Done')
    await expect(detail.locator('.history .note')).toContainText(note)
    await captureSubmissionInbox(page, info, 'submission-inbox-360-filtered')
    await page.reload()
    await expect(inbox.locator('tbody tr')).toHaveCount(2)
    await open.click()
    await expect(detail.locator('.workflow-badge')).toHaveText('Done')
    await expect(detail.locator('.tags .tag')).toHaveText(tag)
    await expect(detail).toContainText(`Assigned to ${assignee.displayName}.`)
    await expect(detail.locator('.history .note')).toContainText(note)
    await expect(other.locator('.tag, .workflow-badge')).toHaveCount(0)
    await captureSubmissionInbox(page, info, 'submission-inbox-360-reloaded')
    const saved = await call<SubmissionDetail>(`${scenario.root}/submissions/${scenario.responses[0]}`)
    expect(saved.submission).toMatchObject({ responseId: scenario.responses[0], statusId: 'done', assignee: { id: assignee.id }, tags: [tag], noteCount: 1 })
    expect(saved.notes.map(entry => entry.text)).toEqual([note])
    expect(saved.notes[0].author?.id).toBe(session.operator.id)
    const untouched = await call<SubmissionDetail>(`${scenario.root}/submissions/${scenario.responses[1]}`)
    expect(untouched.submission).toMatchObject({ statusId: 'new', assignee: null, tags: [], noteCount: 0 })
    const ledger = await call<Ledger>(scenario.root + '/ledger?workflowStatus=done')
    expect(ledger.responses.map(response => response.id)).toEqual([scenario.responses[0]])
    expect(ledger.responses[0].answers.map(answer => answer.displayValue)).toEqual([scenario.answers[0]])
    expect(JSON.stringify(ledger)).not.toContain(note)
    const audit = await call<AuditPage>(`/api/app/audit?flowId=${scenario.flowId}&limit=100`)
    const changes = audit.rows.filter(entry => entry.kind.startsWith('submission.'))
    expect(changes.map(entry => entry.kind).sort()).toEqual([
      'submission.assignment_changed', 'submission.note_added', 'submission.status_changed', 'submission.tags_changed',
    ])
    for (const entry of changes) expect(entry).toMatchObject({ actor: { id: session.operator.id }, form: { id: scenario.flowId }, details: { fields: 1 } })
    expect(JSON.stringify(audit)).not.toContain(note)
    await info.attach('360 pixel hit areas', { body: JSON.stringify(measurements, null, 2), contentType: 'application/json' })
  } finally {
    await page.setViewportSize(viewport)
  }
  expect(page.viewportSize()).toEqual(viewport)
}
