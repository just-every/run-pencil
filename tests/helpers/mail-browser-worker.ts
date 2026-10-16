import worker from '../../src/server'
import { mailEdge } from './mail-edge'
export default { ...worker, async fetch(request: Request, env: Parameters<typeof worker.fetch>[1], execution: ExecutionContext) {
  if (new URL(request.url).pathname === '/__test/cron' && request.method === 'POST' && request.headers.get('x-rer-dev-key') === env.RER_DEV_KEY) {
    await worker.scheduled({ scheduledTime: Date.now(), cron: '* * * * *', noRetry() {} } as ScheduledController, env)
    return new Response(null, { status: 204 })
  }
  return await mailEdge(request, env) ?? worker.fetch(request, env, execution)
} }
