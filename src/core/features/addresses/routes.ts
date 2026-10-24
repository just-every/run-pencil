import type { Hono } from 'hono'
import { z } from 'zod'
import type { WorkerEnvironment } from '../../app/environment'
import { resourceId, validateInput } from '../../shared/validation'

export function registerAddressRoutes(app: Hono<WorkerEnvironment>) {
  app.put('/api/app/flows/:flowId/address',validateInput('param',z.object({flowId:resourceId})),validateInput('json',z.object({slug:z.string().min(1).max(120),expectedSlug:z.string().min(1).max(120)}).strict()),async c => {
    const {slug,expectedSlug}=c.req.valid('json')
    return c.json(await c.get('services').addresses.rename(c.get('operatorSession').workspaceId,c.req.valid('param').flowId,expectedSlug,slug))
  })
}
