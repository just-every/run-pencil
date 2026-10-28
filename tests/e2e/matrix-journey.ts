import type { Page, TestInfo } from '@playwright/test'
import { expect } from './fixtures'
import { csvRows, downloadedText } from './export-helpers'
import type { BuilderDraft, Ledger } from '../../src/core/app/api'

export async function matrixJourney(page: Page, info: TestInfo) {
  const origin = new URL(info.project.use.baseURL!).origin
  const call = async <T,>(path: string, data?: unknown, method = data === undefined ? 'GET' : 'POST'): Promise<T> => {
    const response = await page.request.fetch(path, { method, headers: { Origin: origin }, ...(data === undefined ? {} : { data }) })
    expect(response.ok(), await response.text()).toBe(true)
    return response.json() as Promise<T>
  }
  const screenshot = async (state: string) => {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const path = info.outputPath(`matrix-${state}-${info.project.name}.png`)
    await page.screenshot({ path, fullPage: true }); await info.attach(`Matrix ${state}`, { path, contentType: 'image/png' })
  }
  const slug = `matrix-${info.project.name}-${Date.now()}`, flow = await call<{ id: string }>('/api/app/flows', { title: 'Service experience', slug })
  const root = `/api/app/flows/${flow.id}`, read = () => call<BuilderDraft>(root + '/draft')
  const rows = ['Clarity', 'Speed', 'Quality', 'Support'].map((label, index) => ({ id: `synthetic-pencil-${index + 1}`, label }))
  const labels = ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree']
  for (const step of [
    { kind: 'question', questionType: 'matrix', prompt: 'Rate your experience', required: true, questionSettings: { matrixRows: rows, matrixMode: 'likert5' }, choices: labels.map((label, index) => ({ value: String(index + 1), label })) },
    { kind: 'completion', questionType: null, prompt: 'Thank you for your feedback' },
    { kind: 'completion', questionType: null, prompt: 'We will follow up' },
  ]) await call(root + '/draft/steps', { expectedVersion: (await read()).flow.draftVersion, step })
  let draft = await read()
  const [matrix, normal, follow] = draft.steps, choices = draft.choices.filter(choice => choice.stepId === matrix.id)
  await call(root + '/draft/branches', { expectedVersion: draft.flow.draftVersion, rules: [{ sourceStepId: matrix.id, predicateKind: 'equals', expectedValue: choices[0].id, condition: { kind: 'test', stepId: matrix.id, rowId: rows[0].id, operator: 'equals', value: choices[0].id }, destinationStepId: follow.id, position: 0 }] }, 'PUT')
  await page.goto(`/app/flows/${flow.id}/builder`)
  await expect(page.locator('.operator-shell[data-hydrated=true]')).toBeVisible()
  await page.locator('.step-button').first().click()
  await expect(page.getByLabel('Shared scale', { exact: true })).toHaveValue('likert5')
  await expect(page.getByLabel('Row', { exact: true })).toHaveValue(rows[0].id)
  await page.getByLabel('Row 1', { exact: true }).fill('Clarity of instructions')
  await page.getByRole('button', { name: 'Move row 2 up', exact: true }).click()
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByLabel('Row 1', { exact: true })).toHaveValue('Speed')
  draft = await read()
  expect((draft.steps[0].questionSettings!.matrixRows as typeof rows).map(row => row.id)).toEqual([rows[1].id, rows[0].id, rows[2].id, rows[3].id])
  const move = page.getByRole('button', { name: 'Move down', exact: true })
  await move.focus()
  await expect(page.locator('[role=tooltip]').filter({ hasText: /^Move down$/ })).toBeVisible()
  expect(await page.locator('.matrix-input').evaluate(element => [...element.querySelectorAll('legend, label')].every(node => parseFloat(getComputedStyle(node).fontSize) >= 13))).toBe(true)
  await screenshot('builder')
  await call(root + '/publish', { expectedVersion: draft.flow.draftVersion })
  for (const [index, first] of [0, 4].entries()) {
    await page.goto(`/f/${slug}`)
    await expect(page.getByRole('heading', { name: matrix.prompt, exact: true })).toBeVisible()
    const submit = page.getByRole('button', { name: 'Submit response', exact: true })
    await submit.click(); await expect(page.getByRole('alert')).toContainText(matrix.prompt)
    for (const [rowIndex, row] of rows.entries()) {
      const label = row.id === rows[0].id ? 'Clarity of instructions' : row.label
      const group = page.getByRole('radiogroup', { name: label, exact: true })
      const option = group.getByRole('radio', { name: labels[rowIndex === 0 ? first : 2], exact: true })
      await option.focus(); await page.keyboard.press('Space'); await expect(option).toBeChecked()
    }
    await screenshot(`answer-${index + 1}`)
    await page.waitForTimeout(3200)
    await submit.click()
    await expect(page.getByRole('heading', { name: index === 0 ? follow.prompt : normal.prompt, exact: true })).toBeVisible()
    await screenshot(`complete-${index + 1}`)
  }
  await page.goto(`/app/flows/${flow.id}/results`)
  const answers = page.getByRole('region', { name: 'Answers', exact: true })
  const clarity = answers.getByRole('region', { name: 'Clarity of instructions', exact: true })
  await expect(clarity).toContainText('2 answers to this row')
  await expect(clarity.getByText('1 of 2 answers · 50%', { exact: true })).toHaveCount(2)
  const cross = page.getByRole('region', { name: 'Cross two answers', exact: true })
  await cross.getByLabel('Rows', { exact: true }).selectOption(`matrix:${matrix.id}:${rows[0].id}`)
  await cross.getByLabel('Columns', { exact: true }).selectOption(`matrix:${matrix.id}:${rows[1].id}`)
  await cross.getByRole('button', { name: 'Cross', exact: true }).click()
  await expect(cross.getByRole('region', { name: 'Crosstab table', exact: true })).toContainText('suppressed')
  await screenshot('results')
  const ledger = page.getByRole('region', { name: 'Response ledger', exact: true })
  await ledger.getByRole('button', { name: 'View answers', exact: true }).first().click()
  await expect(ledger).toContainText('Clarity of instructions: Strongly agree')
  const download = page.waitForEvent('download')
  await ledger.getByRole('button', { name: 'Export CSV', exact: true }).click()
  const [head, ...records] = csvRows(await downloadedText(await download))
  for (const row of rows) expect(head).toContain(`${matrix.id}.${row.id}`)
  expect(records).toHaveLength(2)
  expect(records.map(record => record[head.indexOf(`${matrix.id}.${rows[0].id}`)]).sort()).toEqual([choices[0].id, choices[4].id].sort())
  const retained = await call<Ledger>(root + '/ledger')
  expect(retained.total).toBe(2)
  await screenshot('ledger')
}
