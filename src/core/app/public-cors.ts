import type { MiddlewareHandler } from 'hono'
import type { WorkerEnvironment } from './environment'

// An embedded document has an opaque origin even when its host shares the
// deployment origin. Only the public bearer-token API can be read from it.
// Operator APIs and generated server functions never opt into this CORS scope.
export const opaqueEmbedCors: MiddlewareHandler<WorkerEnvironment> = async (context, next) => {
  if (context.req.header('Origin') !== 'null') return next()
  context.header('Access-Control-Allow-Origin', 'null')
  context.header('Vary', 'Origin')
  if (context.req.method === 'OPTIONS') {
    context.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    context.header('Access-Control-Allow-Headers', 'Content-Type, CF-Connecting-IP')
    return context.body(null, 204)
  }
  await next()
}
