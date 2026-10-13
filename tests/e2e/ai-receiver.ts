// Test harness only: the loopback OpenAI-compatible provider the e2e server's AI_BASE_URL names (scripts/run-e2e-server.mjs).
// The journey scripts each answer; nothing here stands in for a model in application code, and no live provider is called.
import { createServer } from 'node:http'

export type Scripted = { status: number; body: unknown }
export const answer = (output: unknown): Scripted => ({ status: 200, body: {
  status: 'completed', usage: { input_tokens: 900, output_tokens: 240 },
  output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify(output) }] }],
} })

export async function startAiReceiver() {
  const port = Number(process.env.PENCIL_E2E_AI_PORT ?? Number(process.env.PENCIL_E2E_PORT ?? '4173') + 3)
  const script: Scripted[] = [], requests: string[] = []
  const server = createServer((request, response) => {
    let body = ''
    request.setEncoding('utf8'); request.on('data', chunk => { body += chunk })
    request.on('end', () => {
      requests.push(body)
      const next = request.url === '/v1/responses' ? script.shift() : undefined
      response.writeHead(next?.status ?? 503, { 'content-type': 'application/json' }).end(JSON.stringify(next?.body ?? { error: { message: 'no scripted answer' } }))
    })
  })
  await new Promise<void>(resolve => server.listen(port, '127.0.0.1', resolve))
  return { script, requests, close: () => new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()) }) }
}
