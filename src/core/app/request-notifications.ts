import { createPencilServices } from './services'
import { createScheduledPencilPlatform } from '../platform/runtime'
import type { WorkerBindings } from './environment'

/** Requests and Cron share the durable claim before either calls the sender. */
export async function deliverRequestNotifications(environment: WorkerBindings) {
  const services = createPencilServices(createScheduledPencilPlatform(environment))
  await services.notifications.dispatcher.run()
  await services.notifications.answerAlerts.run()
  await services.chat.run()
  await services.notifications.confirmations.run()
  await services.webhooks.dispatcher.run()
  await services.sheets.run()
}

export function continueNotifications(request: Request, environment: WorkerBindings, execution: ExecutionContext) {
  const path = new URL(request.url).pathname
  if (!(path === '/app' || path.startsWith('/app/') || path.startsWith('/api/') || path.startsWith('/f/') || path.startsWith('/embed/'))) return
  execution.waitUntil(deliverRequestNotifications(environment).catch(() => {
    // Never log provider inputs, request contents or credentials.
    console.error('Pencil request notification dispatch failed; the durable queue remains available to Cron and later requests.')
  }))
}
