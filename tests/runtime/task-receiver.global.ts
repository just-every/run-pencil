// Test harness only: a loopback task system honouring the webhook contract in docs/guide/actions.md
// (create-or-get by idempotency key). Each behaviour is a deliberate network-edge fault; no live service.
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { TestProject } from 'vitest/node'

type Mode = 'ok' | 'fail-once-500' | 'store-then-drop-once' | 'redirect'
type Captured = { path: string; authorization: string | null; idempotencyKey: string | null; contentType: string | null; body: string }

export default async function setup(project: TestProject) {
  let mode: Mode = 'ok', delayMilliseconds = 0
  const tasks = new Map<string, string>(), faulted = new Set<string>(), requests: Captured[] = []
  const read = (request: IncomingMessage) => new Promise<string>(resolve => { let body = ''; request.setEncoding('utf8'); request.on('data', chunk => { body += chunk }); request.on('end', () => resolve(body)) })
  const json = (response: ServerResponse, status: number, value: unknown) => { response.writeHead(status, { 'content-type': 'application/json' }); response.end(JSON.stringify(value)) }
  const server = createServer(async (request, response) => {
    const body = await read(request)
    if (request.url === '/__control/reset') { const options = JSON.parse(body || '{}'); mode = options.mode ?? 'ok'; delayMilliseconds = options.delayMilliseconds ?? 0; tasks.clear(); faulted.clear(); requests.length = 0; return json(response, 200, { reset: true }) }
    if (request.url === '/__control/state') return json(response, 200, { tasks: Object.fromEntries(tasks), requests })
    requests.push({ path: request.url ?? '', authorization: request.headers.authorization ?? null, idempotencyKey: (request.headers['idempotency-key'] as string | undefined) ?? null, contentType: request.headers['content-type'] ?? null, body })
    if (request.url !== '/tasks') return json(response, 404, { error: 'not found' })
    if (mode === 'redirect') { response.writeHead(307, { location: '/redirected-tasks' }); return response.end() }
    if (delayMilliseconds) await new Promise(resolve => setTimeout(resolve, delayMilliseconds))
    const key = request.headers['idempotency-key'] as string | undefined
    if (!key || !request.headers.authorization?.startsWith('Bearer ')) return json(response, 401, { error: 'unauthorized' })
    if (mode === 'fail-once-500' && !faulted.has(key)) { faulted.add(key); return json(response, 500, { error: 'temporary' }) }
    const existing = tasks.get(key), taskId = existing ?? `task-${tasks.size + 1}`
    tasks.set(key, taskId)
    // The task is stored; the connection ends before any answer reaches Pencil.
    if (mode === 'store-then-drop-once' && !faulted.has(key)) { faulted.add(key); return request.socket.destroy() }
    return json(response, existing ? 200 : 201, { taskId })
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  project.provide('taskReceiverOrigin', `http://127.0.0.1:${(server.address() as AddressInfo).port}`)
  return () => new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()) })
}

declare module 'vitest' {
  export interface ProvidedContext { taskReceiverOrigin: string }
}
