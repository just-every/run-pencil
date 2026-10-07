import type { Hono } from 'hono'
import { z } from 'zod'
import { validateInput, resourceId } from '../../shared/validation'
import type { WorkerEnvironment } from '../../app/environment'
import type { RequestServices } from '../../app/request-context'
export function registerDistributionRoutes(app: Hono<WorkerEnvironment>, services: RequestServices) {
  app.get('/api/app/distribution/contacts', async c => c.json(await services(c).distribution.contacts.list(c.get('operatorSession').workspaceId)))
  app.post('/api/app/distribution/contacts', validateInput('json', z.object({ name: z.string().trim().min(1).max(200), email: z.email().max(320) })), async c => c.json(await services(c).distribution.contacts.save(c.get('operatorSession').workspaceId, c.req.valid('json')), 201))
  app.post('/api/app/distribution/contacts/:id/erase', validateInput('param', z.object({ id: resourceId })), validateInput('json', z.object({ confirm: z.literal(true) })), async c => {
    const operator = c.get('operatorSession')
    await services(c).distribution.contacts.erase(operator.workspaceId, c.req.param('id'), operator.operatorId)
    return c.body(null, 204)
  })
  app.post('/api/app/distribution/contacts/:id/consent', validateInput('param', z.object({ id: resourceId })), validateInput('json', z.object({ renewed: z.boolean(), source: z.string().trim().min(1).max(200) })), async c => {
    const operator = c.get('operatorSession')
    await services(c).distribution.contacts.consent({ workspaceId: operator.workspaceId, contactId: c.req.param('id'), actor: operator.operatorId, ...c.req.valid('json') })
    return c.body(null, 204)
  })
  app.get('/api/app/flows/:flowId/distribution', validateInput('param', z.object({ flowId: resourceId })), async c => c.json({ sender: { available: true, message: 'Delivery uses the configured mail provider. Queued is not sent; each attempt and outcome is recorded below.' }, participants: await services(c).distribution.launches.list(c.get('operatorSession').workspaceId, c.req.param('flowId')) }))
  app.post('/api/app/flows/:flowId/distribution', validateInput('param', z.object({ flowId: resourceId })), validateInput('json', z.object({ contactIds: z.array(resourceId).min(1).max(1000), commandKey: z.string().min(12).max(200) })), async c => {
    const operator = c.get('operatorSession')
    const launch = await services(c).distribution.launches.launch({ workspaceId: operator.workspaceId, operatorId: operator.operatorId, flowId: c.req.param('flowId'), ...c.req.valid('json') })
    await services(c).distribution.dispatcher.run()
    return c.json(launch, 201)
  })
  app.post('/api/app/distribution/deliveries/:id/retry', validateInput('param', z.object({ id: resourceId })), validateInput('json', z.object({ duplicateRiskAccepted: z.boolean() })), async c => {
    const operator = c.get('operatorSession')
    await services(c).distribution.deliveries.retry(operator.workspaceId, c.req.param('id'), operator.operatorId, c.req.valid('json').duplicateRiskAccepted)
    await services(c).distribution.dispatcher.run()
    return c.body(null, 204)
  })
  app.post('/api/public/optout', validateInput('json', z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) })), async c => {
    await services(c).distribution.contacts.optOut(c.req.valid('json').token)
    return c.body(null, 204)
  })
}
