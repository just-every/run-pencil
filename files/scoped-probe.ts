import { test, expect } from '/home/agent/rer-consolidation/work/sd-pencil-c-f59/run-pencil/tests/e2e/fixtures'
import { signInEmptyWorkspace } from '/home/agent/rer-consolidation/work/sd-pencil-c-f59/run-pencil/tests/e2e/authoring-helpers'
import { startStripeReceiver, stripeFixture } from '/home/agent/rer-consolidation/work/sd-pencil-c-f59/run-pencil/tests/e2e/stripe-receiver'
import { provePaymentProcessing } from '/home/agent/rer-consolidation/work/sd-pencil-c-f59/run-pencil/tests/e2e/payment-processing-proof'
import type { BuilderDraft } from '/home/agent/rer-consolidation/work/sd-pencil-c-f59/run-pencil/src/core/app/api'

test('PAY-004 scoped native ACH processing probe', async ({ page, context }, info) => {
  test.setTimeout(180_000)
  page.setDefaultTimeout(20_000)
  const stripe = await startStripeReceiver(new URL(process.env.PENCIL_E2E_BASE_URL!).origin)
  const cdp = await context.newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  try {
    await signInEmptyWorkspace(page)
    const call = async <T,>(path: string, method = 'GET', data?: unknown) => {
      const response = await page.request.fetch(path, { method, ...(data === undefined ? {} : { data }) })
      expect(response.status(), await response.text()).toBeLessThan(300)
      return response.json() as Promise<T>
    }
    await call('/api/app/connections/payment', 'PUT', { secretKey: stripeFixture.secretKey, webhookSecret: stripeFixture.webhookSecret })
    const slug = `synthetic-pencil-processing-${info.project.name}-${Date.now()}`
    const flow = await call<{ id: string }>('/api/app/flows', 'POST', { title: 'Bank payment', slug })
    const base = `/api/app/flows/${flow.id}`, read = () => call<BuilderDraft>(`${base}/draft`)
    for (const step of [
      { kind: 'question', questionType: 'short_text', prompt: 'Order reference', required: true },
      { kind: 'completion', questionType: null, prompt: 'Order submitted' },
    ]) await call(`${base}/draft/steps`, 'POST', { expectedVersion: (await read()).flow.draftVersion, step })
    const [question, completion] = (await read()).steps
    await call(`${base}/draft/steps`, 'POST', { expectedVersion: (await read()).flow.draftVersion, step: { kind: 'payment', questionType: null, prompt: 'Pay by bank', required: false, nextStepId: completion.id, questionSettings: { payment: { products: [{ id: 'synthetic-pencil-1', name: 'Order', unitAmount: 4000 }], options: [], minimum: 50, maximum: 10000, ach: true } } } })
    const payment = (await read()).steps.find(step => step.kind === 'payment')!
    await call(`${base}/draft`, 'PUT', { expectedVersion: (await read()).flow.draftVersion, stepId: question.id, prompt: question.prompt, required: true, nextStepId: payment.id })
    await call(`${base}/publish`, 'POST', { expectedVersion: (await read()).flow.draftVersion })
    const loaded = page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/views') && response.request().method() === 'POST' && response.ok())
    await page.goto(`/f/${slug}`)
    const { loadTime } = await (await loaded).json() as { loadTime: string }
    await page.getByRole('textbox', { name: question.prompt, exact: true }).fill('synthetic-pencil-1')
    await expect.poll(() => Date.now() - Number(loadTime.split('.')[1])).toBeGreaterThanOrEqual(5000)
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await provePaymentProcessing(page, info, stripe, flow.id, slug)
  } finally { await cdp.detach(); await stripe.close() }
})
