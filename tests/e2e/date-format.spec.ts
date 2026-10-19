import { contract } from './contract'
import { expect, test } from './fixtures'
import { signInEmptyWorkspace } from './authoring-helpers'
import { csvRows, downloadedText } from './export-helpers'
import type { BuilderDraft, Ledger } from '../../src/core/app/api'

// A British browser locale must not change the published MM/DD/YYYY order.
test.use({ locale: 'en-GB', extraHTTPHeaders: { 'CF-Connecting-IP': '198.18.240.41' } })
contract('FIELD-015', 'an MM/DD/YYYY date under an en-GB browser shows 07/04/2026 in recall, completion and review, exports ISO and DD/MM stores the other day', async ({ page }, info) => {
  test.setTimeout(120_000)
  const origin = new URL(info.project.use.baseURL!).origin
  await signInEmptyWorkspace(page)
  const call = async <T,>(path: string, data?: unknown) => {
    const response = await page.request.fetch(path, { method: data === undefined ? 'GET' : 'POST', headers: { Origin: origin }, ...(data === undefined ? {} : { data }) })
    expect(response.status(), await response.text()).toBeLessThan(300)
    return response.json() as Promise<T>
  }
  const screenshot = async (state: string) => {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const path = info.outputPath(`date-format-${state}-${info.project.name}.png`)
    await page.screenshot({ path, fullPage: true })
    await info.attach(`Date format ${state} · ${info.project.name}`, { path, contentType: 'image/png' })
  }
  const publishDateFlow = async (title: string, displayFormat: string) => {
    const slug = `date-${displayFormat.slice(0, 2).toLowerCase()}-${info.project.name}-${Date.now()}`
    const flow = await call<{ id: string }>('/api/app/flows', { title, slug })
    const base = `/api/app/flows/${flow.id}`, read = () => call<BuilderDraft>(`${base}/draft`)
    await call(`${base}/draft/steps`, { expectedVersion: (await read()).flow.draftVersion, step: { kind: 'question', questionType: 'date', prompt: 'Appointment date', required: true, questionSettings: { displayFormat, separator: '/' } } })
    const date = (await read()).steps[0]
    for (const step of [
      { kind: 'question', questionType: 'short_text', prompt: `Anything we should know before {{${date.id}}}?`, required: false },
      { kind: 'completion', questionType: null, prompt: `Booked for {{${date.id}}}` },
    ]) await call(`${base}/draft/steps`, { expectedVersion: (await read()).flow.draftVersion, step })
    await call(`${base}/publish`, { expectedVersion: (await read()).flow.draftVersion })
    return { flow, base, slug, date }
  }
  const enter = async (month: string, day: string, year: string) => {
    await page.getByLabel('Month', { exact: true }).fill(month)
    await page.getByLabel('Day', { exact: true }).fill(day)
    await page.getByLabel('Year', { exact: true }).fill(year)
  }

  const american = await publishDateFlow('Clinic booking', 'MM/DD/YYYY')
  await page.goto(`/f/${american.slug}`)
  await expect(page.getByText('Date format: MM/DD/YYYY', { exact: true })).toBeVisible()
  const parts = await page.getByRole('group', { name: 'Appointment date', exact: true }).getByRole('textbox').evaluateAll(inputs => inputs.map(input => input.closest('label')?.textContent?.trim()))
  expect(parts).toEqual(['Month', 'Day', 'Year'])
  await enter('02', '30', '2026')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('MM/DD/YYYY')
  await screenshot('refused')
  await enter('07', '04', '2026')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Anything we should know before 07/04/2026?', exact: true })).toBeVisible()
  await screenshot('recall')
  await page.waitForTimeout(3200)
  await page.getByRole('button', { name: 'Submit response', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Booked for 07/04/2026', exact: true })).toBeVisible()
  await screenshot('completed')

  const ledger = await call<Ledger>(`${american.base}/ledger`)
  expect(ledger.responses[0].answers.find(answer => answer.stepId === american.date.id)?.value).toBe('2026-07-04')
  await page.goto(`/app/flows/${american.flow.id}/results`)
  const region = page.getByRole('region', { name: 'Response ledger', exact: true })
  await region.getByRole('button', { name: 'View answers', exact: true }).first().click()
  await expect(region.getByRole('term').filter({ hasText: 'Appointment date' })).toBeVisible()
  await expect(region.getByRole('definition').first()).toHaveText('07/04/2026')
  await screenshot('review')
  const downloaded = page.waitForEvent('download')
  await region.getByRole('button', { name: 'Export CSV' }).click()
  const csv = csvRows(await downloadedText(await downloaded))
  const answers = JSON.parse(csv[1][csv[0].indexOf('answers_json')]) as Array<{ stepId: string; value: unknown }>
  expect(answers.find(answer => answer.stepId === american.date.id)?.value).toBe('2026-07-04')

  const british = await publishDateFlow('Clinic booking (UK)', 'DD/MM/YYYY')
  await page.goto(`/f/${british.slug}`)
  await expect(page.getByText('Date format: DD/MM/YYYY', { exact: true })).toBeVisible()
  await page.getByLabel('Day', { exact: true }).fill('07')
  await page.getByLabel('Month', { exact: true }).fill('04')
  await page.getByLabel('Year', { exact: true }).fill('2026')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Anything we should know before 07/04/2026?', exact: true })).toBeVisible()
  await page.waitForTimeout(3200)
  await page.getByRole('button', { name: 'Submit response', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Booked for 07/04/2026', exact: true })).toBeVisible()
  const stored = await call<Ledger>(`${british.base}/ledger`)
  expect(stored.responses[0].answers.find(answer => answer.stepId === british.date.id)?.value).toBe('2026-04-07')
})
