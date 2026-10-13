// Test harness only: a loopback OpenAI-compatible provider edge for analysis (POST /v1/responses). Each test scripts the
// exact answers it needs; nothing here stands in for a model in application code, and no live provider is called.
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { TestProject } from 'vitest/node'

type Scripted = { status: number; body?: unknown; headers?: Record<string, string>; drop?: boolean }
type Captured = { path: string; authorization: string | null; body: string }

export default async function setup(project: TestProject) {
  let script: Scripted[] = []
  const requests: Captured[] = []
  const read = (request: IncomingMessage) => new Promise<string>(resolve => { let body = ''; request.setEncoding('utf8'); request.on('data', chunk => { body += chunk }); request.on('end', () => resolve(body)) })
  const json = (response: ServerResponse, status: number, value: unknown, headers: Record<string, string> = {}) => { response.writeHead(status, { 'content-type': 'application/json', ...headers }); response.end(JSON.stringify(value)) }
  const server = createServer(async (request, response) => {
    const body = await read(request)
    if (request.url === '/__control/reset') { script = JSON.parse(body || '{}').script ?? []; requests.length = 0; return json(response, 200, { reset: true }) }
    if (request.url === '/__control/script') { script.push(...JSON.parse(body).script); return json(response, 200, { queued: script.length }) }
    if (request.url === '/__control/state') return json(response, 200, { requests, pending: script.length })
    requests.push({ path: request.url ?? '', authorization: request.headers.authorization ?? null, body })
    const next = script.shift()
    if (!next) return json(response, 503, { error: { message: 'no scripted answer' } })
    if (next.drop) return request.socket.destroy()
    return json(response, next.status, next.body ?? {}, next.headers)
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  project.provide('aiReceiverOrigin', `http://127.0.0.1:${(server.address() as AddressInfo).port}`)
  return () => new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()) })
}

declare module 'vitest' {
  export interface ProvidedContext { aiReceiverOrigin: string }
}
