import type { Context, Hono } from 'hono'
import { z } from 'zod'
import type { WorkerEnvironment } from '../../app/environment'
import { PencilError, RateLimitError } from '../../shared/errors'
import { flowSlug, validateInput } from '../../shared/validation'

function failure(context: Context<WorkerEnvironment>, error: unknown) {
  if (error instanceof PencilError) return context.json({ error: error.code, message: error.message }, error instanceof RateLimitError ? 429 : error.code === 'NOT_FOUND' ? 404 : 400)
  throw error
}

export function registerPaymentRoutes(app: Hono<WorkerEnvironment>) {
  // Stripe's webhook. The raw body is verified against the saved signing secret before it is parsed; a forged or stale
  // event changes nothing, and an event is applied once by its ID.
  app.post('/api/public/payments/stripe', async context => {
    const result = await context.get('services').payments.webhook(await context.req.text(), context.req.header('Stripe-Signature'))
    return context.json({ received: result.status === 200, outcome: result.outcome }, result.status)
  })
  // The respondent's return from Stripe Checkout, carrying the attempt's own return key.
  app.post('/api/public/flows/:slug/payments/return', validateInput('param', z.object({ slug: flowSlug })), validateInput('json', z.object({ token: z.string().regex(/^[a-f0-9]{64}$/), outcome: z.enum(['success', 'cancel']) }).strict()), async context => {
    try {
      await context.get('services').responses.enforcePublicRequestRateLimit({ clientAddress: context.req.header('CF-Connecting-IP'), scope: 'session' })
      return context.json(await context.get('services').responses.payments.returnFromCheckout({ slug: context.req.param('slug'), ...context.req.valid('json') }))
    } catch (error) { return failure(context, error) }
  })
}
