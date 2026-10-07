import { z } from 'zod'
import { validateInput as zValidator, resourceId } from '../../shared/validation'
import type { Hono } from 'hono'
import type { WorkerEnvironment } from '../../app/environment'
import type { RequestServices } from '../../app/request-context'
const filter = z.object({ revisionId: resourceId.optional(), source: z.enum(['direct', 'embed', 'invitation', 'unknown']).optional(), participantStatus: z.enum(['eligible', 'opted-out', 'bounced']).optional(), from: z.string().datetime().optional(), to: z.string().datetime().optional(), answerStepId: resourceId.optional(), answerValue: z.string().max(5000).optional(), offset: z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0) })
export function registerReportingRoutes(app: Hono<WorkerEnvironment>, services: RequestServices) {
  app.get('/api/app/flows/:flowId/ledger', zValidator('param', z.object({ flowId: resourceId })), zValidator('query', filter), async (context) => {
    return context.json(await services(context).reporting.ledger(context.get('operatorSession').workspaceId, context.req.param('flowId'), context.req.valid('query')))
  })
  app.get('/api/app/flows/:flowId/questions', zValidator('param', z.object({ flowId: resourceId })), zValidator('query', z.object({ revisionId: resourceId })), async (context) => {
    return context.json(await services(context).reporting.questions(context.get('operatorSession').workspaceId, context.req.param('flowId'), context.req.valid('query').revisionId))
  })
  app.get('/api/app/flows/:flowId/questions/compare', zValidator('param', z.object({ flowId: resourceId })), async (context) => {
    return context.json(await services(context).reporting.compareRevisions(context.get('operatorSession').workspaceId, context.req.param('flowId')))
  })
  app.get('/api/app/flows/:flowId/responses/export', zValidator('param', z.object({ flowId: resourceId })), zValidator('query', filter), async (context) => {
    return context.json(await services(context).reporting.export(context.get('operatorSession').workspaceId, context.req.param('flowId'), context.req.valid('query')))
  })
}
