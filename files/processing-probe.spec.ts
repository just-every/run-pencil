import manifest from '/workspace/run-pencil/seed.json' with { type: 'json' }
import { test, expect } from '/workspace/run-pencil/tests/e2e/fixtures'
import { signInEmptyWorkspace } from '/workspace/run-pencil/tests/e2e/authoring-helpers'
import { startStripeReceiver, stripeFixture } from '/workspace/run-pencil/tests/e2e/stripe-receiver'
import { provePaymentProcessing } from '/workspace/run-pencil/tests/e2e/payment-processing-proof'
import type { BuilderDraft } from '/workspace/run-pencil/src/core/app/api'

test('native ACH respondent processing public-door probe', async ({ page }, info) => {
  test.setTimeout(120_000)
  const stripe = await startStripeReceiver(new URL(process.env.PENCIL_E2E_BASE_URL!).origin)
  try {
    await signInEmptyWorkspace(page)
    const call = async <T,>(path: string, method = 'GET', data?: unknown) => {
      const response = await page.request.fetch(path, { method, ...(data === undefined ? {} : { data }) })
      expect(response.ok(), await response.text()).toBe(true)
      return response.json() as Promise<T>
    }
    await call('/api/app/connections/payment', 'PUT', stripeFixture)
    const slug = `processing-${info.project.name}-${Date.now()}`
    const flow = await call<{ id: string }>('/api/app/flows', 'POST', { title: 'ACH order', slug })
    const base = `/api/app/flows/${flow.id}`
    const read = () => call<BuilderDraft>(`${base}/draft`)
    for (const step of [
      { kind: 'question', questionType: 'short_text', prompt: 'Order reference', required: true },
      { kind: 'completion', questionType: null, prompt: 'Order received' },
    ]) await call(`${base}/draft/steps`, 'POST', { expectedVersion: (await read()).flow.draftVersion, step })
    const [question, completion] = (await read()).steps
    await call(`${base}/draft/steps`, 'POST', { expectedVersion: (await read()).flow.draftVersion, step: { kind: 'payment', questionType: null, prompt: 'Pay order', nextStepId: completion.id, questionSettings: { payment: { products: [{ id: 'synthetic-pencil-1', name: 'Order', unitAmount: 4000 }], options: [], minimum: 50, maximum: 10000, ach: true } } } })
    const payment = (await read()).steps.find(step => step.kind === 'payment')!
    await call(`${base}/draft`, 'PUT', { expectedVersion: (await read()).flow.draftVersion, stepId: question.id, prompt: question.prompt, required: true, nextStepId: payment.id })
    await call(`${base}/publish`, 'POST', { expectedVersion: (await read()).flow.draftVersion })
    const loaded = page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/views') && response.request().method() === 'POST' && response.ok())
    await page.goto(`/f/${slug}`)
    await page.getByRole('textbox', { name: 'Order reference', exact: true }).fill('synthetic-pencil-1')
    const { loadTime } = await (await loaded).json()
    await expect.poll(() => Date.now() - Number(loadTime.split('.')[1])).toBeGreaterThanOrEqual(manifest.limits.abuse.minimumSecondsFromFormLoadToSubmit * 1000)
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await provePaymentProcessing(page, info, stripe, flow.id, slug)
  } finally { await stripe.close() }
})
