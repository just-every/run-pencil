import type { BuilderDraft, Ledger } from '../../src/core/app/api'
import { parseCsv } from '../../src/core/features/importing/csv'
import { contract } from './contract'
import { expect, test } from './fixtures'
import { signInEmptyWorkspace } from './authoring-helpers'
import { startStripeReceiver, stripeFixture } from './stripe-receiver'

contract(['LOGIC-003', 'LOGIC-006', 'PAY-001'], 'builds a conditional total, previews calculated routing, pays each branch on Stripe Checkout and retains both published totals', async ({ page }, info) => {
  test.setTimeout(240_000)
  page.setDefaultTimeout(15_000)
  const pencil = new URL(process.env.PENCIL_E2E_BASE_URL!).origin
  const stripe = await startStripeReceiver(pencil)
  try {
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
    else if(state==='payment-builder') await page.locator('.builder-grid').screenshot({path})
    else if(state==='payment-ledger') await page.locator('.ledger-row--open').screenshot({path})
    else await page.screenshot({ path, fullPage: true })
    await info.attach(`Calculations ${state} · ${info.project.name}`, { path, contentType: 'image/png' })
  }
  // PAY-001: the owner connects Stripe (here the loopback stand-in) with a restricted key and a signing secret.
  await page.goto('/app/settings')
  const payments = page.getByRole('region', { name: 'Payments', exact: true })
  await payments.getByLabel('Stripe restricted key', { exact: true }).fill(stripeFixture.secretKey)
  await payments.getByLabel('Webhook signing secret', { exact: true }).fill(stripeFixture.webhookSecret)
  await payments.getByRole('button', { name: 'Save Stripe connection', exact: true }).click()
  await expect(payments.getByText(/Stripe is connected in test mode with a restricted key/)).toBeVisible()
  await payments.getByRole('button', { name: 'Test connection', exact: true }).click()
  await expect(payments.getByText('Stripe accepted the restricted key in test mode.', { exact: true })).toBeVisible()
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
  // Each branch pays the calculated total on its own payment step, authored in the builder, before its completion screen.
  await page.reload()
  for (const [label, completion] of [['Pay for the standard order', normal], ['Pay for the large order', high]] as const) {
    await page.getByRole('button', { name: 'Add payment step', exact: true }).click()
    await expect(page.getByRole('region', { name: 'Payment pricing', exact: true })).toBeVisible()
    await page.getByLabel('Prompt', { exact: true }).fill(label)
    await page.getByRole('radio', { name: 'Calculated amount', exact: true }).check()
    await expect(page.getByLabel('Calculation charged', { exact: true })).toHaveValue(totalId)
    await page.getByLabel('Minimum charge (USD)', { exact: true }).fill('16')
    await page.getByLabel('Maximum charge (USD)', { exact: true }).fill('2000')
    await page.getByRole('combobox', { name: /^Default next screen/ }).selectOption(completion.id)
    if (completion === high) await screenshot('payment-builder')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByText('Saved.', { exact: true })).toBeVisible()
  }
  const priced = await read()
  const [standardPay, largePay] = ['Pay for the standard order', 'Pay for the large order'].map(prompt => priced.steps.find(step => step.prompt === prompt)!)
  expect(standardPay.questionSettings?.payment).toEqual({ products: [], options: [], calculationId: totalId, minimum: 1600, maximum: 200_000 })
  await call(`${base}/draft`, 'PUT', { expectedVersion: priced.flow.draftVersion, stepId: discount.id, prompt: discount.prompt, required: true, nextStepId: standardPay.id })
  await call(`${base}/draft/branches`, 'PUT', {
    expectedVersion: (await read()).flow.draftVersion,
    rules: [{ sourceStepId: discount.id, predicateKind: 'greater_than_or_equal', expectedValue: 100, destinationStepId: largePay.id, position: 0, condition: { kind: 'test', stepId: `variable:${totalId}`, operator: 'greater_than_or_equal', value: 100 } }],
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
  await expect(preview.getByRole('heading', { name: 'Pay for the large order', exact: true })).toBeVisible()
  await expect(preview.getByRole('definition').filter({ hasText: '$128.00' }).last()).toBeVisible()
  await preview.getByRole('button', { name: 'Continue preview', exact: true }).click()
  await expect(preview.getByRole('heading', { name: 'Large order · Total 128', exact: true })).toBeVisible()
  await preview.getByRole('button', { name: 'Close preview', exact: true }).click()
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Share this flow', exact: true })).toBeVisible()

  // The standard order cancels on Checkout first and pays on its second attempt; the large order pays at once.
  for (const [count, heading, total, cancelFirst] of [[4, 'Standard order · Total 64', '$64.00', true], [8, 'Large order · Total 128', '$128.00', false]] as const) {
    const thirdParty: string[] = []
    const watch = (request: import('@playwright/test').Request) => { if (new URL(request.url()).origin !== pencil && !request.url().startsWith('data:')) thirdParty.push(request.url()) }
    page.on('request', watch)
    await page.goto(`/f/${slug}`)
    await page.getByRole('spinbutton', { name: quantity.prompt, exact: true }).fill(String(count))
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await page.getByRole('radio', { name: 'Yes', exact: true }).check()
    await page.waitForTimeout(3200)
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    const pay = page.getByRole('button', { name: `Pay ${total} with Stripe`, exact: true })
    await expect(pay).toBeVisible()
    await expect(page.getByRole('definition').filter({ hasText: total }).last()).toBeVisible()
    if (cancelFirst) await screenshot('payment-step')
    // BASE-PUBLIC-001: the respondent page itself loaded nothing from another origin.
    page.off('request', watch)
    expect(thirdParty).toEqual([])
    await pay.click()
    await expect(page).toHaveURL(new RegExp(`^${stripe.origin}/pay/cs_test_`))
    if (cancelFirst) {
      await page.getByRole('link', { name: 'Back', exact: true }).click()
      await expect(page.getByText('Payment cancelled. Your answers are kept: go back to change them, or pay again.', { exact: true })).toBeVisible()
      const answers = page.getByRole('region', { name: 'Your answers', exact: true })
      await expect(answers.getByText(String(count), { exact: true })).toBeVisible()
      await expect(answers.getByText('Yes', { exact: true })).toBeVisible()
      await screenshot('cancel-return')
      await page.getByRole('button', { name: `Pay ${total} with Stripe`, exact: true }).click()
      await expect(page).toHaveURL(new RegExp(`^${stripe.origin}/pay/cs_test_`))
    }
    await page.getByRole('button', { name: `Pay ${total}`, exact: true }).click()
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
    await expect(page.getByText(/Your payment is received\./)).toBeVisible()
    await screenshot(`completed-${count}`)
    // One respondent session keeps one response, however many checkout attempts it took.
    expect((await call<Ledger>(`${base}/ledger`)).responses.filter(response => response.calculations.find(value => value.id === totalId)?.value === (count === 4 ? 64 : 128))).toHaveLength(1)
  }
  expect([...stripe.sessions.values()].map(session => [session.amount_total, session.status]).sort()).toEqual([[12800, 'complete'], [6400, 'complete'], [6400, 'expired']].sort())
  expect(stripe.webhooks.map(webhook => [webhook.status, JSON.parse(webhook.body).outcome])).toEqual([[200, 'applied'], [200, 'applied']])
  await page.goto(`/app/flows/${flow.id}/results`)
  const ledgerRegion = page.getByRole('region', { name: 'Response ledger', exact: true })
  await ledgerRegion.getByRole('button', { name: 'View answers', exact: true }).first().click()
  await expect(ledgerRegion.getByText('Calculated values', { exact: true })).toBeVisible()
  await expect(ledgerRegion.getByText('total', { exact: true })).toBeVisible()
  await expect(ledgerRegion.getByText('128', { exact: true })).toBeVisible()
  const record = ledgerRegion.getByRole('region', { name: 'Payment', exact: true }).first()
  await expect(record.getByText('Paid ·', { exact: false })).toBeVisible()
  await expect(record.getByText(/^cs_test_/)).toBeVisible()
  await screenshot('payment-ledger')
  await screenshot('ledger')
  const ledger = await call<Ledger>(`${base}/ledger`)
  expect(ledger.total).toBe(2)
  expect(ledger.responses.map(response => [response.payment?.state, response.payment?.amount]).sort()).toEqual([['paid', 12800], ['paid', 6400]].sort())
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
  } finally { await stripe.close() }
})

