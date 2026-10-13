// Local-only Worker entry. vite.config.ts loads it only for `vite dev`; the deployed main stays src/server.ts, and
// `rer build` refuses any output that contains the dev layer. It adds dev sign-in, personas and the dev badge.
import worker from './server'
import { withDevIdentity } from './base/operator-auth/dev/index.mjs'
import type { WorkerBindings } from './core/app/environment'
import { isLocalDevelopmentRequest, readRuntimeConfiguration } from './core/platform/config/runtime'
import { nativeAuthConfiguration } from './core/features/auth/native-config'
import { devPersonas } from './core/features/auth/dev-personas'
import { admitDevPersonas } from './core/features/auth/dev-operators'

// The dev layer reads these names; Pencil's own bindings are mapped onto them once.
const bindings = (env: WorkerBindings) => {
  const origin = env.APP_ORIGIN ?? 'http://localhost'
  return { ...env, AUTH_ORIGIN: origin, AUTH_LOCAL: String(isLocalDevelopmentRequest(origin, env)) }
}
const dev = withDevIdentity(worker, {
  bindings,
  config: env => nativeAuthConfiguration(readRuntimeConfiguration(env.AUTH_ORIGIN, env)),
  personas: devPersonas,
})

export default {
  ...dev,
  async fetch(request: Request, env: WorkerBindings, execution: ExecutionContext) {
    const response = await dev.fetch(request, env, execution)
    if (response.status === 303 && new URL(request.url).pathname === '/auth/dev/enter') await admitDevPersonas(env.DB)
    return response
  },
}
