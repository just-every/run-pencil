import type { Hono } from 'hono'
import { createOwnerClaimHandler, OwnerClaimError } from '../../../base/owner-claim/index.mjs'
import type { WorkerEnvironment } from '../../app/environment'
import { nativeAuthConfiguration, ownerClaimDatabase } from '../auth'
import { editorConfiguration } from '../../platform/management'

export function registerManagementRoutes(app: Hono<WorkerEnvironment>) {
  app.all('/auth/owner-claim', async context => {
    const platform = context.get('platform'), config = platform.configuration, admission = platform.management.ownerClaim
    try {
      if (admission.appOrigin !== config.appOrigin) throw new OwnerClaimError('invalid_configuration', 503)
      const response = await createOwnerClaimHandler({
        db: ownerClaimDatabase(platform.databaseBinding),
        authConfig: nativeAuthConfiguration(config),
        clientIp: request => config.isLocalDevelopment ? 'loopback' : request.headers.get('CF-Connecting-IP') ?? '',
        issuer: admission.issuer!, installationId: admission.installationId!,
        appOrigin: admission.appOrigin!, expectedEmail: config.bootstrapAdminEmail!,
        publicKeys: JSON.parse(admission.publicKeys ?? 'null'),
      })(context.req.raw)
      return response ?? context.notFound()
    } catch (error) {
      return context.json({ error: error instanceof OwnerClaimError ? error.code : 'claim_unavailable' }, error instanceof OwnerClaimError ? error.status as 503 : 503)
    }
  })
  app.all('/api/editor/config', async context => {
    const headers = { 'cache-control': 'no-store, private', vary: 'Cookie' }
    try {
      const auth = context.get('services').auth
      const session = await auth.native.getSession(context.req.raw)
      if (session?.operator.role !== 'owner' || !await auth.getSession(context.req.raw)) return context.json({ error: 'Owner authorization required' }, 403, headers)
      if (context.req.method !== 'GET') return context.json({ error: 'GET required' }, 405, { ...headers, allow: 'GET' })
      const config = editorConfiguration(context.get('platform').management.editor)
      if (!config) return context.json({ error: 'editor_disabled' }, 404, headers)
      return context.json({ config, expiresAt: Math.min(session.expiresAt, Date.now() + 30_000) }, 200, headers)
    } catch { return context.json({ error: 'Editor authorization unavailable' }, 503, headers) }
  })
}
