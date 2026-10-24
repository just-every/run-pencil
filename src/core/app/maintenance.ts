import { createPencilServices } from './services'
import { createScheduledPencilPlatform } from '../platform/runtime'
import type { WorkerBindings } from './environment'
import { configuredIntegrationPlatform } from '../platform/config/connections'

const batchSize = 1000
const maximumBatches = 10

export async function maintainPencil(environment: WorkerBindings, scheduledTime: number) {
  const now = new Date(scheduledTime).toISOString()
  // Maintenance never initializes fixtures or bootstrap operators and never sends mail.
  const platform = createScheduledPencilPlatform(environment)
  const services = createPencilServices(platform)
  await services.retention.run(now)
  await platform.databaseBinding.prepare('DELETE FROM google_oauth_states WHERE expires_at<=?').bind(now).run()
  await platform.databaseBinding.prepare('DELETE FROM access_challenges WHERE expires_at<=?').bind(now).run()
  const totals = { expiredRespondentSessions: 0, expiredOperatorSessions: 0, expiredRateWindows: 0, moreWorkMayRemain: false }
  for (let batch = 0; batch < maximumBatches; batch++) {
    const respondents = await services.responses.expireSessions(now, batchSize)
    const operators = await services.auth.expireSessions(now, batchSize)
    const rates = await services.responses.expireRateWindows(now, batchSize)
    totals.expiredRespondentSessions += respondents
    totals.expiredOperatorSessions += operators
    totals.expiredRateWindows += rates
    const full = respondents === batchSize || operators === batchSize || rates === batchSize
    if (!full) return totals
    if (batch === maximumBatches - 1) totals.moreWorkMayRemain = true
  }
  return totals
}

export async function runScheduledMaintenance(controller: ScheduledController, environment: WorkerBindings) {
  const timerPlatform = createScheduledPencilPlatform(environment)
  await timerPlatform.databaseBinding.prepare(`INSERT INTO notification_timer(id,last_started_at) VALUES(1,?)
    ON CONFLICT(id) DO UPDATE SET last_started_at=excluded.last_started_at`).bind(new Date(controller.scheduledTime).toISOString()).run()
  const result = await maintainPencil(environment, controller.scheduledTime)
  const services = createPencilServices(await configuredIntegrationPlatform(createScheduledPencilPlatform(environment)))
  await services.distribution.dispatcher.run(new Date(controller.scheduledTime).toISOString())
  await services.notifications.dispatcher.run(new Date(controller.scheduledTime).toISOString())
  await services.notifications.answerAlerts.run(new Date(controller.scheduledTime).toISOString())
  await services.chat.run(new Date(controller.scheduledTime).toISOString())
  await services.notifications.confirmations.run(new Date(controller.scheduledTime).toISOString())
  await services.notifications.actionReminders.run(new Date(controller.scheduledTime).toISOString())
  await services.notifications.digest.run(new Date(controller.scheduledTime).toISOString())
  await services.webhooks.dispatcher.run(new Date(controller.scheduledTime).toISOString())
  await services.sheets.run()
  await services.analysis.tick(new Date(controller.scheduledTime))
  console.log('Pencil retention maintenance', result)
}
