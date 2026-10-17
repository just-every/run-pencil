import type { Context, Hono } from 'hono'
import { z } from 'zod'
import type { WorkerEnvironment } from '../../app/environment'
import { resourceId, validateInput } from '../../shared/validation'
import { submissionBulkSchema, submissionReadSchema, submissionStatusSchema } from './model'
import type { SubmissionService } from './service'

/** Mount behind the app's native operator-session middleware. Every service call is scoped from that session. */
export function registerSubmissionRoutes(app: Hono<WorkerEnvironment>, service: (context: Context<WorkerEnvironment>) => SubmissionService) {
  const flow = validateInput('param', z.object({ flowId: resourceId }))
  const scope = (c: Context<WorkerEnvironment>) => { const { workspaceId, operatorId } = c.get('operatorSession'); return { workspaceId, operatorId, flowId: c.req.param('flowId')! } }
  app.get('/api/app/flows/:flowId/submissions/options', flow, async c => { const s = scope(c); return c.json(await service(c).options(s.workspaceId, s.flowId)) })
  app.post('/api/app/flows/:flowId/submissions/read', flow, validateInput('json', submissionReadSchema), async c => { const s = scope(c); return c.json(await service(c).read(s.workspaceId, s.flowId, c.req.valid('json').responseIds)) })
  app.post('/api/app/flows/:flowId/submissions/statuses', flow, validateInput('json', submissionStatusSchema), async c => { const s = scope(c); return c.json(await service(c).createStatus(s.workspaceId, s.flowId, s.operatorId, c.req.valid('json').name), 201) })
  app.post('/api/app/flows/:flowId/submissions/bulk', flow, validateInput('json', submissionBulkSchema), async c => { const s = scope(c); return c.json(await service(c).bulk(s.workspaceId, s.flowId, s.operatorId, c.req.valid('json'))) })
  app.get('/api/app/flows/:flowId/submissions/:responseId', validateInput('param', z.object({ flowId: resourceId, responseId: resourceId })), validateInput('query', z.object({ notesOffset: z.coerce.number().int().min(0).max(200).default(0) })), async c => {
    const s = scope(c); return c.json(await service(c).detail(s.workspaceId, s.flowId, c.req.valid('param').responseId, c.req.valid('query').notesOffset))
  })
}
