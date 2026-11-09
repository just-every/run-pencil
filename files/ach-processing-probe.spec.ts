import { expect, test } from '/home/agent/rer-consolidation/work/sd-pencil-c-f60/run-pencil/tests/e2e/fixtures'
import { signInEmptyWorkspace } from '/home/agent/rer-consolidation/work/sd-pencil-c-f60/run-pencil/tests/e2e/authoring-helpers'
import { startStripeReceiver, stripeFixture } from '/home/agent/rer-consolidation/work/sd-pencil-c-f60/run-pencil/tests/e2e/stripe-receiver'
import { provePaymentProcessing } from '/home/agent/rer-consolidation/work/sd-pencil-c-f60/run-pencil/tests/e2e/payment-processing-proof'
import type { BuilderDraft } from '/home/agent/rer-consolidation/work/sd-pencil-c-f60/run-pencil/src/core/app/api'
import manifest from '/home/agent/rer-consolidation/work/sd-pencil-c-f60/run-pencil/seed.json' with { type: 'json' }

test('ad hoc native ACH processing public-door probe', async ({ page }, info) => {
  test.setTimeout(120_000)
  page.setDefaultTimeout(15_000)
  const stripe = await startStripeReceiver(new URL(process.env.PENCIL_E2E_BASE_URL!).origin)
  try {
    await signInEmptyWorkspace(page)
    const call = async <T,>(path: string, method = 'GET', data?: unknown) => {
      const response = await page.request.fetch(path, { method, ...(data === undefined ? {} : { data }) })
      expect(response.status(), await response.text()).toBeLessThan(300)
      return response.json() as Promise<T>
    }
    await call('/api/app/connections/payment', 'PUT', { secretKey: stripeFixture.secretKey, webhookSecret: stripeFixture.webhookSecret })
    const slug = `ach-processing-mobile-${Date.now()}`
    const { id } = await call<{ id: string }>('/api/app/flows', 'POST', { title: 'ACH processing proof', slug })
    const base = `/api/app/flows/${id}`
    const read = () => call<BuilderDraft>(`${base}/draft`)
    for (const step of [
      { kind: 'question', questionType: 'number', prompt: 'Quantity', required: true, questionSettings: { min: 1, max: 100, decimalPlaces: 0 } },
      { kind: 'completion', questionType: null, prompt: 'Order received' },
    ]) await call(`${base}/draft/steps`, 'POST', { expectedVersion: (await read()).flow.draftVersion, step })
    const [question, completion] = (await read()).steps
    await call(`${base}/draft/steps`, 'POST', { expectedVersion: (await read()).flow.draftVersion, step: { kind: 'payment', questionType: null, prompt: 'Pay by bank', nextStepId: completion.id, questionSettings: { payment: { products: [{ id: 'synthetic-pencil-1', name: 'Order', unitAmount: 4000 }], options: [], minimum: 50, maximum: 10000, ach: true } } } })
    const payment = (await read()).steps.find(step => step.kind === 'payment')!
    await call(`${base}/draft`, 'PUT', { expectedVersion: (await read()).flow.draftVersion, stepId: question.id, prompt: question.prompt, required: true, nextStepId: payment.id })
    await call(`${base}/publish`, 'POST', { expectedVersion: (await read()).flow.draftVersion })
    const load = page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/views') && response.request().method() === 'POST' && response.ok())
    await page.goto(`/f/${slug}`)
    const { loadTime } = await (await load).json()
    const at = Number(loadTime.split('.')[1])
    expect(Number.isSafeInteger(at)).toBe(true)
    await page.getByRole('spinbutton', { name: 'Quantity', exact: true }).fill('2')
    await expect.poll(() => Date.now() - at).toBeGreaterThanOrEqual(manifest.limits.abuse.minimumSecondsFromFormLoadToSubmit * 1000)
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await provePaymentProcessing(page, info, stripe, id, slug)
  } finally { await stripe.close() }
})
