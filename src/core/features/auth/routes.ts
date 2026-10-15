import type { Hono } from 'hono'
import { AuthError, createAuthHandler, securityHeaders } from '../../../base/operator-auth/index.mjs'
import { z } from 'zod'
import { nativeAuthConfiguration } from './native-config'
// @ts-expect-error The pinned rer owner-sign-in adapter is server-only JavaScript.
import { ownerSignInResponse } from './owner-signin.server.mjs'
// @ts-expect-error Maintained Base bounded duplicate-aware parser.
import { readInput, readParameters } from '../../../base/operator-auth/input.mjs'
import type { WorkerEnvironment } from '../../app/environment'
import type { RuntimeConfiguration } from '../../platform/config/runtime'
import type { PencilServices } from '../../app/services'
import type { RequestServices, RequestConfiguration } from '../../app/request-context'

const postSchemas: Record<string, z.ZodType> = {
  '/auth/magic-link': z.object({ email: z.string().trim().email(), returnTo: z.string().max(2048).optional() }).strict(),
  '/auth/bootstrap': z.object({ token: z.string().min(1).max(1024), displayName: z.string().min(1).max(100), returnTo: z.string().max(2048).optional() }).strict(),
  '/auth/confirm': z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).strict(),
  '/auth/owner-signin': z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).strict(),
  '/auth/signout': z.object({}).strict(),
  '/auth/setup-complete': z.object({}).strict(),
}
const invalid = () => Response.json({ error: 'VALIDATION_ERROR', message: 'Invalid request body.' }, { status: 400, headers: securityHeaders() })
// /auth/setup-complete: `rer setup` closes first setup once the owner exists when rer-setup.json declares dependencies;
// Base answers it only to the local CLI's proof on loopback.
const exposed = new Set(['/auth/bootstrap', '/auth/magic-link', '/auth/confirm', '/auth/owner-signin', '/auth/session', '/auth/signout', '/auth/setup-complete'])
export function registerAuthRoutes(app: Hono<WorkerEnvironment>, services: PencilServices | RequestServices, runtime: RuntimeConfiguration | RequestConfiguration) {
  const getServices = typeof services === 'function' ? services : () => services
  const getRuntime = typeof runtime === 'function' ? runtime : () => runtime
  app.all('/auth/*', async context => {
    if (!exposed.has(context.req.path)) return new Response('Not found', { status: 404, headers: securityHeaders() })
    try {
      const query = readParameters(new URL(context.req.url).searchParams)
      if (context.req.method === 'POST') {
        if ('token' in query) return invalid()
        const schema = postSchemas[context.req.path]
        if (schema && !schema.safeParse(await readInput(context.req.raw.clone())).success) return invalid()
      }
    } catch (error) {
      if (error instanceof AuthError && error.status !== 400) return Response.json({ error: error.code }, { status: error.status, headers: securityHeaders() })
      return invalid()
    }
    if (context.req.path === '/auth/owner-signin') return ownerSignInResponse(context.req.raw, context.get('platform').databaseBinding, nativeAuthConfiguration(getRuntime(context)))
    const response = await createAuthHandler(getServices(context).auth.native)(context.req.raw)
    if (response?.status === 400 && response.headers.get('content-type')?.includes('application/json')) return invalid()
    if (response && context.req.path === '/auth/magic-link') {
      // Base revokes failed deliveries before reporting mail_unavailable. Exposing
      // that address-dependent failure would identify admitted operators. This
      // acknowledges the request only; sender diagnostics remain private.
      const failedDelivery = response.status === 503
        && z.object({ error: z.literal('mail_unavailable') }).safeParse(await response.clone().json()).success
      if (response.status === 202 || failedDelivery) {
        return Response.json({ status: 'accepted', delivery: getRuntime(context).isLocalDevelopment ? 'local' : 'email', inboxAvailable: getRuntime(context).isLocalDevelopment }, { status: 202, headers: securityHeaders() })
      }
    }
    return response ?? context.notFound()
  })
}
