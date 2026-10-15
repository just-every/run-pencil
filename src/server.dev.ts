// Local-only Worker entry. vite.config.ts loads it only for `vite dev`; the deployed main stays src/server.ts, and
// `rer build` refuses any output that contains the dev layer. It adds dev sign-in, personas and development labels.
import worker from './server'
import { withDevIdentity } from './base/operator-auth/dev/index.mjs'
import type { WorkerBindings } from './core/app/environment'
import { isLocalDevelopmentRequest, readRuntimeConfiguration } from './core/platform/config/runtime'
import { nativeAuthConfiguration } from './core/features/auth/native-config'
import { devPersonas } from './core/features/auth/dev-personas'
import { admitDevPersonas } from './core/features/auth/dev-operators'
import { createAiOutbox, createDevAiClient } from './base/ai/dev/index.mjs'
import { aiConfig } from './base/ai/index.mjs'
import { DEV_KEY_HEADER } from './base/operator-auth/index.mjs'
import type { DevAiFactory } from './core/platform/ai/provider'

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

// Analysis under `rer dev`: Base's dev double (it cannot answer schema output, so a run fails with dev_fake_cannot_answer), or the
// capped Models dev app `rer dev --models live` hands over. Runs start from this runtime's own signed-in requests or local cron,
// so the call carries this checkout's dev key to Base's gate.
const devAi: DevAiFactory = env => {
  const origin = env.APP_ORIGIN ?? 'http://localhost'
  const live = env.RER_MODELS_SERVICE && env.RER_MODELS_KEY ? { baseUrl: env.RER_MODELS_SERVICE, apiKey: env.RER_MODELS_KEY } : undefined
  const request = new Request(origin, { headers: { [DEV_KEY_HEADER]: env.RER_DEV_KEY ?? '' } })
  const client = createDevAiClient(aiConfig({ ...env }), { request, key: env.RER_DEV_KEY, origin, local: true, outbox: createAiOutbox({ db: env.DB }), live })
  return { client, transport: live ? 'models' : 'dev', origin: live ? new URL(live.baseUrl).origin : `${new URL(origin).origin} (Base AI dev double)` }
}
const withDevAi = (env: WorkerBindings): WorkerBindings => ({ ...env, PENCIL_DEV_AI: devAi })

export default {
  ...dev,
  scheduled: (controller: ScheduledController, env: WorkerBindings) => dev.scheduled!(controller, withDevAi(env)),
  async fetch(request: Request, env: WorkerBindings, execution: ExecutionContext) {
    const response = await dev.fetch(request, withDevAi(env), execution)
    if (response.status === 303 && new URL(request.url).pathname === '/auth/dev/enter') await admitDevPersonas(env.DB)
    return response
  },
}
