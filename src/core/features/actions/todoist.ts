import { demoEffect } from '../../../base/demo/index.mjs'
import type { TaskDestination } from './task-destination'
import { todoistEndpoint, todoistRequest } from './task-request'

/** Todoist's Sync command UUID prevents a repeated delivery from adding another task. */
export function todoistTaskDestination(apiKey: string): TaskDestination {
  return { async createOrGet(_key, payload) {
    const request = await todoistRequest(payload), command = request.commands[0]
    let response: Response
    try {
      response = await demoEffect(() => fetch(todoistEndpoint, {
        method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(10_000),
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
        body: new URLSearchParams({ commands: JSON.stringify(request.commands) }),
      }), () => Response.json({ sync_status: { [command.uuid]: 'ok' }, temp_id_mapping: { [command.temp_id]: `demo-${command.temp_id}` } }))
    } catch (error) { return { outcome: 'unknown', outcomeClass: error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'network' } }
    const httpStatus = response.status
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined)
      return { outcome: 'failed', outcomeClass: httpStatus >= 500 ? '5xx' : httpStatus >= 400 ? '4xx' : '3xx', httpStatus }
    }
    try {
      if (Number(response.headers.get('content-length') ?? 0) > 16_384) { await response.body?.cancel(); return { outcome: 'unknown', outcomeClass: 'invalid-response', httpStatus } }
      const text = await response.text()
      if (text.length > 16_384) return { outcome: 'unknown', outcomeClass: 'invalid-response', httpStatus }
      const result = JSON.parse(text) as { sync_status?: Record<string, unknown>; temp_id_mapping?: Record<string, unknown> }
      if (result.sync_status?.[command.uuid] && result.sync_status[command.uuid] !== 'ok') return { outcome: 'failed', outcomeClass: 'refused', httpStatus }
      const taskId = result.temp_id_mapping?.[command.temp_id]
      if (result.sync_status?.[command.uuid] === 'ok' && typeof taskId === 'string' && /^[\x21-\x7e]{1,200}$/.test(taskId)) return { outcome: 'confirmed', remoteTaskId: taskId, httpStatus }
      return { outcome: 'unknown', outcomeClass: 'invalid-response', httpStatus }
    } catch { return { outcome: 'unknown', outcomeClass: 'invalid-response', httpStatus } }
  } }
}
