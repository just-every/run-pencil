import type { Hono } from 'hono'
import { z } from 'zod'
import type { WorkerEnvironment } from '../../../app/environment'
import { resourceId, validateInput } from '../../../shared/validation'
import { crosstabInputSchema } from './model'
import { dimensionOptions } from './options'
import { crossTab } from './service'

export function registerCrosstabRoutes(app:Hono<WorkerEnvironment>) {
  const flow=z.object({flowId:resourceId}).strict()
  app.get('/api/app/flows/:flowId/crosstabs/options',validateInput('param',flow),validateInput('query',z.object({revisionId:resourceId}).strict()),async c=>
    c.json(await dimensionOptions(c.get('platform').databaseBinding,c.get('operatorSession').workspaceId,c.req.param('flowId'),c.req.valid('query'))))
  app.post('/api/app/flows/:flowId/crosstabs',validateInput('param',flow),validateInput('json',crosstabInputSchema),async c=>
    c.json(await crossTab(c.get('platform').databaseBinding,c.get('operatorSession').workspaceId,c.req.param('flowId'),c.req.valid('json'))))
}
