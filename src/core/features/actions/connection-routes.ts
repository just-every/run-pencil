import type { Hono } from 'hono'
import type { WorkerEnvironment } from '../../app/environment'
import { requireConnectionOwner } from '../../app/connection-owner'
import { IntegrationConnections, taskConnectionSchema } from '../../platform/config/connections'
import { emptyMutationBody, validateInput } from '../../shared/validation'
import { ValidationError } from '../../shared/errors'
import { taskDestination } from './destination'
import { isTodoist } from './task-request'

export function registerTaskConnectionRoutes(app: Hono<WorkerEnvironment>) {
  const path = '/api/app/connections/task'
  app.get(path, async c => c.json(await c.get('services').connections.taskStatus()))
  app.put(path, validateInput('json', taskConnectionSchema), async c => {
    await requireConnectionOwner(c); await c.get('services').connections.saveTask(c.req.valid('json'))
    return c.json(await c.get('services').connections.taskStatus())
  })
  app.delete(path, emptyMutationBody, async c => {
    await requireConnectionOwner(c); await c.get('services').connections.remove('task')
    return c.json(await new IntegrationConnections(c.get('platform')).taskStatus())
  })
  app.post(`${path}/test`, emptyMutationBody, async c => {
    await requireConnectionOwner(c)
    const connections = await c.get('services').connections.configured()
    const task = connections.configuration.task
    if (task.kind !== 'webhook') throw new ValidationError(task.message)
    // One stable key per installation: repeated tests exercise create-or-get.
    const key = `pencil-connection-test-${c.get('operatorSession').workspaceId}`
    const result = await taskDestination(task).createOrGet(key, { idempotencyKey: key, action: {
      title: 'Pencil connection test', rationale: 'Test task only. You can delete this task after checking the connection.',
      owner: { name: 'Pencil connection test', email: 'connection-test@example.com' },
      metric: { name: 'Connection check', unit: 'checks', direction: 'increase', baseline: { value: 0, source: 'Connection test', observedAt: '2026-01-01T00:00:00.000Z' } },
      reviewDate: '2026-01-01', reportLink: `${connections.configuration.appOrigin}/app/actions`,
    } })
    if (result.outcome !== 'confirmed') throw new ValidationError(isTodoist(task.url) ? `Todoist did not confirm the task (${result.outcomeClass}). Check your Todoist API token and account access. A task may already exist in Inbox; testing again uses the same command, without adding a duplicate.` : `The receiver did not confirm a task (${result.outcomeClass}). Check its address, bearer key and JSON response. A task may already exist; testing again uses the same key.`)
    return c.json({ message: isTodoist(task.url) ? 'Todoist confirmed the test task. Open your Inbox to check it. Repeating the test uses the same command.' : 'Test task confirmed. Repeating the test uses the same key.', taskId: result.remoteTaskId, ...(isTodoist(task.url) ? { taskUrl: `https://app.todoist.com/app/task/${encodeURIComponent(result.remoteTaskId)}` } : {}) })
  })
}
