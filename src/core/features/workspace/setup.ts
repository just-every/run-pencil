import type { Hono } from 'hono'
import { z } from 'zod'
import type { WorkerEnvironment } from '../../app/environment'
import type { PencilServices } from '../../app/services'
import { requireSameOriginRequest } from '../auth'
import { canonicalTimeZone } from '../../shared/ianaTimeZone'
// @ts-expect-error Maintained Base bounded duplicate-aware parser.
import { readInput } from '../../../base/operator-auth/input.mjs'

export async function unfinishedOwnerSetup(services: PencilServices, request: Request) {
  const native = await services.auth.native.getSession(request)
  if (!native || native.operator.role !== 'owner') return false
  const session = await services.auth.getSession(request)
  return Boolean(session && !(await services.workspace.setupState(session.workspaceId)).complete)
}

const inputSchema = z.object({ name: z.string().trim().min(1).max(100).regex(/^[^\x00-\x1f\x7f]+$/), timeZone: z.string().min(1).max(100).refine(value => !!canonicalTimeZone(value)) }).strict()
export function registerSetupRoutes(app: Hono<WorkerEnvironment>) {
  app.post('/setup', async context => {
    requireSameOriginRequest(context.req.raw)
    const services = context.get('services')
    const native = await services.auth.native.getSession(context.req.raw)
    const session = await services.auth.getSession(context.req.raw)
    if (!native || !session) return context.json({ error: 'AUTHENTICATION_REQUIRED' }, 401)
    if (native.operator.role !== 'owner') return context.json({ error: 'FORBIDDEN' }, 403)
    const body = await readInput(context.req.raw)
    const input = inputSchema.safeParse(body)
    if (!input.success) {
      if (context.req.header('Content-Type')?.startsWith('application/x-www-form-urlencoded')) {
        const search = new URLSearchParams({ invalid: input.error.issues[0]?.path[0] === 'timeZone' ? 'timeZone' : 'name' })
        for (const field of ['name', 'timeZone'] as const) if (typeof body[field] === 'string') search.set(field, body[field].slice(0, 100))
        return context.redirect(`/setup?${search}`, 303)
      }
      return context.json({ error: 'VALIDATION_ERROR', message: 'Enter a business name and choose a valid IANA time zone, such as UTC or America/Denver.' }, 400)
    }
    await services.workspace.completeSetup(session.workspaceId, input.data.name, input.data.timeZone)
    return context.redirect('/app', 303)
  })
}
