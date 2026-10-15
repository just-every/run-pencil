import { demoEffect } from '../../../base/demo/index.mjs'
import { loopbackHosts } from '../../platform/config/task-destination'
import type { TaskDestination, TaskOutcome, TaskPayload } from './task-destination'

const responseLimit = 16 * 1024
const remoteTaskId = /^[\x21-\x7e]{1,200}$/

/**
 * The generic webhook adapter: Pencil's one outbound call. One POST of the confirmed JSON to the deployer's
 * https URL, with the key as a bearer value and the idempotency key in a header and the body. No redirect is
 * followed, the call stops after the timeout, and only the remote task ID is read from the answer. Nothing
 * here logs, and the key is never returned or stored.
 */
export function webhookTaskDestination(configuration: { url: string; apiKey: string; allowLoopbackHttp: boolean }, timeoutMilliseconds = 10_000): TaskDestination {
  return {
    async createOrGet(idempotencyKey: string, payload: TaskPayload): Promise<TaskOutcome> {
      const url = new URL(configuration.url)
      if (url.protocol !== 'https:' && !(configuration.allowLoopbackHttp && url.protocol === 'http:' && loopbackHosts.has(url.hostname))) return { outcome: 'failed', outcomeClass: 'refused' }
      let response: Response
      try {
        response = await demoEffect(() => fetch(url, {
          method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(timeoutMilliseconds),
          headers: { 'content-type': 'application/json', accept: 'application/json', authorization: `Bearer ${configuration.apiKey}`, 'idempotency-key': idempotencyKey },
          body: JSON.stringify(payload),
        }), () => Response.json({ taskId: `demo-${idempotencyKey}` }, { status: 201 }))
      } catch (error) {
        // The request may have arrived before the connection ended or the time ran out.
        return { outcome: 'unknown', outcomeClass: error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'network' }
      }
      const status = response.status
      if (status < 200 || status >= 300) {
        await response.body?.cancel().catch(() => undefined)
        return { outcome: 'failed', outcomeClass: status >= 500 ? '5xx' : status >= 400 ? '4xx' : '3xx', httpStatus: status }
      }
      try {
        const declared = Number(response.headers.get('content-length') ?? 0)
        if (declared > responseLimit) { await response.body?.cancel(); return { outcome: 'unknown', outcomeClass: 'invalid-response', httpStatus: status } }
        const text = await response.text()
        const taskId = text.length <= responseLimit ? (JSON.parse(text) as { taskId?: unknown }).taskId : undefined
        if (typeof taskId === 'string' && remoteTaskId.test(taskId)) return { outcome: 'confirmed', remoteTaskId: taskId, httpStatus: status }
        return { outcome: 'unknown', outcomeClass: 'invalid-response', httpStatus: status }
      } catch (error) {
        return { outcome: 'unknown', outcomeClass: error instanceof SyntaxError ? 'invalid-response' : error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'network', httpStatus: status }
      }
    },
  }
}
