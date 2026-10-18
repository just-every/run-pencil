import type { BuilderDraft, Ledger } from '../../src/core/app/api'
import { parseCsv } from '../../src/core/features/importing/csv'
import { contract } from './contract'
import { expect, test } from './fixtures'
import { signInEmptyWorkspace } from './authoring-helpers'

contract(['LOGIC-003', 'LOGIC-006'], 'builds a conditional total, previews calculated routing and retains both published totals', async ({ page }, info) => {
  test.setTimeout(120_000)
  page.setDefaultTimeout(15_000)
  await signInEmptyWorkspace(page)
  const slug = `calculated-order-${info.project.name}-${Date.now()}`
  const call = async <T,>(path: string, method = 'GET', data?: unknown) => {
    const response = await page.request.fetch(path, { method, ...(data === undefined ? {} : { data }) })
    expect(response.status(), await response.text()).toBeLessThan(300)
    return response.json() as Promise<T>
  }
  const screenshot = async (state: string) => {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const path = info.outputPath(`calculations-${state}-${info.project.name}.png`)
    if(state==='ledger') await page.getByRole('region',{name:'Response ledger',exact:true}).screenshot({path})
    else if(state==='builder') await page.locator('details.calculation-settings').screenshot({path})
    else await page.screenshot({ path, fullPage: true })
    await info.attach(`Calculations ${state} · ${info.project.name}`, { path, contentType: 'image/png' })
  }
  const flow = await call<{ id: string }>('/api/app/flows', 'POST', { title: 'Calculated order', slug })
  const base = `/api/app/flows/${flow.id}`
  const read = () => call<BuilderDraft>(`${base}/draft`)
  for (const step of [
    { kind: 'question', questionType: 'number', prompt: 'How many items?', required: true, questionSettings: { min: 1, max: 100, decimalPlaces: 0 } },
    { kind: 'question', questionType: 'yes_no', prompt: 'Apply the discount?', required: true },
    { kind: 'completion', questionType: null, prompt: 'Standard order' },
    { kind: 'completion', questionType: null, prompt: 'Large order' },
  ]) await call(`${base}/draft/steps`, 'POST', { expectedVersion: (await read()).flow.draftVersion, step })
  const initial = await read()
  const [quantity, discount, normal, high] = initial.steps

  await page.goto(`/app/flows/${flow.id}/builder`)
  await expect(page.locator('.operator-shell[data-hydrated=true]')).toBeVisible()
  await page.getByText('Publication options', { exact: true }).click()
  await page.getByText('Calculations', { exact: true }).click()
  await page.getByRole('button', { name: 'Add numeric calculation', exact: true }).click()
  await page.getByLabel('Calculation name 1', { exact: true }).fill('total')
  await page.getByLabel('Calculation type 1', { exact: true }).selectOption('number')
  await page.getByLabel('Calculation expression 1', { exact: true }).selectOption('multiply')
  await page.getByLabel('Calculation expression 1 left', { exact: true }).selectOption('answer')
  await page.getByLabel('Question reference Calculation expression 1 left', { exact: true }).selectOption(quantity.id)
  await page.getByLabel('Calculation expression 1 right', { exact: true }).selectOption('conditional')
  const calculation = page.getByRole('group', { name: 'Calculation 1', exact: true })
  const condition = calculation.getByRole('group', { name: 'If', exact: true })
  await condition.getByLabel('Question', { exact: true }).selectOption(discount.id)
  await condition.getByLabel('Condition', { exact: true }).selectOption('equals')
  await condition.getByLabel('Answer', { exact: true }).selectOption('true')
  await page.getByLabel('Literal value Calculation expression 1 right then', { exact: true }).fill('16')
  await page.getByLabel('Literal value Calculation expression 1 right else', { exact: true }).fill('20')
  await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeDisabled()
  await screenshot('builder')
  await page.getByRole('button', { name: 'Save calculations', exact: true }).click()
  await expect(page.getByText('Saved.', { exact: true })).toBeVisible()
  const saved = await read()
  const total = saved.formSettings!.calculations!.find(value => value.name === 'total')
  expect(total).toBeDefined()
  const totalId = total!.id

  // Connect the saved calculation through the real versioned draft API. The
  // expression itself above is authored entirely through the visual editor.
  await call(`${base}/draft`, 'PUT', { expectedVersion: saved.flow.draftVersion, stepId: discount.id, prompt: discount.prompt, required: true, nextStepId: normal.id })
  for (const [step, title] of [[normal, 'Standard order'], [high, 'Large order']] as const) {
    await call(`${base}/draft`, 'PUT', { expectedVersion: (await read()).flow.draftVersion, stepId: step.id, prompt: `${title} · Total {{variable:${totalId}}}`, required: false })
  }
  await call(`${base}/draft/branches`, 'PUT', {
    expectedVersion: (await read()).flow.draftVersion,
    rules: [{ sourceStepId: discount.id, predicateKind: 'greater_than_or_equal', expectedValue: 100, destinationStepId: high.id, position: 0, condition: { kind: 'test', stepId: `variable:${totalId}`, operator: 'greater_than_or_equal', value: 100 } }],
  })
  await page.reload()
  await page.getByRole('button', { name: 'Preview draft', exact: true }).click()
  const preview = page.getByRole('region', { name: 'Draft preview', exact: true })
  await preview.getByRole('spinbutton', { name: quantity.prompt, exact: true }).fill('8')
  await preview.getByRole('button', { name: 'Continue preview', exact: true }).click()
  await preview.getByRole('radio', { name: 'Yes', exact: true }).check()
  await preview.getByRole('button', { name: 'Inspect answer path', exact: true }).click()
  const trace = preview.getByRole('region', { name: 'Preview rule evaluations', exact: true })
  await expect(trace).toContainText('Calculation: total: 128')
  await expect(trace).toContainText('is at least → true')
  await screenshot('preview')
  await preview.getByRole('button', { name: 'Continue preview', exact: true }).click()
  await expect(preview.getByRole('heading', { name: 'Large order · Total 128', exact: true })).toBeVisible()
  await preview.getByRole('button', { name: 'Close preview', exact: true }).click()
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Share this flow', exact: true })).toBeVisible()

  for (const [count, heading] of [[4, 'Standard order · Total 64'], [8, 'Large order · Total 128']] as const) {
    await page.goto(`/f/${slug}`)
    await page.getByRole('spinbutton', { name: quantity.prompt, exact: true }).fill(String(count))
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await page.getByRole('radio', { name: 'Yes', exact: true }).check()
    await page.waitForTimeout(3200)
    await page.getByRole('button', { name: 'Submit response', exact: true }).click()
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
    await screenshot(`completed-${count}`)
  }
  await page.goto(`/app/flows/${flow.id}/results`)
  const ledgerRegion = page.getByRole('region', { name: 'Response ledger', exact: true })
  await ledgerRegion.getByRole('button', { name: 'View answers', exact: true }).first().click()
  await expect(ledgerRegion.getByText('Calculated values', { exact: true })).toBeVisible()
  await expect(ledgerRegion.getByText('total', { exact: true })).toBeVisible()
  await expect(ledgerRegion.getByText('128', { exact: true })).toBeVisible()
  await screenshot('ledger')
  const ledger = await call<Ledger>(`${base}/ledger`)
  expect(ledger.total).toBe(2)
  expect(ledger.responses.map(response => response.calculations.find(value => value.id === totalId)?.value).sort((a, b) => Number(a) - Number(b))).toEqual([64, 128])
  const start = await call<{ token: string }>(`${base}/responses/export/start?format=csv`)
  const exported = await page.request.get(`${base}/responses/export?token=${encodeURIComponent(start.token)}`)
  expect(exported.status(), await exported.text()).toBe(200)
  const parsed = parseCsv(await exported.text())
  expect(parsed.errors).toEqual([])
  const [header, ...rows] = parsed.rows
  const records = rows.map(row => Object.fromEntries(header.map((column, index) => [column, row[index]])))
  expect(records).toHaveLength(2)
  const exportedTotals = records.map(record => (JSON.parse(record.calculations_json) as Ledger['responses'][number]['calculations']).find(value => value.id === totalId)?.value)
  expect(exportedTotals.sort((a, b) => Number(a) - Number(b))).toEqual([64, 128])
})
