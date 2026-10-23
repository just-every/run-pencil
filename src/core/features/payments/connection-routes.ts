import type { Hono } from 'hono'
import type { WorkerEnvironment } from '../../app/environment'
import { requireConnectionOwner } from '../../app/connection-owner'
import { paymentConnectionSchema } from '../../platform/config/connections'
import { emptyMutationBody, validateInput } from '../../shared/validation'
import { recordOperatorAudit } from '../audit'

/** PAY-001's Stripe connection, beside the task connection: only the owner saves, removes or tests it, and neither the
 * key nor the signing secret is ever returned. */
export function registerPaymentConnectionRoutes(app: Hono<WorkerEnvironment>) {
  const path = '/api/app/connections/payment'
  app.get(path, async c => c.json(await c.get('services').connections.paymentStatus()))
  app.put(path, validateInput('json', paymentConnectionSchema), async c => {
    await requireConnectionOwner(c); await c.get('services').connections.savePayment(c.req.valid('json'))
    await recordOperatorAudit(c, 'connection.saved', { type: 'connection' }, { connection: 'payment' })
    return c.json(await c.get('services').connections.paymentStatus())
  })
  app.delete(path, emptyMutationBody, async c => {
    await requireConnectionOwner(c); await c.get('services').connections.remove('payment')
    await recordOperatorAudit(c, 'connection.removed', { type: 'connection' }, { connection: 'payment' })
    return c.json(await c.get('services').connections.paymentStatus())
  })
  app.post(`${path}/test`, emptyMutationBody, async c => {
    await requireConnectionOwner(c)
    const result = await c.get('services').payments.testConnection()
    await recordOperatorAudit(c, 'connection.tested', { type: 'connection' }, { connection: 'payment' })
    return c.json(result)
  })
}
