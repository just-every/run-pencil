// Test harness only: the loopback Stripe stand-in the e2e server's STRIPE_API_ORIGIN names (scripts/run-e2e-server.mjs).
// It serves the Checkout Session API Pencil calls and a hosted checkout page whose Pay button completes the session,
// sends Pencil the signed checkout.session.completed webhook Stripe would, and follows the success link. No live service.
import { createHmac } from 'node:crypto'
import { createServer } from 'node:http'

export const stripeFixture = { secretKey: 'rk_test_example2', webhookSecret: 'whsec_example_browser_signing_secret' }
type Session = { id: string; object: 'checkout.session'; url: string; amount_total: number; currency: 'usd'; status: 'open' | 'complete' | 'expired'; payment_status: 'paid' | 'unpaid'; payment_intent: string | null; expires_at: number; livemode: false; client_reference_id: string | null; metadata: Record<string, string>; success_url: string; cancel_url: string; lines: Array<{ name: string; amount: number; quantity: number }> }

export async function startStripeReceiver(pencilOrigin: string) {
  const port = Number(process.env.PENCIL_E2E_STRIPE_PORT ?? Number(process.env.PENCIL_E2E_PORT ?? '4173') + 4)
  const origin = `http://127.0.0.1:${port}`, sessions = new Map<string, Session>(), keys = new Map<string, string>(), webhooks: Array<{ status: number; body: string }> = []
  const html = (value: string) => value.replace(/[&<>"']/g, character => `&#${character.charCodeAt(0)};`)
  const server = createServer((request, response) => {
    let body = ''
    request.setEncoding('utf8'); request.on('data', chunk => { body += chunk })
    request.on('end', async () => {
      const url = new URL(request.url ?? '/', origin), json = (status: number, value: unknown) => response.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(value))
      const hosted = /^\/pay\/(cs_test_\w+)(?:\/(complete|cancel))?$/.exec(url.pathname)
      if (hosted) {
        const session = sessions.get(hosted[1])
        if (!session) return response.writeHead(404).end()
        if (hosted[2] === 'cancel') return response.writeHead(303, { location: session.cancel_url }).end()
        if (hosted[2] === 'complete' && request.method === 'POST' && session.status === 'open') {
          Object.assign(session, { status: 'complete', payment_status: 'paid', payment_intent: `pi_test_${session.id.slice(8)}` })
          const { lines: _lines, ...object } = session, at = Math.floor(Date.now() / 1000)
          const event = JSON.stringify({ id: `evt_test_${crypto.randomUUID().replaceAll('-', '')}`, object: 'event', api_version: '2024-06-20', type: 'checkout.session.completed', created: at, livemode: false, data: { object } })
          const delivered = await fetch(`${pencilOrigin}/api/public/payments/stripe`, { method: 'POST', body: event, headers: { 'content-type': 'application/json', 'stripe-signature': `t=${at},v1=${createHmac('sha256', stripeFixture.webhookSecret).update(`${at}.${event}`).digest('hex')}` } })
          webhooks.push({ status: delivered.status, body: await delivered.text() })
          return response.writeHead(303, { location: session.success_url }).end()
        }
        return response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Stripe test checkout</title></head>
<body style="font-family:system-ui;max-width:28rem;margin:2rem auto;padding:0 16px"><h1>Test checkout</h1><ul>${session.lines.map(line => `<li>${html(line.name)} × ${line.quantity}: $${(line.amount * line.quantity / 100).toFixed(2)}</li>`).join('')}</ul>
<p>Total <strong>$${(session.amount_total / 100).toFixed(2)}</strong></p><form method="post" action="/pay/${session.id}/complete"><button type="submit">Pay $${(session.amount_total / 100).toFixed(2)}</button></form><p><a href="/pay/${session.id}/cancel">Back</a></p></body></html>`)
      }
      if (url.pathname === '/__control/state') return json(200, { sessions: Object.fromEntries(sessions), webhooks })
      if (request.headers.authorization !== `Bearer ${stripeFixture.secretKey}`) return json(401, { error: { message: 'Invalid API Key provided.' } })
      const form = Object.fromEntries(new URLSearchParams(body)), expire = /^\/v1\/checkout\/sessions\/(cs_test_\w+)\/expire$/.exec(url.pathname)
      if (request.method === 'GET' && url.pathname === '/v1/checkout/sessions') return json(200, { object: 'list', data: [...sessions.values()].slice(0, 1) })
      if (expire) {
        const session = sessions.get(expire[1])
        if (!session || session.status !== 'open') return json(400, { error: { message: 'Only Checkout Sessions with a status of open can be expired.' } })
        session.status = 'expired'
        return json(200, session)
      }
      if (request.method === 'GET' && sessions.has(url.pathname.split('/').at(-1)!)) return json(200, sessions.get(url.pathname.split('/').at(-1)!))
      if (request.method !== 'POST' || url.pathname !== '/v1/checkout/sessions') return json(404, { error: { message: 'Unrecognized request URL.' } })
      const key = request.headers['idempotency-key'] as string | undefined
      if (key && keys.has(key)) return json(200, sessions.get(keys.get(key)!))
      const lines: Session['lines'] = []
      for (let index = 0; form[`line_items[${index}][quantity]`] !== undefined; index++) lines.push({ name: form[`line_items[${index}][price_data][product_data][name]`], amount: Number(form[`line_items[${index}][price_data][unit_amount]`]), quantity: Number(form[`line_items[${index}][quantity]`]) })
      const id = `cs_test_${sessions.size + 1}${Math.random().toString(36).slice(2, 8)}`
      const session: Session = { id, object: 'checkout.session', url: `${origin}/pay/${id}`, amount_total: lines.reduce((sum, line) => sum + line.amount * line.quantity, 0), currency: 'usd', status: 'open', payment_status: 'unpaid', payment_intent: null,
        expires_at: Math.floor(Date.now() / 1000) + 86_400, livemode: false, client_reference_id: form.client_reference_id ?? null, metadata: { pencil_response: form['metadata[pencil_response]'], pencil_attempt: form['metadata[pencil_attempt]'] }, success_url: form.success_url, cancel_url: form.cancel_url, lines }
      sessions.set(id, session)
      if (key) keys.set(key, id)
      return json(200, session)
    })
  })
  await new Promise<void>(resolve => server.listen(port, '127.0.0.1', resolve))
  return { origin, sessions, webhooks, close: () => new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()) }) }
}
