import type { Hono } from 'hono'
import { z } from 'zod'
import type { WorkerEnvironment } from '../../app/environment'
import type { RequestServices } from '../../app/request-context'
import { emptyMutationBody, resourceId, validateInput } from '../../shared/validation'
import { collectorId, collectorInput } from './model'
import type { CollectorService } from './service'

export type CollectorRequestServices = (...args: Parameters<RequestServices>) => ReturnType<RequestServices> & { collectors: CollectorService }
export function registerCollectorRoutes(app: Hono<WorkerEnvironment>, services: CollectorRequestServices) {
  const flow = z.object({ flowId: resourceId })
  const selected = flow.extend({ collectorId })
  app.get('/api/app/flows/:flowId/collectors', validateInput('param', flow), async c =>
    c.json(await services(c).collectors.list(c.get('operatorSession').workspaceId, c.req.param('flowId'))))
  app.get('/api/app/flows/:flowId/collectors/:collectorId', validateInput('param', selected), async c =>
    c.json(await services(c).collectors.get(c.get('operatorSession').workspaceId, c.req.param('flowId'), c.req.param('collectorId'))))
  app.post('/api/app/flows/:flowId/collectors', validateInput('param', flow), validateInput('json', collectorInput), async c => {
    const op = c.get('operatorSession')
    return c.json(await services(c).collectors.create({ workspaceId: op.workspaceId, operatorId: op.operatorId, flowId: c.req.param('flowId') }, c.req.valid('json')), 201)
  })
  app.put('/api/app/flows/:flowId/collectors/:collectorId', validateInput('param', selected), validateInput('json', collectorInput), async c => {
    const op = c.get('operatorSession')
    return c.json(await services(c).collectors.update({ workspaceId: op.workspaceId, operatorId: op.operatorId, flowId: c.req.param('flowId') }, c.req.param('collectorId'), c.req.valid('json')))
  })
  for (const action of ['close', 'reopen'] as const) app.post(`/api/app/flows/:flowId/collectors/:collectorId/${action}`, validateInput('param', selected), emptyMutationBody, async c => {
    const op = c.get('operatorSession')
    return c.json(await services(c).collectors.setClosed({ workspaceId: op.workspaceId, operatorId: op.operatorId, flowId: c.req.param('flowId') }, c.req.param('collectorId'), action === 'close'))
  })
  app.delete('/api/app/flows/:flowId/collectors/:collectorId', validateInput('param', selected), emptyMutationBody, async c => {
    const op = c.get('operatorSession')
    await services(c).collectors.erase({ workspaceId: op.workspaceId, operatorId: op.operatorId, flowId: c.req.param('flowId') }, c.req.param('collectorId'))
    return c.body(null, 204)
  })
}

