import { test, expect } from '/workspace/run-pencil/tests/e2e/fixtures'
import { signInEmptyWorkspace } from '/workspace/run-pencil/tests/e2e/authoring-helpers'
import { startStripeReceiver, stripeFixture } from '/workspace/run-pencil/tests/e2e/stripe-receiver'
import { provePaymentProcessing } from '/workspace/run-pencil/tests/e2e/payment-processing-proof'
import manifest from '/workspace/run-pencil/seed.json' with { type: 'json' }

test('public-door probe of the existing ACH processing helper', async ({ page }, info) => {
  test.setTimeout(120_000)
  const stripe = await startStripeReceiver(new URL(process.env.PENCIL_E2E_BASE_URL!).origin)
  try {
    await signInEmptyWorkspace(page)
    const call = async (path: string, method = 'GET', data?: unknown) => {
      const response = await page.request.fetch(path, { method, ...(data === undefined ? {} : { data }) })
      expect(response.status(), await response.text()).toBeLessThan(300)
      return response.json()
    }
    await call('/api/app/connections/payment', 'PUT', stripeFixture)
    const slug = `synthetic-pencil-${crypto.randomUUID()}`
    const flow = await call('/api/app/flows', 'POST', { title: 'synthetic-pencil-61', slug })
    const base = `/api/app/flows/${flow.id}`
    const read = () => call(`${base}/draft`)
    for (const step of [
      { kind: 'question', questionType: 'number', prompt: 'synthetic-pencil-61', required: true },
      { kind: 'completion', questionType: null, prompt: 'Response saved' },
    ]) await call(`${base}/draft/steps`, 'POST', { expectedVersion: (await read()).flow.draftVersion, step })
    const [question, completion] = (await read()).steps
    const added = await call(`${base}/draft/steps`, 'POST', { expectedVersion: (await read()).flow.draftVersion, step: {
      kind: 'payment', questionType: null, prompt: 'Pay by bank', nextStepId: completion.id,
      questionSettings: { payment: { products: [{ id: 'synthetic-pencil-1', name: 'Order', unitAmount: 4000 }], options: [], minimum: 50, maximum: 10000, ach: true } },
    } })
    await call(`${base}/draft`, 'PUT', { expectedVersion: (await read()).flow.draftVersion, stepId: question.id, prompt: question.prompt, required: true, nextStepId: added.step.id })
    await call(`${base}/publish`, 'POST', { expectedVersion: (await read()).flow.draftVersion })
    const loaded = page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/views') && response.request().method() === 'POST' && response.ok())
    await page.goto(`/f/${slug}`)
    await page.getByRole('spinbutton', { name: question.prompt, exact: true }).fill('2')
    const { loadTime } = await (await loaded).json()
    const at = Number(loadTime.split('.')[1])
    expect(Number.isSafeInteger(at)).toBe(true)
    await expect.poll(() => Date.now() - at).toBeGreaterThanOrEqual(manifest.limits.abuse.minimumSecondsFromFormLoadToSubmit * 1000)
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await provePaymentProcessing(page, info, stripe, flow.id, slug)
  } finally { await stripe.close() }
})
