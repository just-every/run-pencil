import type { Context, Hono } from 'hono'
import { z } from 'zod'
import type { WorkerEnvironment } from '../../app/environment'
import { requireConnectionOwner } from '../../app/connection-owner'
import { PencilError, RateLimitError } from '../../shared/errors'
import { flowSlug, validateInput } from '../../shared/validation'

function failure(context: Context<WorkerEnvironment>, error: unknown) {
  if (error instanceof PencilError) return context.json({ error: error.code, message: error.message }, error instanceof RateLimitError ? 429 : error.code === 'NOT_FOUND' ? 404 : 400)
  throw error
}

export function registerPaymentRoutes(app: Hono<WorkerEnvironment>) {
  const states=z.enum(['pending','processing','paid','failed','expired','cancelled','partially_refunded','refunded'])
  app.get('/api/app/payments',validateInput('query',z.object({state:states.optional(),format:z.enum(['json','csv']).optional()})),async c=>{
    const {state,format}=c.req.valid('query')
    const rows=await c.get('services').payments.ledger(c.get('operatorSession').workspaceId,state)
    if(format==='csv') {
      const cell=(value:unknown)=>'"'+String(value??'').replaceAll('"','""')+'"'
      const columns=['responseId','provider','id','state','amount','total','refundedAmount','methodType','methodLast4','subscriptionStatus','at'] as const
      return c.body([columns.join(','),...rows.map(row=>columns.map(key=>cell(row[key])).join(','))].join('\r\n'),200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="payments.csv"'})
    }
    return c.json({payments:rows})
  })
  app.post('/api/app/payments/:responseId/refund',validateInput('json',z.object({amount:z.number().int().positive(),confirm:z.literal(true)}).strict()),async c=>{
    await requireConnectionOwner(c)
    return c.json(await c.get('services').payments.refund(c.get('operatorSession').workspaceId,c.req.param('responseId'),c.req.valid('json').amount))
  })
  app.post('/api/app/payments/reconcile',validateInput('json',z.object({period:z.string().max(10)}).strict()),async c=>{
    await requireConnectionOwner(c)
    return c.json(await c.get('services').payments.reconcile(c.get('operatorSession').workspaceId,c.req.valid('json').period))
  })
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
