// Test-only paid-mail capture endpoint. Never imported by the product entries.
import type { WorkerBindings } from '../../src/core/app/environment'
export async function mailEdge(request: Request, env: WorkerBindings) {
  if (new URL(request.url).pathname !== '/__test/mail') return null
  if (request.headers.get('x-rer-dev-key') !== env.RER_DEV_KEY) return new Response(null, { status: 404 })
  const rows = await env.DB.prepare('SELECT id,message FROM rer_mail_development_outbox ORDER BY created_at DESC,sequence DESC').all<{id:string;message:string}>()
  return Response.json({ messages: rows.results.map(row => ({ id: row.id, ...JSON.parse(row.message) })) })
}
