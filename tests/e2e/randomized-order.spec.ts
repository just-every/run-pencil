import type { Locator } from '@playwright/test'
import type { BuilderDraft, PublicFlow } from '../../src/core/app/api'
import type { PresentationOrder } from '../../src/core/shared/presentationOrder'
import { contract } from './contract'
import { expect, test } from './fixtures'
import { signInEmptyWorkspace } from './authoring-helpers'
import { csvRows } from './export-helpers'

type OrderRow = { id: string; presentedOrder: PresentationOrder }
async function visibleOrder(surface: Locator, draft: BuilderDraft): Promise<PresentationOrder> {
  const labels = await surface.locator('.screen-question h2').allTextContents()
  const choices = await surface.getByRole('listbox', { name: 'Which workshops interest you?', exact: true }).getByRole('option').allTextContents()
  const anchor = draft.steps[0].id
  expect([...labels].sort()).toEqual(draft.steps.slice(0, 3).map(step => step.prompt).sort())
  expect([...choices].sort()).toEqual(draft.choices.map(choice => choice.label).sort())
  expect(choices.slice(-2)).toEqual(['Other', 'None of the above'])
  return {
    choices: { [anchor]: choices.map(label => draft.choices.find(choice => choice.label === label)!.id) },
    blocks: { [anchor]: labels.map(label => draft.steps.find(step => step.prompt === label)!.id) },
  }
}

