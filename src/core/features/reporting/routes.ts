import downloadWorker from './download-worker.js?raw'
import { textPage } from './textPage'
import { startExport, exportPart } from './export'
import { z } from 'zod'
import { validateInput as zValidator, resourceId } from '../../shared/validation'
import type { Hono } from 'hono'
import type { WorkerEnvironment } from '../../app/environment'
import type { RequestServices } from '../../app/request-context'
const filter = z.object({ revisionId: resourceId.optional(), source: z.enum(['direct', 'embed', 'invitation', 'unknown', 'imported']).optional(), participantStatus: z.enum(['eligible', 'opted-out', 'bounced']).optional(), from: z.string().datetime().optional(), to: z.string().datetime().optional(), answerStepId: resourceId.optional(), answerValue: z.string().max(5000).optional(), offset: z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0) })
export function registerReportingRoutes(app: Hono<WorkerEnvironment>, services: RequestServices) {
  app.get('/api/app/flows/:flowId/ledger', zValidator('param', z.object({ flowId: resourceId })), zValidator('query', filter), async (context) => {
    return context.json(await services(context).reporting.ledger(context.get('operatorSession').workspaceId, context.req.param('flowId'), context.req.valid('query')))
  })
  app.get('/api/app/flows/:flowId/questions', zValidator('param', z.object({ flowId: resourceId })), zValidator('query', z.object({ revisionId: resourceId })), async (context) => {
    return context.json(await services(context).reporting.questions(context.get('operatorSession').workspaceId, context.req.param('flowId'), context.req.valid('query').revisionId))
  })
  app.get('/api/app/flows/:flowId/questions/compare', zValidator('param', z.object({ flowId: resourceId })), zValidator('query',z.object({offset:z.coerce.number().int().min(0).max(99).default(0)})), async (context) => {
    return context.json(await services(context).reporting.compareRevisions(context.get('operatorSession').workspaceId, context.req.param('flowId'),context.req.valid('query').offset))
  })
  app.get('/api/app/flows/:flowId/questions/text', zValidator('param', z.object({ flowId: resourceId })), zValidator('query', z.object({ revisionId: resourceId, questionId: resourceId, search: z.string().max(5000).default(''), countOnly: z.enum(['true','false']).transform(value=>value === 'true').optional(), cursor: z.string().max(16000).optional() })), async context => {
    const session = context.get('operatorSession')
    return context.json(await textPage(context.get('platform').databaseBinding,context.get('platform').configuration.sessionSecret,{workspaceId:session.workspaceId,sessionId:session.id,flowId:context.req.param('flowId')},context.req.valid('query'),context.req.raw.signal))
  })
  app.post('/api/app/flows/:flowId/questions/text', zValidator('param', z.object({ flowId: resourceId })), zValidator('json', z.object({ revisionId: resourceId, questionId: resourceId, search: z.string().max(5000).default(''), countOnly: z.boolean().optional(), cursor: z.string().max(16000).optional() })), async context => {
    const session = context.get('operatorSession')
    return context.json(await textPage(context.get('platform').databaseBinding,context.get('platform').configuration.sessionSecret,{workspaceId:session.workspaceId,sessionId:session.id,flowId:context.req.param('flowId')},context.req.valid('json'),context.req.raw.signal))
  })
  app.get('/api/app/export-worker.js', context => new Response(downloadWorker, { headers: { 'Content-Type': 'text/javascript; charset=utf-8', 'Service-Worker-Allowed': '/app/exports/', 'Cache-Control':'no-store' } }))
  app.get('/api/app/flows/:flowId/responses/export/start', zValidator('param', z.object({flowId:resourceId})), zValidator('query',filter.extend({format:z.enum(['json','csv'])})), async context => {
    const session = context.get('operatorSession')
    const {format,...selected} = context.req.valid('query')
    return context.json(await startExport(context.get('platform').databaseBinding,context.get('platform').configuration.sessionSecret,{workspaceId:session.workspaceId,sessionId:session.id,flowId:context.req.param('flowId')},selected,format,context.req.raw.signal))
  })
  app.post('/api/app/flows/:flowId/responses/export/start', zValidator('param', z.object({flowId:resourceId})), zValidator('json',filter.extend({format:z.enum(['json','csv'])})), async context => {
    const session = context.get('operatorSession')
    const {format,...selected} = context.req.valid('json')
    return context.json(await startExport(context.get('platform').databaseBinding,context.get('platform').configuration.sessionSecret,{workspaceId:session.workspaceId,sessionId:session.id,flowId:context.req.param('flowId')},selected,format,context.req.raw.signal))
  })
  app.get('/api/app/flows/:flowId/responses/export', zValidator('param', z.object({flowId:resourceId})), zValidator('query',z.object({token:z.string().min(1).max(65536)})), async context => {
    const session = context.get('operatorSession')
    const part = await exportPart(context.get('platform').databaseBinding,context.get('platform').configuration.sessionSecret,{workspaceId:session.workspaceId,sessionId:session.id,flowId:context.req.param('flowId')},context.req.valid('query').token,context.req.raw.signal)
    return new Response(part.stream,{headers:{'Content-Type':'application/octet-stream','Cache-Control':'no-store','X-Export-Written':String(part.written),...(part.nextToken ? {'X-Export-Next':part.nextToken} : {})}})
  })
  app.post('/api/app/flows/:flowId/responses/export', zValidator('param', z.object({flowId:resourceId})), zValidator('json',z.object({token:z.string().min(1).max(65536)})), async context => {
    const session = context.get('operatorSession')
    const part = await exportPart(context.get('platform').databaseBinding,context.get('platform').configuration.sessionSecret,{workspaceId:session.workspaceId,sessionId:session.id,flowId:context.req.param('flowId')},context.req.valid('json').token,context.req.raw.signal)
    return new Response(part.stream,{headers:{'Content-Type':'application/octet-stream','Cache-Control':'no-store','X-Export-Written':String(part.written),...(part.nextToken ? {'X-Export-Next':part.nextToken} : {})}})
  })
}
