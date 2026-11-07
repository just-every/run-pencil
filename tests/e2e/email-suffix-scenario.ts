import AxeBuilder from '@axe-core/playwright'
import type { Page, TestInfo } from '@playwright/test'
import type { BuilderDraft } from '../../src/core/app/api'
import { addConditionRule } from './authoring-helpers'
import { expect } from './fixtures'

export async function emailSuffixScenario(page: Page, info: TestInfo) {
  const slug = `email-path-${info.project.name}-${Date.now()}`
  const call = async <T,>(path: string, method = 'GET', data?: unknown) => {
    const response = await page.request.fetch(path, { method, ...(data === undefined ? {} : { data }) })
    expect(response.status(), await response.text()).toBeLessThan(300)
    return response.json() as Promise<T>
  }
  const flow = await call<{ id: string }>('/api/app/flows', 'POST', { title: 'Email consultation requests', slug })
  const base = `/api/app/flows/${flow.id}`
  const read = () => call<BuilderDraft>(`${base}/draft`)
  for (const step of [
    { kind: 'question', questionType: 'email', prompt: 'Your contact email', required: true },
    { kind: 'question', questionType: 'long_text', prompt: 'Tell us about your enquiry', required: false },
    { kind: 'completion', questionType: null, prompt: 'Gmail consultation received' },
    { kind: 'completion', questionType: null, prompt: 'General enquiry received' },
  ]) await call(`${base}/draft/steps`, 'POST', { expectedVersion: (await read()).flow.draftVersion, step })
  const draft = await read(), [email, message, matching, ordinary] = draft.steps
  await call(`${base}/draft`, 'PUT', { expectedVersion: draft.flow.draftVersion, stepId: message.id, prompt: message.prompt, required: false, nextStepId: ordinary.id })
  await page.goto(`/app/flows/${flow.id}/builder`)
  const selectMessage = async () => {
    await page.getByRole('complementary', { name: 'Flow steps' }).getByRole('button', { name: /Tell us about your enquiry/ }).click()
    const paths = page.getByRole('complementary', { name: 'Step settings' }).getByRole('button', { name: 'Answer paths', exact: true })
    if (await paths.count()) await paths.click()
  }
  await selectMessage()
  const editor = page.getByRole('complementary', { name: 'Step settings' })
  await addConditionRule(editor)
  const rule = editor.getByRole('group', { name: 'Rule 1', exact: true })
  const root = rule.getByRole('group', { name: 'Condition group', exact: true }).first()
  await root.getByLabel('Question', { exact: true }).selectOption(email.id)
  await root.getByLabel('Condition', { exact: true }).selectOption('ends_with')
  await root.getByLabel('Value', { exact: true }).fill(' GMAIL.COM ')
  await rule.getByLabel('Then go to', { exact: true }).selectOption(matching.id)
  await editor.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('Saved.', { exact: true })).toBeVisible()
  await page.reload()
  await selectMessage()
  await expect(root.getByLabel('Question', { exact: true })).toHaveValue(email.id)
  await expect(root.getByLabel('Condition', { exact: true })).toHaveValue('ends_with')
  await expect(root.getByLabel('Value', { exact: true })).toHaveValue(' GMAIL.COM ')
  await expect(rule).toContainText('Your contact email ends with')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([])
  await page.screenshot({ path: `test-results/${info.project.name}-email-suffix-builder.png`, fullPage: true })

  const paths = [
    { address: ['synthetic-pencil-1', 'GMAIL.COM'].join('@'), matched: true, completion: 'Gmail consultation received' },
    { address: ['synthetic-pencil-2', 'gmail.co'].join('@'), matched: false, completion: 'General enquiry received' },
  ]
  for (const [index, path] of paths.entries()) {
    await page.getByRole('button', { name: 'Preview draft', exact: true }).click()
    const preview = page.getByRole('region', { name: 'Draft preview', exact: true })
    await preview.getByRole('textbox', { name: 'Your contact email', exact: true }).fill(path.address)
    await preview.getByRole('button', { name: 'Continue preview', exact: true }).click()
    await preview.getByRole('button', { name: 'Inspect answer path', exact: true }).click()
    const trace = page.getByRole('region', { name: 'Preview rule evaluations' })
    await expect(trace).toContainText(`Your contact email: ${path.address} · ends with → ${path.matched}`)
    await expect(trace).toContainText(path.matched ? 'First matching rule → Gmail consultation received' : 'Default path → General enquiry received')
    await preview.getByRole('button', { name: 'Continue preview', exact: true }).click()
    await expect(preview.getByRole('heading', { name: path.completion, exact: true })).toBeVisible()
    await page.screenshot({ path: `test-results/${info.project.name}-email-suffix-preview-${index}.png`, fullPage: true })
    await preview.getByRole('button', { name: 'Close preview', exact: true }).click()
  }
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Share this flow' })).toBeVisible()
  for (const [index, path] of paths.entries()) {
    await page.goto(`/f/${slug}`)
    await page.getByRole('textbox', { name: 'Your contact email', exact: true }).fill(path.address)
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await page.getByRole('textbox', { name: 'Tell us about your enquiry', exact: true }).fill('Please send consultation details.')
    await page.waitForTimeout(3200)
    await page.getByRole('button', { name: 'Submit response', exact: true }).click()
    await expect(page.getByRole('heading', { name: path.completion, exact: true })).toBeVisible()
    await page.screenshot({ path: `test-results/${info.project.name}-email-suffix-completed-${index}.png`, fullPage: true })
  }
  expect((await call<{ total: number }>(`${base}/ledger`)).total).toBe(2)
}
