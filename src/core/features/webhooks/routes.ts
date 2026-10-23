import type { Hono } from 'hono'
import { z } from 'zod'
import type { WorkerEnvironment } from '../../app/environment'
import { requireConnectionOwner } from '../../app/connection-owner'
import { emptyMutationBody, resourceId, validateInput } from '../../shared/validation'
import { createEndpointSchema } from './model'

const endpointParam = validateInput('param', z.object({ endpointId: resourceId }))
const deliveryParam = validateInput('param', z.object({ deliveryId: resourceId }))
const deliveryQuery = validateInput('query', z.object({ endpointId: resourceId.optional(), status: z.enum(['pending', 'sending', 'confirmed', 'failed', 'cancelled']).optional() }))

/** INTEG-010: the owner registers, tests, pauses, rotates and removes endpoints; signed-in operators read the ledger. The signing secret is shown once. */
export function registerWebhookRoutes(app: Hono<WorkerEnvironment>) {
  const webhooks = (context: Parameters<typeof requireConnectionOwner>[0]) => context.get('services').webhooks
  app.get('/api/app/webhooks', async c => c.json({ endpoints: await webhooks(c).endpoints.list(c.get('operatorSession').workspaceId) }))
  app.get('/api/app/webhooks/alerts', async c => c.json({ alerts: await webhooks(c).endpoints.alerts(c.get('operatorSession').workspaceId) }))
  app.get('/api/app/webhooks/deliveries', deliveryQuery, async c => c.json({ deliveries: await webhooks(c).deliveries.list(c.get('operatorSession').workspaceId, c.req.valid('query')) }))
  app.get('/api/app/webhooks/:endpointId/undelivered', endpointParam, async c => {
    const { workspaceId } = c.get('operatorSession'), { endpointId } = c.req.valid('param')
    await webhooks(c).endpoints.require(workspaceId, endpointId)
    return c.json({ responses: await webhooks(c).deliveries.notDelivered(workspaceId, endpointId) })
  })
  app.post('/api/app/webhooks', validateInput('json', createEndpointSchema), async c => {
    await requireConnectionOwner(c)
    const { workspaceId, operatorId } = c.get('operatorSession')
    return c.json(await webhooks(c).endpoints.create(workspaceId, operatorId, c.req.valid('json')), 201)
  })
  app.post('/api/app/webhooks/:endpointId/rotate', endpointParam, emptyMutationBody, async c => {
    await requireConnectionOwner(c)
    return c.json(await webhooks(c).endpoints.rotate(c.get('operatorSession').workspaceId, c.req.valid('param').endpointId))
  })
  for (const [action, active] of [['pause', false], ['resume', true]] as const) {
    app.post(`/api/app/webhooks/:endpointId/${action}`, endpointParam, emptyMutationBody, async c => {
      await requireConnectionOwner(c)
      return c.json({ endpoint: await webhooks(c).endpoints.setActive(c.get('operatorSession').workspaceId, c.req.valid('param').endpointId, active) })
    })
  }
  app.delete('/api/app/webhooks/:endpointId', endpointParam, emptyMutationBody, async c => {
    await requireConnectionOwner(c)
    await webhooks(c).endpoints.remove(c.get('operatorSession').workspaceId, c.req.valid('param').endpointId)
    return c.body(null, 204)
  })
  app.post('/api/app/webhooks/:endpointId/test', endpointParam, emptyMutationBody, async c => {
    await requireConnectionOwner(c)
    const { workspaceId } = c.get('operatorSession'), { endpointId } = c.req.valid('param'), { endpoints, deliveries, dispatcher } = webhooks(c)
    const endpoint = await endpoints.require(workspaceId, endpointId)
    if (endpoint.state !== 'active') return c.json({ message: 'Resume the endpoint before sending a test event.' }, 409)
    const id = await deliveries.queueTest(workspaceId, endpointId)
    await dispatcher.sendNow(id)
    return c.json({ delivery: (await deliveries.list(workspaceId, { endpointId }, id))[0] })
  })
  app.post('/api/app/webhooks/deliveries/:deliveryId/replay', deliveryParam, emptyMutationBody, async c => {
    await requireConnectionOwner(c)
    const { workspaceId } = c.get('operatorSession'), { deliveryId } = c.req.valid('param'), { deliveries, dispatcher } = webhooks(c)
    await deliveries.replay(workspaceId, deliveryId)
    await dispatcher.sendNow(deliveryId)
    return c.json({ delivery: (await deliveries.list(workspaceId, {}, deliveryId))[0] })
  })
}
