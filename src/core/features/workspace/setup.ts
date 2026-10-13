import type { Hono } from 'hono'
import { z } from 'zod'
import type { WorkerEnvironment } from '../../app/environment'
import type { PencilServices } from '../../app/services'
import { requireSameOriginRequest } from '../auth'
// @ts-expect-error Maintained Base bounded duplicate-aware parser.
import { readInput } from '../../../base/operator-auth/input.mjs'

export async function unfinishedOwnerSetup(services: PencilServices, request: Request) {
  const native = await services.auth.native.getSession(request)
  if (!native || native.operator.role !== 'owner') return false
  const session = await services.auth.getSession(request)
  return Boolean(session && !(await services.workspace.setupState(session.workspaceId)).complete)
}

const inputSchema = z.object({ name: z.string().min(1).max(100), timeZone: z.string().min(1).max(100) }).strict()
export function registerSetupRoutes(app: Hono<WorkerEnvironment>) {
  app.post('/setup', async context => {
    requireSameOriginRequest(context.req.raw)
    const services = context.get('services')
    const native = await services.auth.native.getSession(context.req.raw)
    const session = await services.auth.getSession(context.req.raw)
    if (!native || !session) return context.json({ error: 'AUTHENTICATION_REQUIRED' }, 401)
    if (native.operator.role !== 'owner') return context.json({ error: 'FORBIDDEN' }, 403)
    const input = inputSchema.safeParse(await readInput(context.req.raw))
    if (!input.success) return context.json({ error: 'VALIDATION_ERROR' }, 400)
    await services.workspace.completeSetup(session.workspaceId, input.data.name, input.data.timeZone)
    return context.redirect('/app', 303)
  })
}
