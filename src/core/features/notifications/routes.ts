import type { Hono } from 'hono'
import { z } from 'zod'
import type { WorkerEnvironment } from '../../app/environment'
import type { RequestServices } from '../../app/request-context'
import { resourceId, validateInput } from '../../shared/validation'
export function registerNotificationRoutes(app: Hono<WorkerEnvironment>, services: RequestServices) {
  app.get('/api/app/answer-alerts',validateInput('query',z.object({flowId:resourceId.optional()})),async c=>{
    const session=c.get('operatorSession')
    return c.json(await services(c).notifications.answerAlerts.read(session.workspaceId,session.operatorId,c.req.valid('query').flowId))
  })
  app.post('/api/app/answer-alerts/:id/read',validateInput('param',z.object({id:resourceId})),async c=>{
    const session=c.get('operatorSession')
    await services(c).notifications.answerAlerts.acknowledge(session.workspaceId,session.operatorId,c.req.param('id'))
    return c.body(null,204)
  })
  app.post('/api/app/answer-alerts/:id/retry',validateInput('param',z.object({id:resourceId})),validateInput('json',z.object({duplicateRiskAccepted:z.boolean()}).strict()),async c=>{
    const session=c.get('operatorSession')
    await services(c).notifications.answerAlerts.retry(session.workspaceId,session.operatorId,c.req.param('id'),c.req.valid('json').duplicateRiskAccepted)
    return c.body(null,204)
  })
  app.get('/api/app/flows/:flowId/notifications',validateInput('param',z.object({flowId:resourceId})),async c => {
    const session=c.get('operatorSession')
    return c.json(await services(c).notifications.preferences.read(session.workspaceId,c.req.param('flowId'),session.operatorId))
  })
  app.put('/api/app/flows/:flowId/notifications',validateInput('param',z.object({flowId:resourceId})),validateInput('json',z.object({mode:z.enum(['immediately','daily','off'])}).strict()),async c => {
    const session=c.get('operatorSession')
    return c.json(await services(c).notifications.preferences.set(session.workspaceId,c.req.param('flowId'),session.operatorId,c.req.valid('json').mode))
  })
  app.post('/api/app/notifications/:id/retry',validateInput('param',z.object({id:resourceId})),validateInput('json',z.object({duplicateRiskAccepted:z.boolean()}).strict()),async c => {
    const session=c.get('operatorSession')
    await services(c).notifications.preferences.retry(session.workspaceId,session.operatorId,c.req.param('id'),c.req.valid('json').duplicateRiskAccepted)
    return c.body(null,204)
  })
}
