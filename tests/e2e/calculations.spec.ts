import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import AxeBuilder from '@axe-core/playwright'
import manifest from '../../seed.json' with { type: 'json' }
import type { Page, Response } from '@playwright/test'
import type { BuilderDraft, Ledger } from '../../src/core/app/api'
import { parseCsv } from '../../src/core/features/importing/csv'
import { contract } from './contract'
import { expect, test } from './fixtures'
import { signInEmptyWorkspace } from './authoring-helpers'
import { nativeHost, observeEmbedMessages } from './brand-helpers'
import { startStripeReceiver, stripeFixture } from './stripe-receiver'

// Submission admission uses the signed public form-load timestamp.
const formLoad = (page: Page) => page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/views') && response.request().method() === 'POST' && response.ok())
async function submissionWindow(load: Promise<Response>) {
  const {loadTime} = await (await load).json() as {loadTime:string}
  const at = Number(loadTime.split('.')[1])
  expect(Number.isSafeInteger(at)).toBe(true)
  await expect.poll(()=>Date.now()-at).toBeGreaterThanOrEqual(manifest.limits.abuse.minimumSecondsFromFormLoadToSubmit*1000)
}

contract(['LOGIC-003', 'LOGIC-006', 'PAY-001', 'PAY-005', 'PAY-003', 'PAY-004'], 'builds a conditional total, previews calculated routing, pays each branch on Stripe Checkout and retains both published totals', async ({ page, browser }, info) => {
  test.setTimeout(240_000)
  page.setDefaultTimeout(15_000)
  const hydrationErrors:string[]=[]
  const observePage=(view:Page)=>{
    view.on('pageerror',error=>{if(/hydrat/i.test(error.message))hydrationErrors.push(error.message)})
    view.on('console',message=>{if(message.type()==='error'&&/hydrat/i.test(message.text()))hydrationErrors.push(message.text())})
  }
  observePage(page)
  const captureEmbed=async(view:Page,name:string)=>{
    if(!process.env.PENCIL_CAPTURE_DIR)return
    await mkdir(process.env.PENCIL_CAPTURE_DIR,{recursive:true})
    await view.screenshot({path:join(process.env.PENCIL_CAPTURE_DIR,`${info.project.name}-payment-embed-${name}.png`),fullPage:true})
  }
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
  await payments.getByText('How to connect Stripe',{exact:true}).click()
  await screenshot('payment-connection')
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
    const loaded = formLoad(page)
    await page.goto(`/f/${slug}`)
    await page.getByRole('spinbutton', { name: quantity.prompt, exact: true }).fill(String(count))
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await page.getByRole('radio', { name: 'Yes', exact: true }).check()
    await submissionWindow(loaded)
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
  // PAY-001(g): the real script embed must navigate the top-level host to Checkout.
  const host = await nativeHost(`<script async src="${pencil}/embed.js?flow=${slug}"></script>`)
  const workspace = await call<Record<string, unknown>>('/api/app/workspace')
  await call('/api/app/workspace', 'PUT', { ...workspace, embedAllowedOrigins: [host.origin] })
  const visitorContext = await browser.newContext({ extraHTTPHeaders: {}, viewport: info.project.name === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 900 } })
  visitorContext.on('page',observePage)
  const checkoutMessages: Array<{ targetOrigin: string; payload: { type: string; challenge: string; url: string; sessionId: string } }> = []
  const checkoutHandoffs: Array<{ url: string; sessionId: string }> = []
  await visitorContext.exposeBinding('observeCheckoutHandoff', (_source, value) => { checkoutHandoffs.push(value) })
  await visitorContext.addInitScript(() => {
    if (window.parent !== window) return
    const observed = window as unknown as { observeCheckoutHandoff(value: unknown): Promise<void> }
    let replayed = false
    document.addEventListener('pencil:checkout', event => {
      const detail = (event as CustomEvent).detail as { url: string; sessionId: string }
      void observed.observeCheckoutHandoff(detail)
      if (replayed) return
      replayed = true
      const frame = document.querySelector('iframe')!
      const challenge = new URLSearchParams(new URL(frame.src).hash.slice(1)).get('pencil-embed')!
      // Replay the exact transport before navigation can discard the iframe.
      for (let index = 0; index < 2; index++) window.dispatchEvent(new MessageEvent('message', {
        source: frame.contentWindow, origin: 'null', data: { type: 'pencil:checkout', challenge, ...detail },
      }))
    })
  })
  try {
    // Replace only the hosted paid network edge. The production origin guard still runs.
    stripe.useStripeCheckoutOrigin()
    await visitorContext.route('https://checkout.stripe.com/**', route => route.fulfill({ status: 302, headers: { location: `${stripe.origin}${new URL(route.request().url()).pathname}` } }))
    const visitor = await visitorContext.newPage()
    const checkoutRequests: string[] = []
    visitor.on('request', request => { if (new URL(request.url()).origin === 'https://checkout.stripe.com') checkoutRequests.push(request.url()) })
    const loaded = formLoad(visitor)
    await visitor.goto(host.origin)
    const frame = visitor.frameLocator('iframe')
    await expect(frame.getByRole('spinbutton',{name:quantity.prompt,exact:true})).toBeVisible()
    await expect(frame.getByRole('spinbutton',{name:quantity.prompt,exact:true})).toBeEnabled()
    const observationErrors=await observeEmbedMessages(visitorContext,visitor,value=>checkoutMessages.push(value as typeof checkoutMessages[number]))
    await expect(visitor.locator('iframe')).toHaveAttribute('sandbox', 'allow-scripts allow-forms allow-top-navigation-by-user-activation')
    await frame.getByRole('spinbutton', { name: quantity.prompt, exact: true }).fill('3')
    await frame.getByRole('button', { name: 'Continue', exact: true }).click()
    await frame.getByRole('radio', { name: 'Yes', exact: true }).check()
    await submissionWindow(loaded)
    await frame.getByRole('button', { name: 'Continue', exact: true }).click()
    const proof = async (name: string) => {
      expect(await visitor.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
      expect((await new AxeBuilder({page:visitor}).analyze()).violations.filter(violation=>violation.impact==='serious'||violation.impact==='critical')).toEqual([])
      await captureEmbed(visitor,name)
      const path = info.outputPath(`embed-${name}-${info.project.name}.png`)
      await visitor.screenshot({ path, fullPage: true })
      await info.attach(`Embed ${name}`, { path, contentType: 'image/png' })
    }
    await expect(frame.getByRole('button', { name: 'Pay $48.00 with Stripe', exact: true })).toBeVisible()
    const challenge = new URLSearchParams(new URL((await visitor.locator('iframe').getAttribute('src'))!).hash.slice(1)).get('pencil-embed')!
    await proof('payment')
    await frame.getByRole('button', { name: 'Pay $48.00 with Stripe', exact: true }).evaluate((button: HTMLButtonElement) => { button.click(); button.click() })
    await expect(visitor).toHaveURL(new RegExp(`^${stripe.origin}/pay/cs_test_`))
    const embeddedCheckout = [...stripe.sessions.values()].find(session => session.amount_total === 4800)!
    expect(embeddedCheckout).toBeDefined()
    await expect.poll(() => checkoutMessages.length).toBe(1)
    expect(checkoutMessages).toEqual([{ targetOrigin: host.origin, payload: {
      type: 'pencil:checkout', challenge, url: embeddedCheckout.url, sessionId: embeddedCheckout.id,
    } }])
    await expect.poll(() => checkoutHandoffs.length).toBe(1)
    expect(checkoutHandoffs).toEqual([{ url: embeddedCheckout.url, sessionId: embeddedCheckout.id }])
    expect(checkoutRequests).toEqual([embeddedCheckout.url])
    expect(observationErrors).toEqual([])
    expect([...stripe.sessions.values()].filter(session => session.amount_total === 4800)).toHaveLength(1)
    expect(visitor.mainFrame().url()).toBe(visitor.url())
    expect(visitor.frames()).toHaveLength(1)
    await proof('checkout-top-level')
    await visitor.getByRole('button', { name: 'Pay $48.00', exact: true }).click()
    await expect(visitor.getByRole('heading', { name: 'Standard order · Total 48', exact: true })).toBeVisible()
    await expect(visitor.getByText(/Your payment is received\./)).toBeVisible()
    await proof('success-return')
  } finally { await visitorContext.close(); await host.close() }
  expect([...stripe.sessions.values()].map(session => [session.amount_total, session.status]).sort()).toEqual([[12800, 'complete'], [6400, 'complete'], [6400, 'expired'], [4800, 'complete']].sort())
  expect(stripe.webhooks.map(webhook => [webhook.status, JSON.parse(webhook.body).outcome])).toEqual([[200, 'applied'], [200, 'applied'], [200, 'applied']])
  await page.goto(`/app/flows/${flow.id}/results`)
  const ledgerRegion = page.getByRole('region', { name: 'Response ledger', exact: true })
  await ledgerRegion.getByRole('button', { name: 'View answers', exact: true }).nth(1).click()
  await expect(ledgerRegion.getByText('Calculated values', { exact: true })).toBeVisible()
  await expect(ledgerRegion.getByText('total', { exact: true })).toBeVisible()
  await expect(ledgerRegion.getByText('128', { exact: true })).toBeVisible()
  const record = ledgerRegion.getByRole('region', { name: 'Payment', exact: true }).first()
  await expect(record.getByText('Paid ·', { exact: false })).toBeVisible()
  await expect(record.getByText(/^cs_test_/)).toBeVisible()
  await screenshot('payment-ledger')
  await screenshot('ledger')
  const ledger = await call<Ledger>(`${base}/ledger`)
  expect(ledger.total).toBe(3)
  expect(ledger.responses.map(response => [response.payment?.state, response.payment?.amount]).sort()).toEqual([['paid', 12800], ['paid', 6400], ['paid', 4800]].sort())
  expect(ledger.responses.map(response => response.calculations.find(value => value.id === totalId)?.value).sort((a, b) => Number(a) - Number(b))).toEqual([48, 64, 128])
  const start = await call<{ token: string }>(`${base}/responses/export/start?format=csv`)
  const exported = await page.request.get(`${base}/responses/export?token=${encodeURIComponent(start.token)}`)
  expect(exported.status(), await exported.text()).toBe(200)
  const parsed = parseCsv(await exported.text())
  expect(parsed.errors).toEqual([])
  const [header, ...rows] = parsed.rows
  const records = rows.map(row => Object.fromEntries(header.map((column, index) => [column, row[index]])))
  expect(records).toHaveLength(3)
  const exportedTotals = records.map(record => (JSON.parse(record.calculations_json) as Ledger['responses'][number]['calculations']).find(value => value.id === totalId)?.value)
  expect(exportedTotals.sort((a, b) => Number(a) - Number(b))).toEqual([48, 64, 128])
  // Malformed destinations originate only at the paid provider edge. Pencil's real
  // receipt and child validation run unchanged; no application route is replaced.
  const invalidHost = await nativeHost(`<script async src="${pencil}/embed.js?flow=${slug}"></script>`)
  await call('/api/app/workspace', 'PUT', { ...workspace, embedAllowedOrigins: [host.origin, invalidHost.origin] })
  try {
    for (const checkoutOrigin of ['https://checkout.stripe.com.hostile.invalid', 'http://checkout.stripe.com']) {
      stripe.setCheckoutOrigin(checkoutOrigin)
      const invalidContext = await browser.newContext({ extraHTTPHeaders: {}, viewport: info.project.name === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 900 } })
  invalidContext.on('page',observePage)
      try {
        const invalid = await invalidContext.newPage()
        const outside: string[] = []
        invalid.on('request', request => { if (![pencil, invalidHost.origin].includes(new URL(request.url()).origin)) outside.push(request.url()) })
        const loaded = formLoad(invalid)
        await invalid.goto(invalidHost.origin)
        const child = invalid.frameLocator('iframe')
        await child.getByRole('spinbutton', { name: quantity.prompt, exact: true }).fill('3')
        await child.getByRole('button', { name: 'Continue', exact: true }).click()
        await child.getByRole('radio', { name: 'Yes', exact: true }).check()
        await submissionWindow(loaded)
        await child.getByRole('button', { name: 'Continue', exact: true }).click()
        await child.getByRole('button', { name: 'Pay $48.00 with Stripe', exact: true }).click()
        await expect(child.getByRole('alert')).toHaveText('Stripe Checkout details could not be verified. Your saved answers remain pending payment.')
        expect(invalid.url()).toBe(`${invalidHost.origin}/`)
        expect(await invalid.evaluate(() => (window as unknown as { messages: Array<{ type?: string }> }).messages.filter(message => message.type === 'pencil:checkout'))).toEqual([])
        expect(outside).toEqual([])
        await captureEmbed(invalid,checkoutOrigin.startsWith('http:')?'refused-http':'refused-origin')
        expect(await invalid.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
        expect((await new AxeBuilder({page:invalid}).analyze()).violations.filter(violation=>violation.impact==='serious'||violation.impact==='critical')).toEqual([])
        const rejected = [...stripe.sessions.values()].find(session => session.url.startsWith(`${checkoutOrigin}/`))!
        expect(rejected).toBeDefined()
        expect((await invalid.request.post(`${stripe.origin}/v1/checkout/sessions/${rejected.id}/expire`, { headers: { Authorization: `Bearer ${stripeFixture.secretKey}` } })).status()).toBe(200)
        expect((await page.request.delete(`/api/app/responses/${rejected.metadata.pencil_response}`)).status()).toBe(204)
      } finally { await invalidContext.close() }
    }
  } finally { stripe.useStripeCheckoutOrigin(); await invalidHost.close(); await call('/api/app/workspace', 'PUT', workspace) }
  // An allowed host can omit the script acknowledgement. Its opaque frame must
  // offer a user-activated top-level continuation instead of silently stranding payment.
  const fallbackChallenge = crypto.randomUUID().replaceAll('-', '')
  const fallbackHost = await nativeHost(`<iframe title="Feedback form" sandbox="allow-scripts allow-forms allow-top-navigation-by-user-activation" referrerpolicy="origin" style="width:100%;height:900px;border:0" src="${pencil}/embed/${slug}#pencil-embed=${fallbackChallenge}"></iframe>`)
  const fallbackContext = await browser.newContext({ extraHTTPHeaders: {}, viewport: info.project.name === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 900 } })
  fallbackContext.on('page',observePage)
  let fallbackResponseId: string | undefined
  try {
    await call('/api/app/workspace', 'PUT', { ...workspace, embedAllowedOrigins: [fallbackHost.origin] })
    await fallbackContext.route('https://checkout.stripe.com/**', route => route.fulfill({ status: 302, headers: { location: `${stripe.origin}${new URL(route.request().url()).pathname}` } }))
    const fallback = await fallbackContext.newPage()
    const loaded = formLoad(fallback)
    await fallback.goto(fallbackHost.origin)
    const child = fallback.frameLocator('iframe')
    await child.getByRole('spinbutton', { name: quantity.prompt, exact: true }).fill('3')
    await child.getByRole('button', { name: 'Continue', exact: true }).click()
    await child.getByRole('radio', { name: 'Yes', exact: true }).check()
    await submissionWindow(loaded)
    await child.getByRole('button', { name: 'Continue', exact: true }).click()
    const previousSessions = new Set(stripe.sessions.keys())
    await child.getByRole('button', { name: 'Pay $48.00 with Stripe', exact: true }).click()
    const continuation = child.getByRole('link', { name: 'Continue to Stripe Checkout', exact: true })
    await expect(continuation).toBeVisible()
    await expect(continuation).toHaveAttribute('target', '_top')
    const fallbackCheckout = [...stripe.sessions.values()].find(session => !previousSessions.has(session.id))
    expect(fallbackCheckout).toBeDefined()
    fallbackResponseId = fallbackCheckout!.metadata.pencil_response
    await expect(continuation).toHaveAttribute('href', fallbackCheckout!.url)
    expect(fallback.url()).toBe(`${fallbackHost.origin}/`)
    expect(await fallback.evaluate(() => (window as unknown as { messages: Array<{ type?: string }> }).messages.filter(message => message.type === 'pencil:checkout'))).toEqual([])
    expect(await fallback.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
    expect((await new AxeBuilder({page:fallback}).analyze()).violations.filter(violation=>violation.impact==='serious'||violation.impact==='critical')).toEqual([])
    await captureEmbed(fallback,'missing-ack')
    const fallbackPath = info.outputPath(`embed-missing-ack-${info.project.name}.png`)
    await fallback.screenshot({ path: fallbackPath, fullPage: true })
    await info.attach(`Embed missing acknowledgement · ${info.project.name}`, { path: fallbackPath, contentType: 'image/png' })
    await continuation.click()
    await expect(fallback).toHaveURL(`${stripe.origin}/pay/${fallbackCheckout!.id}`)
    expect(fallback.frames()).toHaveLength(1)
    expect(fallbackContext.pages()).toHaveLength(1)
    await fallback.getByRole('button', { name: 'Pay $48.00', exact: true }).click()
    await expect(fallback.getByRole('heading', { name: 'Standard order · Total 48', exact: true })).toBeVisible()
    await expect(fallback.getByText(/Your payment is received\./)).toBeVisible()
    expect(fallbackCheckout!.status).toBe('complete')
  } finally {
    if (fallbackResponseId) expect((await page.request.delete(`/api/app/responses/${fallbackResponseId}`)).status()).toBe(204)
    await fallbackContext.close(); await fallbackHost.close(); await call('/api/app/workspace', 'PUT', workspace)
  }
  expect(hydrationErrors).toEqual([])
  // PAY-005: the existing calculated form also takes an undiscounted $40 order.
  stripe.setCheckoutOrigin(stripe.origin)
  const refundCdp=await page.context().newCDPSession(page)
  await refundCdp.send('Emulation.setCPUThrottlingRate',{rate:4})
  try {
    const secondLoad=formLoad(page)
    await page.goto(`/f/${slug}`)
    await page.getByRole('spinbutton',{name:quantity.prompt,exact:true}).fill('2')
    await page.getByRole('button',{name:'Continue',exact:true}).click()
    await page.getByRole('radio',{name:'No',exact:true}).check()
    await submissionWindow(secondLoad)
    await page.getByRole('button',{name:'Continue',exact:true}).click()
    await page.getByRole('button',{name:/Pay.*40/}).click()
    await expect(page.getByRole('heading',{name:'Test checkout',exact:true})).toBeVisible()
    await page.getByRole('button',{name:'Pay $40.00',exact:true}).click()
    await expect(page.getByText(/Your payment is received\./)).toBeVisible()
    await page.goto(`/app/flows/${flow.id}/results`)
    await page.getByRole('button',{name:'View answers',exact:true}).first().click()
    await page.getByRole('link',{name:'View payments and refunds',exact:true}).click()
    await expect(page.getByRole('heading',{name:'Payments',exact:true})).toBeVisible()
    const row=page.locator('.payments-row').filter({hasText:'Charged $40.00'})
    await row.getByRole('button',{name:'Refund payment',exact:true}).click()
    await page.getByLabel('Refund amount (USD)',{exact:true}).fill('10')
    await page.getByLabel('I confirm a refund of $10.00',{exact:true}).check()
    await page.screenshot({path:info.outputPath(`refund-confirm-${info.project.name}.png`),fullPage:true})
    await page.getByRole('button',{name:'Issue refund',exact:true}).click()
    await expect(row).toContainText('Partially refunded')
    await expect(row).toContainText('Refunded $10.00')
    await expect(row).toContainText('Card · ending 4242')
    await page.getByLabel('Status',{exact:true}).selectOption('partially_refunded')
    await expect(page.locator('.payments-row')).toHaveCount(1)
    const exported=await page.request.get('/api/app/payments?format=csv&state=partially_refunded')
    expect(exported.ok()).toBe(true)
    expect(await exported.text()).toContain('"4000","4000","1000","card","4242"')
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
    await page.screenshot({path:info.outputPath(`refund-ledger-${info.project.name}.png`),fullPage:true})
    await page.getByText('Reconcile with Stripe',{exact:true}).click()
    await page.getByRole('button',{name:'Reconcile period',exact:true}).click()
    await expect(page.getByText('Totals match.',{exact:true})).toBeVisible()
    await page.screenshot({path:info.outputPath(`reconcile-${info.project.name}.png`),fullPage:true})
    // PAY-003: author both modes in the payment-owned settings and read their public response records.
    for(const mode of ['subscription','donation'] as const) {
      await page.goto(`/app/flows/${flow.id}/builder`)
      await page.locator('.step-button').filter({hasText:standardPay.prompt}).click()
      await expect(page.getByRole('region',{name:'Payment pricing',exact:true})).toBeVisible()
      await page.getByLabel('Payment mode',{exact:true}).selectOption(mode)
      await page.getByRole('radio',{name:'Products and option prices',exact:true}).check()
      if(!await page.getByLabel('Product 1 price (USD)',{exact:true}).count())await page.getByRole('button',{name:'Add product',exact:true}).click()
      await page.getByLabel('Product 1 price (USD)',{exact:true}).fill('40')
      await page.getByLabel('Minimum charge (USD)',{exact:true}).fill('10')
      await page.getByLabel('Maximum charge (USD)',{exact:true}).fill('100')
      if(mode==='subscription') {
        await page.getByLabel('Stripe price ID',{exact:true}).fill('synthetic-pencil-1')
        await page.getByLabel('Billing interval',{exact:true}).selectOption('month')
      } else await page.getByLabel('Choose custom amount on Stripe',{exact:true}).check()
      await page.getByRole('button',{name:'Save',exact:true}).click()
      await expect(page.getByText('Saved.',{exact:true})).toBeVisible()
      await page.getByRole('region',{name:'Payment pricing',exact:true}).screenshot({path:info.outputPath(`${mode}-settings-${info.project.name}.png`)})
      await call(`${base}/publish`,'POST',{expectedVersion:(await read()).flow.draftVersion})
      const loaded=formLoad(page)
      await page.goto(`/f/${slug}`)
      await page.getByRole('spinbutton',{name:quantity.prompt,exact:true}).fill('2')
      await page.getByRole('button',{name:'Continue',exact:true}).click()
      await page.getByRole('radio',{name:'No',exact:true}).check()
      await submissionWindow(loaded)
      await page.getByRole('button',{name:'Continue',exact:true}).click()
      if(mode==='donation')await expect(page.getByText('Choose your amount on Stripe',{exact:true})).toBeVisible()
      await page.getByRole('button',{name:/Pay.*40/}).click()
      await expect(page.getByRole('heading',{name:'Test checkout',exact:true})).toBeVisible()
      await page.getByRole('button',{name:'Pay $40.00',exact:true}).click()
      await expect(page.getByText(/Your payment is received\./)).toBeVisible()
      await page.goto(`/app/flows/${flow.id}/results`)
      await page.getByRole('button',{name:'View answers',exact:true}).first().click()
      const record=page.getByRole('region',{name:'Payment',exact:true})
      await expect(record).toContainText(mode==='subscription'?'Subscription':'Donation')
      if(mode==='subscription') {
        await expect(record).toContainText('active')
        const subscription=[...stripe.sessions.values()].filter(row=>row.subscription).at(-1)!
        await stripe.event('customer.subscription.deleted',{id:subscription.subscription,metadata:subscription.metadata})
        await page.reload()
        await page.getByRole('button',{name:'View answers',exact:true}).first().click()
        await expect(record).toContainText('canceled')
        await expect(record).toContainText('Stripe customer portal')
      }
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
      await record.screenshot({path:info.outputPath(`${mode}-record-${info.project.name}.png`)})
    }
    // PAY-004: Checkout bank payment returns processing, and a signed settlement updates the record.
    await page.goto(`/app/flows/${flow.id}/builder`)
    await page.locator('.step-button').filter({hasText:standardPay.prompt}).click()
    await page.getByLabel('Payment mode',{exact:true}).selectOption('one_time')
    await page.getByLabel('Offer ACH bank payments',{exact:true}).check()
    await page.getByRole('button',{name:'Save',exact:true}).click()
    await expect(page.getByText('Saved.',{exact:true})).toBeVisible()
    await page.getByRole('region',{name:'Payment pricing',exact:true}).screenshot({path:info.outputPath(`ach-settings-${info.project.name}.png`)})
    await call(`${base}/publish`,'POST',{expectedVersion:(await read()).flow.draftVersion})
    const bankLoad=formLoad(page)
    await page.goto(`/f/${slug}`)
    await page.getByRole('spinbutton',{name:quantity.prompt,exact:true}).fill('2')
    await page.getByRole('button',{name:'Continue',exact:true}).click()
    await page.getByRole('radio',{name:'No',exact:true}).check()
    await submissionWindow(bankLoad)
    await page.getByRole('button',{name:'Continue',exact:true}).click()
    await page.getByRole('button',{name:/Pay.*40/}).click()
    await page.getByRole('button',{name:'Pay $40.00',exact:true}).click()
    await expect(page.getByText(/Stripe is confirming your payment/)).toBeVisible()
    await page.goto(`/app/flows/${flow.id}/results`)
    await page.getByRole('button',{name:'View answers',exact:true}).first().click()
    const bankRecord=page.getByRole('region',{name:'Payment',exact:true})
    await expect(bankRecord).toContainText('Payment processing')
    await bankRecord.screenshot({path:info.outputPath(`ach-processing-${info.project.name}.png`)})
    const bank=[...stripe.sessions.values()].filter(row=>row.ach).at(-1)!
    bank.payment_status='paid'
    await stripe.event('checkout.session.async_payment_succeeded',bank)
    await stripe.event('charge.succeeded',{id:'synthetic-pencil-1',payment_intent:bank.payment_intent,payment_method_details:{type:'us_bank_account',us_bank_account:{last4:'6789'}}})
    await page.reload()
    await page.getByRole('button',{name:'View answers',exact:true}).first().click()
    await expect(bankRecord).toContainText('Paid')
    await expect(bankRecord).toContainText('US bank account (ACH) · ending 6789')
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
    await bankRecord.screenshot({path:info.outputPath(`ach-paid-${info.project.name}.png`)})
  } finally { await refundCdp.detach() }
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
    const loaded = formLoad(page)
    await page.goto(`/f/${slug}`)
    await page.getByRole('spinbutton', { name: weight.prompt, exact: true }).fill(kilograms)
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await page.getByRole('spinbutton', { name: height.prompt, exact: true }).fill('1.75')
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await page.getByRole('radio', { name: 'No', exact: true }).check()
    await submissionWindow(loaded)
    await page.getByRole('button', { name: 'Submit response', exact: true }).click()
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
    await screenshot(`completed-${state}`)
  }
  const ledger = await call<Ledger>(`${base}/ledger`)
  expect(ledger.responses.map(response => response.calculations.find(value => value.id === 'bmi')?.value).sort((a, b) => Number(a) - Number(b))).toEqual([23, 31.1])
})

