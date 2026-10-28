import type { Hono } from 'hono'
import { z } from 'zod'
import type { WorkerEnvironment } from '../../app/environment'
import { ForbiddenError } from '../../shared/errors'
import { validateInput } from '../../shared/validation'
import { selectPrivacyData } from './selection'
import { privacyIntegrations } from './integrations'
import { privacyBundle } from './bundle'
import { erasePrivacyData } from './erase'

const request = z.object({ identifier: z.string().trim().min(1).max(320) }).strict()
export function registerPrivacyRoutes(app: Hono<WorkerEnvironment>) {
  app.use('/api/app/privacy/*', async (context, next) => {
    const session = await context.get('services').auth.native.getSession(context.req.raw)
    if (!session || !['owner', 'admin'].includes(session.operator.role)) throw new ForbiddenError('Only an Admin or the installation owner can handle privacy requests.')
    context.header('Cache-Control', 'no-store')
    context.header('Referrer-Policy', 'no-referrer')
    context.header('X-Content-Type-Options', 'nosniff')
    await next()
  })
  for (const action of ['lookup', 'export', 'erase'] as const) {
    app.post(`/api/app/privacy/${action}`, validateInput('json', action === 'erase' ? request.extend({ confirm: z.literal(true) }) : request), async context => {
      const { workspaceId, operatorId, id: sessionId } = context.get('operatorSession')
      const db = context.get('platform').databaseBinding
      const selected = await selectPrivacyData(db, workspaceId, context.req.valid('json').identifier)
      const integrations = await privacyIntegrations(db, workspaceId, selected)
      if (action === 'erase') {
        await erasePrivacyData(db, workspaceId, operatorId, sessionId, selected)
        return context.json({ completed: true, counts: selected.counts, integrations })
      }
      if (action === 'export') {
        const bundle = await privacyBundle(db, selected, integrations)
        await db.prepare(`INSERT INTO audit_entries(id,workspace_id,kind,actor_operator_id,subject_type,subject_id,details_json,created_at) VALUES(?,?,'privacy.exported',?,'privacy-request',NULL,?,?)`)
          .bind(crypto.randomUUID(), workspaceId, operatorId, JSON.stringify(selected.counts), new Date().toISOString()).run()
        context.header('Content-Disposition', 'attachment; filename="privacy-request.json"')
        return context.json(bundle)
      }
      return context.json({ counts: selected.counts, forms: selected.forms, integrations })
    })
  }
}
