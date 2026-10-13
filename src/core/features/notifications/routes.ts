import type { Hono } from 'hono'
import { z } from 'zod'
import type { WorkerEnvironment } from '../../app/environment'
import type { RequestServices } from '../../app/request-context'
import { resourceId, validateInput } from '../../shared/validation'
export function registerNotificationRoutes(app: Hono<WorkerEnvironment>, services: RequestServices) {
  app.get('/api/app/flows/:flowId/notifications',validateInput('param',z.object({flowId:resourceId})),async c => {
    const session=c.get('operatorSession')
    return c.json(await services(c).notifications.preferences.read(session.workspaceId,c.req.param('flowId'),session.operatorId))
  })
  app.put('/api/app/flows/:flowId/notifications',validateInput('param',z.object({flowId:resourceId})),validateInput('json',z.object({mode:z.enum(['immediately','off'])}).strict()),async c => {
    const session=c.get('operatorSession')
    return c.json(await services(c).notifications.preferences.set(session.workspaceId,c.req.param('flowId'),session.operatorId,c.req.valid('json').mode))
  })
  app.post('/api/app/notifications/:id/retry',validateInput('param',z.object({id:resourceId})),validateInput('json',z.object({duplicateRiskAccepted:z.boolean()}).strict()),async c => {
    const session=c.get('operatorSession')
    await services(c).notifications.preferences.retry(session.workspaceId,session.operatorId,c.req.param('id'),c.req.valid('json').duplicateRiskAccepted)
    return c.body(null,204)
  })
}
