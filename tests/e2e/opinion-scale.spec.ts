import { contract } from './contract'
import { expect } from './fixtures'
import { signInEmptyWorkspace } from './authoring-helpers'
import { csvRows, downloadedText } from './export-helpers'
import type { BuilderDraft, Ledger } from '../../src/core/app/api'

contract('FIELD-016', 'a labeled 0–6 opinion scale records 0, keeps it in the ledger and CSV and routes by less than 2', async ({ page }, info) => {
  const origin = new URL(info.project.use.baseURL!).origin
  await signInEmptyWorkspace(page)
  const call = async <T,>(path: string, data?: unknown, method = 'POST') => {
    const response = await page.request.fetch(path, { method: data === undefined ? 'GET' : method, headers: { Origin: origin }, ...(data === undefined ? {} : { data }) })
    expect(response.status(), await response.text()).toBeLessThan(300)
    return response.json() as Promise<T>
  }
  const screenshot = async (state: string) => {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const path = info.outputPath(`opinion-scale-${state}-${info.project.name}.png`)
    await page.screenshot({ path, fullPage: true })
    await info.attach(`Opinion scale ${state} · ${info.project.name}`, { path, contentType: 'image/png' })
  }
  const slug = `opinion-scale-${info.project.name}-${Date.now()}`
  const flow = await call<{ id: string }>('/api/app/flows', { title: 'Service check-in', slug })
  const base = `/api/app/flows/${flow.id}`
  const read = () => call<BuilderDraft>(`${base}/draft`)
  for (const step of [
    { kind: 'question', questionType: 'rating', prompt: 'How satisfied are you with our service?', required: true, questionSettings: { min: 0, max: 6, lowLabel: 'Not at all', middleLabel: 'Neutral', highLabel: 'Completely' } },
    { kind: 'completion', questionType: null, prompt: 'Thanks for rating us' },
    { kind: 'completion', questionType: null, prompt: 'We will follow up with you' },
  ]) await call(`${base}/draft/steps`, { expectedVersion: (await read()).flow.draftVersion, step })
  const [scale, , followUp] = (await read()).steps
  await call(`${base}/draft/branches`, { expectedVersion: (await read()).flow.draftVersion, rules: [
    { sourceStepId: scale.id, predicateKind: 'less_than', expectedValue: 2, destinationStepId: followUp.id, position: 0, condition: { kind: 'test', stepId: scale.id, operator: 'less_than', value: 2 } },
  ] }, 'PUT')
  await call(`${base}/publish`, { expectedVersion: (await read()).flow.draftVersion })

  await page.goto(`/f/${slug}`)
  const steps = page.getByRole('radiogroup', { name: `${scale.prompt} rating`, exact: true }).getByRole('radio')
  await expect(steps).toHaveCount(7)
  for (const [rating, name] of [[0, '0 out of 6, Not at all'], [3, '3 out of 6, Neutral'], [6, '6 out of 6, Completely']] as const) {
    await expect(steps.nth(rating)).toHaveAccessibleName(name)
  }
  await expect(steps.nth(1)).toHaveAccessibleName('1 out of 6')
  // Each label's rendered text sits over its step: start of 0, centre of 3, end of 6.
  const placement = await page.evaluate(() => {
    const box = (element: Element) => { const range = document.createRange(); range.selectNodeContents(element); return range.getBoundingClientRect() }
    const buttons = [...document.querySelectorAll('.rating-scale__options .rating-button')].map(button => button.getBoundingClientRect())
    const [low, middle, high] = ['.rating-scale__low', '.rating-scale__middle', '.rating-scale__high'].map(selector => box(document.querySelector(selector)!))
    return {
      low: Math.abs(low.left - buttons[0].left), lowAbove: low.bottom <= buttons[0].top,
      middle: Math.abs((middle.left + middle.right) / 2 - (buttons[3].left + buttons[3].right) / 2),
      high: Math.abs(high.right - buttons[6].right),
    }
  })
  expect(placement).toEqual({ low: expect.any(Number), lowAbove: true, middle: expect.any(Number), high: expect.any(Number) })
  expect(Math.max(placement.low, placement.middle, placement.high)).toBeLessThan(2)
  await steps.nth(0).click()
  await expect(steps.nth(0)).toHaveAttribute('aria-checked', 'true')
  await screenshot('answer')
  await page.waitForTimeout(3200)
  await page.getByRole('button', { name: 'Submit response', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'We will follow up with you', exact: true })).toBeVisible()
  await screenshot('completed')

  const ledger = await call<Ledger>(`${base}/ledger`)
  expect(ledger.responses).toHaveLength(1)
  expect(ledger.responses[0].answers.find(answer => answer.stepId === scale.id)?.value).toBe(0)
  await page.goto(`/app/flows/${flow.id}/results`)
  const region = page.getByRole('region', { name: 'Response ledger', exact: true })
  await region.getByRole('button', { name: 'View answers', exact: true }).first().click()
  await expect(region.getByRole('term').filter({ hasText: scale.prompt })).toBeVisible()
  await expect(region.getByRole('definition').first()).toHaveText('0')
  const results = page.getByRole('region', { name: 'Answers', exact: true })
  for (const label of ['0 · Not at all', '6 · Completely']) await expect(results.getByText(label, { exact: true })).toBeVisible()
  await screenshot('ledger')
  const downloaded = page.waitForEvent('download')
  await region.getByRole('button', { name: 'Export CSV' }).click()
  const csv = csvRows(await downloadedText(await downloaded))
  const answers = JSON.parse(csv[1][csv[0].indexOf('answers_json')]) as Array<{ stepId: string; value: unknown }>
  expect(answers.find(answer => answer.stepId === scale.id)?.value).toBe(0)
})