contract('LOGIC-003', 'a BMI from two decimal answers gates a branch and publishes', async ({ page }, info) => {
  test.setTimeout(120_000)
  page.setDefaultTimeout(15_000)
  await signInEmptyWorkspace(page)
  const slug = `bmi-${info.project.name}-${Date.now()}`
  const call = async <T,>(path: string, method = 'GET', data?: unknown) => {
    const response = await page.request.fetch(path, { method, ...(data === undefined ? {} : { data }) })
    expect(response.status(), await response.text()).toBeLessThan(300)
    return response.json() as Promise<T>
  }
  const screenshot = async (state: string) => {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const path = info.outputPath(`bmi-${state}-${info.project.name}.png`)
    await page.screenshot({ path, fullPage: true })
    await info.attach(`BMI ${state} · ${info.project.name}`, { path, contentType: 'image/png' })
  }
  const flow = await call<{ id: string }>('/api/app/flows', 'POST', { title: 'Health check', slug })
  const base = `/api/app/flows/${flow.id}`
  const read = () => call<BuilderDraft>(`${base}/draft`)
  for (const step of [
    { kind: 'question', questionType: 'number', prompt: 'Weight in kilograms', required: true, questionSettings: { min: 1, decimalPlaces: 1 } },
    { kind: 'question', questionType: 'number', prompt: 'Height in metres', required: true, questionSettings: { min: 0.5, max: 2.5, decimalPlaces: 2 } },
    { kind: 'question', questionType: 'yes_no', prompt: 'Do you smoke?', required: true },
    { kind: 'completion', questionType: null, prompt: 'Healthy range · BMI {{variable:bmi}}' },
    { kind: 'completion', questionType: null, prompt: 'Follow-up · BMI {{variable:bmi}}' },
  ]) await call(`${base}/draft/steps`, 'POST', { expectedVersion: (await read()).flow.draftVersion, step })
  const [weight, height, smoker, , followUp] = (await read()).steps
  const answer = (stepId: string) => ({ kind: 'answer', stepId })
  await call(`${base}/draft/settings`, 'PUT', { expectedVersion: (await read()).flow.draftVersion, settings: { hiddenFields: [], identityMode: 'anonymous', calculations: [
    { id: 'bmi', name: 'BMI', type: 'number', expression: { kind: 'round', decimalPlaces: 1, value: { kind: 'divide', left: answer(weight.id), right: { kind: 'multiply', left: answer(height.id), right: answer(height.id) } } } },
  ] } })
  await call(`${base}/draft/branches`, 'PUT', { expectedVersion: (await read()).flow.draftVersion, rules: [
    { sourceStepId: smoker.id, predicateKind: 'greater_than_or_equal', expectedValue: 25, destinationStepId: followUp.id, position: 0, condition: { kind: 'test', stepId: 'variable:bmi', operator: 'greater_than_or_equal', value: 25 } },
  ] })

  await page.goto(`/app/flows/${flow.id}/builder`)
  await expect(page.locator('.operator-shell[data-hydrated=true]')).toBeVisible()
  await page.getByRole('button', { name: 'Preview draft', exact: true }).click()
  const preview = page.getByRole('region', { name: 'Draft preview', exact: true })
  const trace = preview.getByRole('region', { name: 'Preview rule evaluations', exact: true })
  const forward = () => preview.getByRole('button', { name: 'Continue preview', exact: true }).click()
  const back = () => preview.getByRole('button', { name: 'Back in preview', exact: true }).click()
  await preview.getByRole('spinbutton', { name: weight.prompt, exact: true }).fill('70.5')
  await forward()
  await preview.getByRole('spinbutton', { name: height.prompt, exact: true }).fill('1.75')
  await forward()
  await preview.getByRole('radio', { name: 'No', exact: true }).check()
  await preview.getByRole('button', { name: 'Inspect answer path', exact: true }).click()
  await expect(trace).toContainText('Calculation: BMI: 23')
  await expect(trace).toContainText('is at least → false')
  await screenshot('preview-healthy')
  await forward()
  await expect(preview.getByRole('heading', { name: 'Healthy range · BMI 23', exact: true })).toBeVisible()
  await back(); await back(); await back()
  await preview.getByRole('spinbutton', { name: weight.prompt, exact: true }).fill('95.2')
  await forward(); await forward()
  await preview.getByRole('radio', { name: 'No', exact: true }).check()
  await preview.getByRole('button', { name: 'Inspect answer path', exact: true }).click()
  await expect(trace).toContainText('Calculation: BMI: 31.1')
  await expect(trace).toContainText('is at least → true')
  await screenshot('preview-follow-up')
  await forward()
  await expect(preview.getByRole('heading', { name: 'Follow-up · BMI 31.1', exact: true })).toBeVisible()
  await preview.getByRole('button', { name: 'Close preview', exact: true }).click()
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Share this flow', exact: true })).toBeVisible()

  for (const [kilograms, heading, state] of [['70.5', 'Healthy range · BMI 23', 'healthy'], ['95.2', 'Follow-up · BMI 31.1', 'follow-up']] as const) {
    await page.goto(`/f/${slug}`)
    await page.getByRole('spinbutton', { name: weight.prompt, exact: true }).fill(kilograms)
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await page.getByRole('spinbutton', { name: height.prompt, exact: true }).fill('1.75')
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await page.getByRole('radio', { name: 'No', exact: true }).check()
    await page.waitForTimeout(3200)
    await page.getByRole('button', { name: 'Submit response', exact: true }).click()
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
    await screenshot(`completed-${state}`)
  }
  const ledger = await call<Ledger>(`${base}/ledger`)
  expect(ledger.responses.map(response => response.calculations.find(value => value.id === 'bmi')?.value).sort((a, b) => Number(a) - Number(b))).toEqual([23, 31.1])
})
