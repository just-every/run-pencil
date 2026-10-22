import type { Hono } from 'hono'
import { z } from 'zod'
import type { WorkerEnvironment } from '../../app/environment'
import { validateInput } from '../../shared/validation'

export function registerPreviewRoutes(app: Hono<WorkerEnvironment>) {
  app.get('/api/app/flows/:flowId/preview-image', validateInput('param', z.object({flowId:z.string().regex(/^[A-Za-z0-9_-]{1,128}$/)})), validateInput('query',z.object({key:z.string().max(400)}).strict()), async c => {
    const {workspaceId}=c.get('operatorSession')
    await c.get('services').flows.getBuilderDraft(workspaceId,c.req.valid('param').flowId)
    return c.get('services').previewAssets.readOwned(workspaceId,c.req.valid('param').flowId,c.req.valid('query').key)
  })
  app.get('/api/public/previews/:revisionId/image', validateInput('param', z.object({ revisionId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/) })), async c => c.get('services').previews.image(c.req.valid('param').revisionId))
}