contract('PAY-002', 'authors Checkout tax, coupon and receipt settings and reads the signed totals on the response', async ({ page, context }, info) => {
  const cdp = await context.newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  const stripe = await startStripeReceiver(new URL(process.env.PENCIL_E2E_BASE_URL!).origin)
  try {
    await signInEmptyWorkspace(page)
    const call = async <T,>(path: string, method = 'GET', data?: unknown) => {
      const response = await page.request.fetch(path, { method, ...(data === undefined ? {} : { data }) })
      expect(response.status(), await response.text()).toBeLessThan(300)
      return response.json() as Promise<T>
    }
    await call('/api/app/connections/payment', 'PUT', { secretKey: stripeFixture.secretKey, webhookSecret: stripeFixture.webhookSecret })
    const slug = `tax-order-${info.project.name}-${Date.now()}`
    const { id } = await call<{ id: string }>('/api/app/flows', 'POST', { title: 'Tax and coupon order', slug })
    const base = `/api/app/flows/${id}`, read = () => call<BuilderDraft>(`${base}/draft`)
    for (const step of [
      { kind: 'question', questionType: 'short_text', prompt: 'Order reference', required: true },
      { kind: 'completion', questionType: null, prompt: 'Order received' },
    ]) await call(`${base}/draft/steps`, 'POST', { expectedVersion: (await read()).flow.draftVersion, step })
    await page.goto(`/app/flows/${id}/builder`)
    await expect(page.locator('.operator-shell[data-hydrated=true]')).toBeVisible()
    await page.getByRole('button', { name: 'Add payment step', exact: true }).click()
    await expect(page.getByRole('region', { name: 'Payment pricing', exact: true })).toBeVisible()
    await page.getByLabel('Prompt', { exact: true }).fill('Pay order')
    await page.getByRole('button', { name: 'Add product', exact: true }).click()
    await page.getByLabel('Product 1 price (USD)', { exact: true }).fill('40')
    await page.getByLabel('Use Stripe Tax', { exact: true }).check()
    await page.getByLabel('Allow promotion codes', { exact: true }).check()
    await expect(page.getByLabel('Stripe coupon ID', { exact: true })).toBeDisabled()
    await page.getByLabel('Allow promotion codes', { exact: true }).uncheck()
    await page.getByLabel('Stripe coupon ID', { exact: true }).fill('synthetic-pencil-1')
    await page.getByLabel('Collect email for Stripe receipts', { exact: true }).check()
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByText('Saved.', { exact: true })).toBeVisible()
    const draft = await read(), payment = draft.steps.find(step => step.kind === 'payment')!, question = draft.steps.find(step => step.kind === 'question')!, completion = draft.steps.find(step => step.kind === 'completion')!
    expect(payment.questionSettings?.payment).toMatchObject({ automaticTax: true, promotionCodes: false, couponId: 'synthetic-pencil-1', receipts: true })
    await expect(page.getByLabel('Use Stripe Tax', { exact: true })).toBeChecked()
    await page.screenshot({ path: info.outputPath(`checkout-settings-${info.project.name}.png`), fullPage: true })
    await call(`${base}/draft`, 'PUT', { expectedVersion: draft.flow.draftVersion, stepId: question.id, prompt: question.prompt, required: true, nextStepId: payment.id })
    await call(`${base}/draft`, 'PUT', { expectedVersion: (await read()).flow.draftVersion, stepId: payment.id, prompt: payment.prompt, required: false, nextStepId: completion.id })
    await call(`${base}/publish`, 'POST', { expectedVersion: (await read()).flow.draftVersion })
    const load = formLoad(page)
    await page.goto(`/f/${slug}`)
    await submissionWindow(load)
    await page.getByRole('textbox', { name: 'Order reference', exact: true }).fill('synthetic-pencil-1')
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await page.getByRole('button', { name: /Pay.*40/ }).click()
    await expect(page.getByRole('heading', { name: 'Test checkout', exact: true })).toBeVisible()
    const session = [...stripe.sessions.values()].find(session => session.client_reference_id)!
    session.total_details = { amount_discount: 500, amount_tax: 280 }
    session.amount_total = 3780
    await page.reload()
    await page.getByRole('button', { name: 'Pay $37.80', exact: true }).click()
    await expect(page.getByText(/Your payment is received\./)).toBeVisible()
    await page.goto(`/app/flows/${id}/results`)
    await page.getByRole('button', { name: 'View answers', exact: true }).first().click()
    const record = page.getByRole('region', { name: 'Payment', exact: true })
    for (const amount of ['$40.00', '$5.00', '$2.80', '$37.80']) await expect(record).toContainText(amount)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: info.outputPath(`checkout-record-${info.project.name}.png`), fullPage: true })
  } finally { await stripe.close(); await cdp.detach() }
})