contract('FIELD-006', 'a workshop organiser randomizes a question group and choices, previews it and retains the respondent’s displayed order in results and exports', async ({ page }, info) => {
  test.setTimeout(120_000)
  page.setDefaultTimeout(15_000)
  await signInEmptyWorkspace(page)
  const call = async <T,>(path: string, method = 'GET', data?: unknown): Promise<T> => {
    const response = await page.request.fetch(path, { method, ...(data === undefined ? {} : { data }) })
    expect(response.status(), await response.text()).toBeLessThan(300)
    return response.json() as Promise<T>
  }
  await call('/api/app/brand', 'PUT', { name: 'Harbour Studio', supportingLine: 'Creative workshops by the water', accent: '#23433f', publicFlowSlug: null })
  const slug = `harbour-workshops-${info.project.name}-${Date.now()}`
  const flow = await call<{ id: string }>('/api/app/flows', 'POST', { title: 'Harbour Studio workshop planning', slug })
  const base = `/api/app/flows/${flow.id}`, read = () => call<BuilderDraft>(`${base}/draft`)
  for (const step of [
    { kind: 'question', questionType: 'multiple_choice', prompt: 'Which workshops interest you?', required: true,
      choices: [{ value: 'pottery', label: 'Evening pottery' }, { value: 'painting', label: 'Weekend painting' }, { value: 'printing', label: 'Printmaking' }] },
    { kind: 'question', questionType: 'short_text', prompt: 'What is your name?', required: true },
    { kind: 'question', questionType: 'yes_no', prompt: 'Would you join a weekend session?', required: true },
    { kind: 'question', questionType: 'long_text', prompt: 'What would make the workshop useful?', required: true },
    { kind: 'completion', questionType: null, prompt: 'Your workshop preferences are with us.' },
  ]) await call(`${base}/draft/steps`, 'POST', { expectedVersion: (await read()).flow.draftVersion, step })
  await page.goto(`/app/flows/${flow.id}/builder`)
  const settings = page.getByRole('complementary', { name: 'Step settings' })
  await settings.getByLabel('Allow Other write-in', { exact: true }).check()
  await settings.getByLabel('Allow None of the above', { exact: true }).check()
  await settings.getByLabel('Randomize choice order', { exact: false }).check()
  await settings.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('Saved.', { exact: true })).toBeVisible()
  await expect.poll(async () => (await read()).steps[0].questionSettings?.randomizeChoices).toBe(true)
  let draft = await read()
  await settings.getByText('Screen layout and visibility', { exact: true }).click()
  await settings.getByLabel('Layout', { exact: true }).selectOption('group')
  await settings.getByLabel('Screen title', { exact: true }).fill('Plan your studio visit')
  await settings.getByLabel('Screen description', { exact: true }).fill('Help Harbour Studio plan welcoming creative workshops.')
  await settings.getByLabel('Last included question', { exact: true }).selectOption(draft.steps[2].id)
  await settings.getByLabel('Randomize question order in this block', { exact: true }).check()
  await page.screenshot({ path: `test-results/${info.project.name}-randomized-builder-block.png`, fullPage: true })
  await settings.getByRole('button', { name: 'Save screen layout', exact: true }).click()
  await expect(page.getByText('Saved.', { exact: true })).toBeVisible()
  draft = await read()
  expect(draft.steps[0].questionSettings?.screen).toMatchObject({ kind: 'group', randomize: true, questionIds: draft.steps.slice(0, 3).map(step => step.id) })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: `test-results/${info.project.name}-randomized-builder.png`, fullPage: true })

  await page.getByRole('button', { name: 'Preview draft', exact: true }).click()
  const preview = page.getByRole('region', { name: 'Draft preview', exact: true })
  await expect(preview.getByRole('heading', { name: 'Plan your studio visit', exact: true })).toBeVisible()
  const previewOrder = await visibleOrder(preview, draft)
  await page.screenshot({ path: `test-results/${info.project.name}-randomized-preview.png`, fullPage: true })
  await preview.getByRole('option', { name: 'Evening pottery', exact: true }).click()
  await preview.getByRole('textbox', { name: 'What is your name?', exact: true }).fill('Jo West')
  await preview.getByRole('radio', { name: 'Yes', exact: true }).click()
  await preview.getByRole('button', { name: 'Continue preview', exact: true }).click()
  await expect(preview.getByRole('textbox', { name: 'What would make the workshop useful?', exact: true })).toBeVisible()
  await preview.getByRole('button', { name: 'Back in preview', exact: true }).click()
  expect(await visibleOrder(preview, draft)).toEqual(previewOrder)
  await preview.getByRole('button', { name: 'Close preview', exact: true }).click()
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Share this flow' })).toBeVisible()

  await page.goto(`/f/${slug}`)
  await expect(page.getByRole('heading', { name: 'Plan your studio visit', exact: true })).toBeVisible()
  const respondent = page.getByRole('article'), displayed = await visibleOrder(respondent, draft)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: `test-results/${info.project.name}-randomized-respondent.png`, fullPage: true })
  const started = page.waitForResponse(response => response.url().endsWith(`/api/public/flows/${slug}/sessions`) && response.request().method() === 'POST')
  await page.getByRole('option', { name: 'Evening pottery', exact: true }).click()
  const session = await (await started).json() as { flow: PublicFlow }
  expect(session.flow.presentation).toEqual(displayed)
  await page.getByRole('textbox', { name: 'What is your name?', exact: true }).fill('Jo West')
  await page.getByRole('radio', { name: 'Yes', exact: true }).click()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'What would make the workshop useful?', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  expect(await visibleOrder(respondent, draft)).toEqual(displayed)
  await expect(page.getByRole('textbox', { name: 'What is your name?', exact: true })).toHaveValue('Jo West')
  await expect(page.getByRole('option', { name: 'Evening pottery', exact: true })).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('textbox', { name: 'What would make the workshop useful?', exact: true }).fill('Small groups, accessible benches and materials included.')
  await page.waitForTimeout(3200)
  await page.getByRole('button', { name: 'Submit response', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your workshop preferences are with us.', exact: true })).toBeVisible()
  await page.screenshot({ path: `test-results/${info.project.name}-randomized-completed.png`, fullPage: true })
  const ledger = await call<{ total: number; responses: OrderRow[] }>(`${base}/ledger`)
  expect(ledger.total).toBe(1)
  expect(ledger.responses[0].presentedOrder).toEqual(displayed)
  const download = async (format: 'json' | 'csv') => {
    const start = await call<{ token: string; total: number }>(`${base}/responses/export/start`, 'POST', { format })
    expect(start.total).toBe(1)
    let token: string | undefined = start.token, text = ''
    while (token) {
      const response = await page.request.get(`${base}/responses/export?token=${encodeURIComponent(token)}`)
      expect(response.ok()).toBe(true)
      text += await response.text(); token = response.headers()['x-export-next']
    }
    return text
  }
  const exported = JSON.parse(await download('json')) as { responses: OrderRow[] }
  expect(exported.responses).toHaveLength(1)
  expect(exported.responses[0]).toMatchObject({ id: ledger.responses[0].id, presentedOrder: displayed })
  const [header, ...rows] = csvRows(await download('csv'))
  expect(rows).toHaveLength(1)
  expect(rows[0][header.indexOf('response_id')]).toBe(ledger.responses[0].id)
  expect(JSON.parse(rows[0][header.indexOf('presented_order_json')])).toEqual(displayed)
})
