import type { TaskDestinationConfiguration } from './task-destination'
import { isTodoist } from './task-request'
import { todoistTaskDestination } from './todoist'
import { webhookTaskDestination } from './webhook'

export function taskDestination(configuration: Extract<TaskDestinationConfiguration, { kind: 'webhook' }>) {
  return isTodoist(configuration.url) ? todoistTaskDestination(configuration.apiKey) : webhookTaskDestination(configuration)
}
