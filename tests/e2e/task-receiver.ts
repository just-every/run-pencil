// Test harness only: the loopback task system the e2e server's TASK_WEBHOOK_URL names (scripts/run-e2e-server.mjs).
// It honours the webhook contract in docs/guide/actions.md: one task per idempotency key. No live service.
import { createServer } from 'node:http'

export type ReceivedTask = { authorization: string | null; idempotencyKey: string | null; body: string }

export async function startTaskReceiver() {
  const port = Number(process.env.PENCIL_E2E_TASK_PORT ?? Number(process.env.PENCIL_E2E_PORT ?? '4173') + 2)
  const tasks = new Map<string, string>(), requests: ReceivedTask[] = []
  const server = createServer((request, response) => {
    let body = ''
    request.setEncoding('utf8'); request.on('data', chunk => { body += chunk })
    request.on('end', () => {
      const key = (request.headers['idempotency-key'] as string | undefined) ?? null
      requests.push({ authorization: request.headers.authorization ?? null, idempotencyKey: key, body })
      if (request.url !== '/tasks' || !key) { response.writeHead(400).end(); return }
      const existing = tasks.get(key), taskId = existing ?? `browser-task-${tasks.size + 1}`
      tasks.set(key, taskId)
      response.writeHead(existing ? 200 : 201, { 'content-type': 'application/json' }).end(JSON.stringify({ taskId }))
    })
  })
  await new Promise<void>(resolve => server.listen(port, '127.0.0.1', resolve))
  return { tasks, requests, close: () => new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()) }) }
}
