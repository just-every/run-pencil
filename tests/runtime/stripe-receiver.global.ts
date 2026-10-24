// Test harness only: a loopback stand-in for the Stripe API surface Pencil uses (Checkout Sessions create, read, list
// and expire), with Stripe's idempotency-key replay and its open → complete | expired rule. No live service.
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { TestProject } from 'vitest/node'

export type StripeRequest = { method: string; path: string; authorization: string | null; idempotencyKey: string | null; version: string | null; form: Record<string, string> }
export type StripeSession = { id: string; object: 'checkout.session'; url: string; amount_subtotal: number; total_details: { amount_discount: number; amount_tax: number }; amount_total: number; currency: 'usd'; status: 'open' | 'complete' | 'expired'; payment_status: 'paid' | 'unpaid'; payment_intent: string | null; expires_at: number; livemode: false; client_reference_id: string | null; metadata: Record<string, string>; success_url: string; cancel_url: string }

export default async function setup(project: TestProject) {
  const sessions = new Map<string, StripeSession>(), keys = new Map<string, string>(), requests: StripeRequest[] = []
  let origin = ''
  const read = (request: IncomingMessage) => new Promise<string>(resolve => { let body = ''; request.setEncoding('utf8'); request.on('data', chunk => { body += chunk }); request.on('end', () => resolve(body)) })
  const json = (response: ServerResponse, status: number, value: unknown) => { response.writeHead(status, { 'content-type': 'application/json' }); response.end(JSON.stringify(value)) }
  const refuse = (response: ServerResponse, status: number, message: string) => json(response, status, { error: { type: 'invalid_request_error', message } })
  const server = createServer(async (request, response) => {
    const body = await read(request), url = new URL(request.url ?? '/', origin)
    if (url.pathname === '/__control/reset') { sessions.clear(); keys.clear(); requests.length = 0; return json(response, 200, { reset: true }) }
    if (url.pathname === '/__control/state') return json(response, 200, { requests, sessions: Object.fromEntries(sessions) })
    const control = /^\/__control\/(complete|expire)\/(cs_test_\w+)$/.exec(url.pathname)
    if (control) {
      const session = sessions.get(control[2])
      if (!session || session.status !== 'open') return refuse(response, 400, 'This Checkout Session is not open.')
      Object.assign(session, control[1] === 'complete' ? { status: 'complete', payment_status: 'paid', payment_intent: `pi_test_${session.id.slice(8)}` } : { status: 'expired' })
      return json(response, 200, session)
    }
    const form = Object.fromEntries(new URLSearchParams(body))
    requests.push({ method: request.method ?? '', path: url.pathname + url.search, authorization: request.headers.authorization ?? null, idempotencyKey: (request.headers['idempotency-key'] as string | undefined) ?? null, version: (request.headers['stripe-version'] as string | undefined) ?? null, form })
    if (!/^Bearer (?:rk|sk)_test_\w+$/.test(request.headers.authorization ?? '')) return refuse(response, 401, 'Invalid API Key provided.')
    if (request.method === 'GET' && url.pathname === '/v1/checkout/sessions') return json(response, 200, { object: 'list', data: [...sessions.values()].slice(0, Number(url.searchParams.get('limit') ?? 10)) })
    const expire = /^\/v1\/checkout\/sessions\/(cs_test_\w+)\/expire$/.exec(url.pathname), one = /^\/v1\/checkout\/sessions\/(cs_test_\w+)$/.exec(url.pathname)
    if (request.method === 'POST' && expire) {
      const session = sessions.get(expire[1])
      if (!session) return refuse(response, 404, 'No such checkout.session.')
      if (session.status !== 'open') return refuse(response, 400, 'Only Checkout Sessions with a status of open can be expired.')
      session.status = 'expired'
      return json(response, 200, session)
    }
    if (request.method === 'GET' && one) return sessions.has(one[1]) ? json(response, 200, sessions.get(one[1])) : refuse(response, 404, 'No such checkout.session.')
    if (request.method !== 'POST' || url.pathname !== '/v1/checkout/sessions') return refuse(response, 404, 'Unrecognized request URL.')
    const key = request.headers['idempotency-key'] as string | undefined
    if (key && keys.has(key)) return json(response, 200, sessions.get(keys.get(key)!))
    let amount = 0
    for (let index = 0; form[`line_items[${index}][quantity]`] !== undefined; index++) {
      if (form[`line_items[${index}][price_data][currency]`] !== 'usd' || !form[`line_items[${index}][price_data][product_data][name]`]) return refuse(response, 400, 'Each line item needs a USD price and a product name.')
      amount += Number(form[`line_items[${index}][price_data][unit_amount]`]) * Number(form[`line_items[${index}][quantity]`])
    }
    if (form.mode !== 'payment' || !form.success_url || !form.cancel_url || amount < 50) return refuse(response, 400, 'A payment-mode session needs success and cancel URLs and at least $0.50.')
    const id = `cs_test_${sessions.size + 1}${Math.random().toString(36).slice(2, 8)}`
    const session: StripeSession = { id, object: 'checkout.session', url: `${origin}/pay/${id}`, amount_subtotal: amount, total_details: { amount_discount: 0, amount_tax: 0 }, amount_total: amount, currency: 'usd', status: 'open', payment_status: 'unpaid', payment_intent: null,
      expires_at: Math.floor(Date.now() / 1000) + 86_400, livemode: false, client_reference_id: form.client_reference_id ?? null,
      metadata: Object.fromEntries(Object.entries(form).flatMap(([name, value]) => { const match = /^metadata\[(\w+)\]$/.exec(name); return match ? [[match[1], value]] : [] })), success_url: form.success_url, cancel_url: form.cancel_url }
    sessions.set(id, session)
    if (key) keys.set(key, id)
    return json(response, 200, session)
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  project.provide('stripeReceiverOrigin', origin)
  return () => new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()) })
}

declare module 'vitest' {
  export interface ProvidedContext { stripeReceiverOrigin: string }
}
