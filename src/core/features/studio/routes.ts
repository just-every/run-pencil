import type { Hono } from 'hono'
import { z } from 'zod'
import type { WorkerEnvironment } from '../../app/environment'
import type { RequestServices } from '../../app/request-context'
import { createDatabase } from '../../platform/db/repository'
import { resourceId,validateInput } from '../../shared/validation'
import { FlowRepository } from '../flows'
import { providerStatus } from '../analysis'
import { studioInput,studySchema } from './model'
import { Studio } from './service'
export function registerStudioRoutes(app:Hono<WorkerEnvironment>,services:RequestServices) {
  const studio=(context:any)=>{const db=context.get('platform').databaseBinding as D1Database;return new Studio(db,new FlowRepository(createDatabase(db),db),services(context).analysis.provider)}
  app.get('/api/app/studio',async context=>context.json({provider:providerStatus(services(context).analysis.provider),forms:await studio(context).priorForms(context.get('operatorSession').workspaceId)}))
  app.post('/api/app/studio',validateInput('json',studioInput),async context=>{const session=context.get('operatorSession');return context.json(await studio(context).generate(session.workspaceId,session.operatorId,context.req.valid('json')),201)})
  app.get('/api/app/studio/:id',validateInput('param',z.object({id:resourceId})),async context=>context.json(await studio(context).get(context.get('operatorSession').workspaceId,context.req.param('id'))))
  app.put('/api/app/studio/:id',validateInput('param',z.object({id:resourceId})),validateInput('json',z.object({expectedVersion:z.number().int().nonnegative(),study:studySchema}).strict()),async context=>{const session=context.get('operatorSession'),input=context.req.valid('json');return context.json(await studio(context).saveStudy(session.workspaceId,session.operatorId,context.req.param('id'),input.expectedVersion,input.study))})
}
