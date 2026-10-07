import manifest from '../../../seed.json'
import { PencilError } from '../shared/errors'
import type { PencilServices } from './services'

export function isDeclaredPublicPath(pathname: string) {
  return manifest.deploy.publicPaths.some(path => path !== '/' && path.endsWith('/') ? pathname.startsWith(path) : pathname === path)
}

export async function publicRequestRateLimitResponse(request: Request, responses: PencilServices['responses']) {
  if (!isDeclaredPublicPath(new URL(request.url).pathname)) return undefined
  try {
    await responses.enforcePublicRequestRateLimit({ clientAddress: request.headers.get('CF-Connecting-IP') ?? undefined, scope: 'request' })
  } catch (error) {
    if (error instanceof PencilError && error.code === 'RATE_LIMITED') return Response.json({ error: error.code, message: error.message }, { status: 429, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } })
    throw error
  }
}
