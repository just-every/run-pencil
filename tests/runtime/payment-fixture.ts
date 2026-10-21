import { env } from 'cloudflare:test'
import { createWorkerApp } from '../../src/core/app/worker'
import { createPencilPlatform } from '../../src/core/platform/runtime'
import type { StripeRequest, StripeSession } from './stripe-receiver.global'

// PAY-001 test edge only: the loopback Stripe stand-in from the global setup and events signed as Stripe signs them.
const origin = (env as unknown as { STRIPE_API_ORIGIN: string }).STRIPE_API_ORIGIN
// Marked example credentials: a short Stripe-shaped key and a signing secret named as examples.
export const stripeKey = 'rk_test_example1'
export const webhookSecret = 'whsec_example_worker_signing_secret'
export type { StripeSession }

export const stripe = {
  async state() { return (await fetch(`${origin}/__control/state`)).json() as Promise<{ requests: StripeRequest[]; sessions: Record<string, StripeSession> }> },
  /** The respondent pays on the hosted page, or the session times out unpaid. */
  async settle(action: 'complete' | 'expire', id: string) { return (await fetch(`${origin}/__control/${action}/${id}`, { method: 'POST' })).json() as Promise<StripeSession> },
}

const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('')
export async function stripeEvent(type: string, object: unknown, options: { secret?: string; at?: number; id?: string } = {}) {
  const at = options.at ?? Math.floor(Date.now() / 1000), id = options.id ?? `evt_test_${crypto.randomUUID().replaceAll('-', '')}`
  const body = JSON.stringify({ id, object: 'event', api_version: '2024-06-20', type, created: at, livemode: false, data: { object } })
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(options.secret ?? webhookSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return { id, body, header: `t=${at},v1=${hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${at}.${body}`)))}` }
}

/** Delivers an event to Pencil's public webhook route as Stripe would: raw JSON plus its Stripe-Signature header. */
export async function deliver(event: { body: string; header: string }) {
  const app = createWorkerApp(undefined, createPencilPlatform('http://localhost', env))
  const response = await app.request('http://localhost/api/public/payments/stripe', { method: 'POST', body: event.body,
    headers: { Host: 'localhost', 'Content-Type': 'application/json', 'Stripe-Signature': event.header, 'CF-Connecting-IP': `stripe-${crypto.randomUUID()}` } })
  return { status: response.status, ...await response.json() as { received: boolean; outcome: string } }
}
