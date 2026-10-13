import { createPencilServices } from './services'
import { createScheduledPencilPlatform } from '../platform/runtime'
import type { WorkerBindings } from './environment'

const batchSize = 1000
const maximumBatches = 10

export async function maintainPencil(environment: WorkerBindings, scheduledTime: number) {
  const now = new Date(scheduledTime).toISOString()
  // Maintenance never initializes fixtures or bootstrap operators and never sends mail.
  const platform = createScheduledPencilPlatform(environment)
  const services = createPencilServices(platform)
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
  const result = await maintainPencil(environment, controller.scheduledTime)
  const services = createPencilServices(createScheduledPencilPlatform(environment))
  await services.distribution.dispatcher.run(new Date(controller.scheduledTime).toISOString())
  await services.notifications.dispatcher.run(new Date(controller.scheduledTime).toISOString())
  await services.analysis.tick(new Date(controller.scheduledTime))
  console.log('Pencil retention maintenance', result)
}
