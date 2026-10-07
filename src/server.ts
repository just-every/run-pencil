import { AuthError } from './base/operator-auth/index.mjs'
import { invalidCapabilityPath } from './core/app/capability-paths'
import { runScheduledMaintenance } from './core/app/maintenance'
import { publicRequestRateLimitResponse } from './core/app/public-paths'
import start from '@tanstack/react-start/server-entry'
import { workerApp, initializePencil } from './core/app/worker'
import { createPencilPlatform } from './core/platform/runtime'
import type { WorkerBindings } from './core/app/environment'
import { DeploymentConfigurationError, isLoopbackRequest } from './core/platform/config/runtime'

export default {
  scheduled: runScheduledMaintenance,
  async fetch(request: Request, bindings: WorkerBindings, execution: ExecutionContext): Promise<Response> {
    let platform
    try { platform = createPencilPlatform(request.url, bindings) } catch (error) {
      if (bindings.PENCIL_LOCAL_DEVELOPMENT === 'true' && !isLoopbackRequest(request.url)) return new Response('Not found', { status: 404 })
      // A configured deployment never answers another host with its documents.
      if (bindings.APP_ORIGIN) { try { if (new URL(request.url).origin !== new URL(bindings.APP_ORIGIN).origin) return new Response('Not found', { status: 404 }) } catch { /* typed configuration error below */ } }
      return Response.json({ status: 'not-ready', message: error instanceof DeploymentConfigurationError ? error.message : 'Invalid deployment configuration.' }, { status: 503 })
    }
    const path = new URL(request.url).pathname
    if (path === '/health' || path === '/api' || path.startsWith('/api/') || path === '/auth' || path.startsWith('/auth/')) {
      return workerApp.fetch(request, bindings, execution)
    }
    let services
    try { services = await initializePencil(platform) } catch (error) { return Response.json({ status: 'not-ready', message: error instanceof DeploymentConfigurationError ? error.message : 'The deployment could not initialize.' }, { status: 503 }) }
    if (path === '/app' || path.startsWith('/app/')) {
      let session
      try { session = await services.auth.getSession(request) } catch (error) {
        if (error instanceof AuthError) return new Response('Forbidden', { status: 403 })
        throw error
      }
      if (!session) {
        const signin = new URL('/signin', request.url)
        signin.searchParams.set('returnTo', path)
        return Response.redirect(signin, 302)
      }
    }
    const denied = await publicRequestRateLimitResponse(request, services.responses)
    if (denied) return denied
    if (invalidCapabilityPath(path)) return Response.json({ error: 'VALIDATION_ERROR', message: 'Invalid request path parameters.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
    if (path.startsWith('/assets/') || path === '/favicon.ico') {
      if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Not found', { status: 404 })
      const asset = await platform.fetchAsset(request)
      const headers = new Headers(asset.headers); headers.set('X-Content-Type-Options', 'nosniff'); headers.set('Access-Control-Allow-Origin', '*')
      return new Response(asset.body, { status: asset.status, headers })
    }
    if (path.startsWith('/_serverFn/')) return start.fetch(request)
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Not found', { status: 404 })
    let embedOrigins: string[] | undefined
    if (path.startsWith('/embed/')) {
      const workspaceId = await services.flows.getFlowWorkspaceId(decodeURIComponent(path.slice('/embed/'.length)))
      if (workspaceId) embedOrigins = (await services.workspace.getSettings(workspaceId)).embedAllowedOrigins
      if (request.headers.get('Sec-Fetch-Dest') === 'iframe') {
        let hostOrigin: string | undefined
        try { hostOrigin = new URL(request.headers.get('Referer') ?? '').origin } catch { /* missing referrer fails closed */ }
        if (!hostOrigin || !embedOrigins?.includes(hostOrigin)) return new Response('This host is not allowed to embed the flow.', { status: 403, headers: { 'Content-Security-Policy': "frame-ancestors 'none'", 'Cache-Control': 'no-store' } })
      }
    }
    const response = await start.fetch(request)
    const headers = new Headers(response.headers)
    headers.set('Content-Security-Policy', embedOrigins ? `frame-ancestors ${embedOrigins.length ? embedOrigins.join(' ') : "'none'"}; sandbox allow-scripts allow-forms` : "frame-ancestors 'none'")
    headers.set('Cache-Control', 'no-store')
    headers.set('Referrer-Policy', 'no-referrer')
    headers.set('X-Content-Type-Options', 'nosniff')
    return new Response(request.method === 'HEAD' ? null : response.body, { status: response.status, headers })
  },
} satisfies ExportedHandler<WorkerBindings>
