import worker from '../../src/core/app/worker'
import { mailEdge } from './mail-edge'
export * from '../../src/core/app/worker'
export default { ...worker, async fetch(request: Request, env: Parameters<typeof worker.fetch>[1], execution: ExecutionContext) {
  return await mailEdge(request, env) ?? worker.fetch(request, env, execution)
} }
