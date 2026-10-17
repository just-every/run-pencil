import type { Hono, Context } from 'hono'
import { z } from 'zod'
import type { WorkerEnvironment } from '../../app/environment'
import { validateInput } from '../../shared/validation'
import { auditQuerySchema } from './model'
import { AuditReader } from './reader'

function reader(context: Context<WorkerEnvironment>) {
  const session = context.get('operatorSession'), platform = context.get('platform')
  return new AuditReader(platform.databaseBinding, platform.configuration.sessionSecret, { workspaceId: session.workspaceId, sessionId: session.id })
}

// Mounted beneath the app's native operator-session middleware. There are no
// audit mutation routes, role approximations or caller-supplied workspace IDs.
export function registerAuditRoutes(app: Hono<WorkerEnvironment>) {
  app.get('/api/app/audit/options', validateInput('query', z.object({ actorSearch: z.string().max(200).default(''), formSearch: z.string().max(200).default('') }).strict()), async context => {
    const { actorSearch, formSearch } = context.req.valid('query')
    context.header('Cache-Control', 'no-store')
    return context.json(await reader(context).options(actorSearch, formSearch))
  })
  app.get('/api/app/audit/export', validateInput('query', auditQuerySchema), async context => {
    const stream = await reader(context).csv(context.req.valid('query'), context.req.raw.signal)
    return new Response(stream, { headers: {
      'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="pencil-audit.csv"',
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    } })
  })
  app.get('/api/app/audit', validateInput('query', auditQuerySchema), async context => {
    context.header('Cache-Control', 'no-store')
    return context.json(await reader(context).page(context.req.valid('query')))
  })
}
