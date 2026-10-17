import type { Context, Hono } from 'hono'
import { z } from 'zod'
import type { WorkerEnvironment } from '../../app/environment'
import { emptyMutationBody, resourceId, validateInput } from '../../shared/validation'
import { reportDashboardSchema, reportViewCreateSchema } from './model'
import { ReportViews } from './service'

/** Mounted behind native operator-session middleware; no client identity is accepted. */
export function registerReportViewRoutes(app: Hono<WorkerEnvironment>) {
  const flow = z.object({flowId:resourceId}), selected = flow.extend({viewId:resourceId})
  const service = (c: Context<WorkerEnvironment>) => {
    const {workspaceId,operatorId} = c.get('operatorSession')
    return new ReportViews(c.get('platform').databaseBinding,{workspaceId,operatorId,flowId:c.req.param('flowId')!})
  }
  app.get('/api/app/flows/:flowId/report-views',validateInput('param',flow),async c=>c.json(await service(c).list()))
  app.post('/api/app/flows/:flowId/report-views',validateInput('param',flow),validateInput('json',reportViewCreateSchema),async c=>c.json(await service(c).create(c.req.valid('json')),201))
  app.get('/api/app/flows/:flowId/report-views/:viewId',validateInput('param',selected),async c=>c.json(await service(c).get(c.req.valid('param').viewId)))
  app.delete('/api/app/flows/:flowId/report-views/:viewId',validateInput('param',selected),emptyMutationBody,async c=>{await service(c).erase(c.req.valid('param').viewId);return c.body(null,204)})
  app.put('/api/app/flows/:flowId/report-dashboard',validateInput('param',flow),validateInput('json',reportDashboardSchema),async c=>c.json(await service(c).arrange(c.req.valid('json'))))
}
