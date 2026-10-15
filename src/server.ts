// Demo mode (Base modules/demo) first, so it guards fetch before any other module loads; without RER_DEMO=1 it changes nothing.
import { withDemo } from './base/demo/index.mjs'
import { seedDemo } from './demo'
import { editorPolicy } from './core/platform/management'
import { decodePublicSlug } from './core/app/public-slug'
import { AuthError } from './base/operator-auth/index.mjs'
import { invalidCapabilityPath } from './core/app/capability-paths'
import { runScheduledMaintenance } from './core/app/maintenance'
import { publicRequestRateLimitResponse } from './core/app/public-paths'
import start from '@tanstack/react-start/server-entry'
import { workerApp, initializePencil } from './core/app/worker'
import { createPencilPlatform } from './core/platform/runtime'
import type { WorkerBindings } from './core/app/environment'
import { DeploymentConfigurationError, isLoopbackRequest } from './core/platform/config/runtime'
import { unfinishedOwnerSetup } from './core/features/workspace/setup'
import { lobbyResponse } from './base/lobby'
import { staticAssetResponse } from './base/static-assets'
import { claimedWhen, setupStateResponse } from './base/setup-state'
import { identity } from './identity'

const HASHED_ASSET = /^\/assets\/[^/]+-[A-Za-z0-9_-]{8}\.[A-Za-z0-9]+$/
// public/: the declared theme (rer-theme.css) and the files it names, served at stable paths by the installer and the confirmation page.
const PUBLIC_THEME_FILE = /^\/(?:rer-theme\.css|fonts\/[A-Za-z0-9.-]+\.woff2|brand\/[A-Za-z0-9.-]+\.svg)$/
// The owner has claimed this installation once first-run setup at /setup is confirmed.
const claimed = claimedWhen('SELECT 1 FROM workspaces WHERE first_run_completed_at IS NOT NULL LIMIT 1')

/** A built file as Pencil serves it: never sniffed, readable cross-origin, and kept for good when content-hashed. */
function assetResponse(path: string, asset: Response): Response {
  const headers = new Headers(asset.headers); headers.set('X-Content-Type-Options', 'nosniff'); headers.set('Access-Control-Allow-Origin', '*')
  // Vite names every file under /assets/ by content hash, so a successful response can never change: browsers keep it and reloads stop re-requesting it.
  if ((asset.status === 200 || asset.status === 304) && HASHED_ASSET.test(path)) headers.set('Cache-Control', 'public, max-age=31536000, immutable')
  return new Response(asset.body, { status: asset.status, headers })
}

const worker = {
  scheduled: runScheduledMaintenance,
  async fetch(request: Request, bindings: WorkerBindings, execution: ExecutionContext): Promise<Response> {
    // Built files first: a hosted deploy runs this Worker before its static assets (run_worker_first).
    const built = await staticAssetResponse(request, bindings)
    if (built) return assetResponse(new URL(request.url).pathname, built)
    let platform
    try { platform = createPencilPlatform(request.url, bindings) } catch (error) {
      if (bindings.PENCIL_LOCAL_DEVELOPMENT === 'true' && !isLoopbackRequest(request.url)) return new Response('Not found', { status: 404 })
      return Response.json({ status: 'not-ready', message: error instanceof DeploymentConfigurationError ? error.message : 'Invalid deployment configuration.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
    }
    const path = new URL(request.url).pathname
    if ((path === '/setup' && request.method === 'POST') || path === '/__dev/outbox' || path === '/__dev/key' || path === '/embed.js' || path === '/health' || path === '/api' || path.startsWith('/api/') || path === '/auth' || path.startsWith('/auth/')) {
      return workerApp.fetch(request, bindings, execution)
    }
    let services
    try { services = await initializePencil(platform) } catch (error) { return Response.json({ status: 'not-ready', message: error instanceof DeploymentConfigurationError ? error.message : 'The deployment could not initialize.' }, { status: 503 }) }
    // The installed home: the public claim state, then the owner's selected public form at /, or the shared Lobby without one.
    const home = { DB: bindings.DB, AUTH_ORIGIN: platform.configuration.appOrigin }
    const state = await setupStateResponse(request, home, claimed)
    if (state) return state
    if (path === '/') {
      const brand = await services.brand.get()
      if (!brand.publicFlowSlug) {
        const lobby = await lobbyResponse(request, home, { ...identity, installedHome: 'lobby', deployment: brand.configured ? brand.name : identity.deployment }, claimed)
        if (lobby) return lobby
      }
    }
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
      if (await unfinishedOwnerSetup(services, request)) return Response.redirect(new URL('/setup', request.url), 302)
    }
    const denied = await publicRequestRateLimitResponse(request, services.responses)
    if (denied) return denied
    const publicPath = /^\/(?:f|embed)\/(.*)$/.exec(path)
    if (publicPath && !decodePublicSlug(publicPath[1])) return Response.json({ error: 'VALIDATION_ERROR', message: 'Invalid request path parameters.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
    if (invalidCapabilityPath(path)) return Response.json({ error: 'VALIDATION_ERROR', message: 'Invalid request path parameters.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
    if (path.startsWith('/assets/') || path === '/favicon.ico' || PUBLIC_THEME_FILE.test(path)) {
      if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Not found', { status: 404 })
      return assetResponse(path, await platform.fetchAsset(request))
    }
    if (path.startsWith('/_serverFn/')) return start.fetch(request)
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Not found', { status: 404 })
    let embedOrigins: string[] | undefined
    if (path.startsWith('/embed/')) {
      const workspaceId = await services.flows.getFlowWorkspaceId(decodePublicSlug(path.slice('/embed/'.length))!)
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
    if (path === '/app' || path.startsWith('/app/')) headers.set('Content-Security-Policy', editorPolicy(headers.get('Content-Security-Policy') ?? '', bindings))
    // no-transform: no proxy rewrites the document React hydrates (Cloudflare's email address obfuscation included).
    headers.set('Cache-Control', 'no-store, no-transform')
    // /setup's native forms POST to this origin, whose exact Origin check needs the browser to send it; no-referrer would send Origin: null.
    headers.set('Referrer-Policy', path === '/setup' ? 'same-origin' : 'no-referrer')
    headers.set('X-Content-Type-Options', 'nosniff')
    return new Response(request.method === 'HEAD' ? null : response.body, { status: response.status, headers })
  },
} satisfies ExportedHandler<WorkerBindings>

export default withDemo(worker, { seed: seedDemo })
