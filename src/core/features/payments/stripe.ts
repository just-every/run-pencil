import type { CheckoutOptions, PaymentLine } from '../../shared/payments'

/** The Stripe API version Pencil reads and writes; event payloads keep the fields it uses across versions. */
export const stripeApiVersion = '2024-06-20'
export const stripeSignatureToleranceSeconds = 300

/** Keeps only Stripe's status and error code: its message text can quote part of the key or the account id. */
export class StripeRequestError extends Error {
  constructor(readonly status: number, readonly code: string | undefined) { super(`Stripe answered ${status}${code ? ` (${code})` : ''}.`) }
}

export type CheckoutSession = { id: string; url: string | null; amount_total: number | null; expires_at: number; livemode: boolean; status: string | null; payment_status: string; payment_intent: string | null }

/** Only the hosted Checkout page takes card or bank details; this client never sees them. */
export function stripeClient(origin: string, secretKey: string) {
  const call = async <T>(method: 'GET' | 'POST', path: string, form?: URLSearchParams, idempotencyKey?: string): Promise<T> => {
    const response = await fetch(`${origin}${path}`, {
      method, redirect: 'manual', signal: AbortSignal.timeout(15_000),
      headers: { Authorization: `Bearer ${secretKey}`, 'Stripe-Version': stripeApiVersion, ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}), ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) },
      ...(form ? { body: form.toString() } : {}),
    })
    const body = await response.json().catch(() => ({})) as { error?: { code?: string } }
    if (!response.ok) throw new StripeRequestError(response.status, body.error?.code)
    return body as T
  }
  return {
    async createCheckoutSession(input: { lines: PaymentLine[]; checkout?: CheckoutOptions; successUrl: string; cancelUrl: string; responseId: string; attempt: number; idempotencyKey: string }) {
      const recurring=input.checkout?.mode==='subscription' || (input.checkout?.mode==='donation' && !!input.checkout.interval)
      const form = new URLSearchParams({ mode: recurring ? 'subscription' : 'payment', success_url: input.successUrl, cancel_url: input.cancelUrl, client_reference_id: input.responseId,
        'metadata[pencil_response]': input.responseId, 'metadata[pencil_attempt]': String(input.attempt),
        'payment_intent_data[metadata][pencil_response]': input.responseId, 'payment_intent_data[metadata][pencil_attempt]': String(input.attempt) })
      form.set('payment_method_types[0]','card')
      if(input.checkout?.ach)form.set('payment_method_types[1]','us_bank_account')
      form.set('automatic_tax[enabled]', String(input.checkout?.automaticTax ?? false))
      if (input.checkout?.automaticTax) form.set('billing_address_collection', 'required')
      if (input.checkout?.couponId) form.set('discounts[0][coupon]', input.checkout.couponId)
      else form.set('allow_promotion_codes', String(input.checkout?.promotionCodes ?? false))
      if (input.checkout?.receipts && !recurring) form.set('customer_creation', 'always')
      if(recurring) {
        form.delete('payment_intent_data[metadata][pencil_response]');form.delete('payment_intent_data[metadata][pencil_attempt]')
        form.set('subscription_data[metadata][pencil_response]',input.responseId);form.set('subscription_data[metadata][pencil_attempt]',String(input.attempt))
      }
      let customPrice:string|undefined
      if(input.checkout?.customDonation) {
        const price=await call<{id:string}>('POST','/v1/prices',new URLSearchParams({currency:'usd','product_data[name]':input.lines[0].name,'custom_unit_amount[enabled]':'true','custom_unit_amount[minimum]':String(input.checkout.minimum),'custom_unit_amount[maximum]':String(input.checkout.maximum),'custom_unit_amount[preset]':String(input.lines[0].unitAmount)}),input.idempotencyKey+':price')
        if(typeof price.id!=='string' || !price.id)throw new StripeRequestError(502,'invalid-price-response')
        customPrice=price.id
      }
      input.lines.forEach((line, index) => {
        const price=input.checkout?.mode==='subscription'?input.checkout.priceId:customPrice
        if(price) {form.set(`line_items[${index}][price]`,price);form.set(`line_items[${index}][quantity]`,String(line.quantity));return}
        if(recurring)form.set(`line_items[${index}][price_data][recurring][interval]`,input.checkout!.interval!)
        form.set(`line_items[${index}][price_data][currency]`, 'usd')
        form.set(`line_items[${index}][price_data][unit_amount]`, String(line.unitAmount))
        form.set(`line_items[${index}][price_data][product_data][name]`, line.name)
        form.set(`line_items[${index}][quantity]`, String(line.quantity))
      })
      return call<CheckoutSession>('POST', '/v1/checkout/sessions', form, input.idempotencyKey)
    },
    retrieveInvoice: (id:string) => call<{payment_intent:string|null;subscription:string|null;amount_paid:number;currency:string}>('GET',`/v1/invoices/${encodeURIComponent(id)}`),
    retrievePrice: (id:string) => call<{active:boolean;currency:string;unit_amount:number|null;recurring:{interval:string;interval_count:number}|null}>('GET',`/v1/prices/${encodeURIComponent(id)}`),
    retrieveCharge: (id:string) => call<{payment_intent:string;amount_refunded:number}>('GET',`/v1/charges/${encodeURIComponent(id)}`),
    refund: (intent: string, amount: number, key: string) => call<{id:string;status:string}>('POST', '/v1/refunds', new URLSearchParams({payment_intent:intent,amount:String(amount)}),key),
    async reconciliation(start: number, end: number) {
      const list = async (path:string) => {
        const rows: Array<{id:string;amount:number;payment_intent:string;created:number;status?:string;paid?:boolean}> = []
        let after=''
        for(let page=0;page<100;page++) {
          const result=await call<{data:typeof rows;has_more:boolean}>('GET',`${path}?limit=100&created[gte]=${start}&created[lt]=${end}${after ? '&starting_after='+encodeURIComponent(after) : ''}`)
          rows.push(...result.data)
          if(!result.has_more)return rows
          if(!result.data.length)throw new StripeRequestError(502,'invalid-pagination')
          after=result.data.at(-1)!.id
        }
        throw new StripeRequestError(502,'period-too-large')
      }
      return {charges:await list('/v1/charges'),refunds:await list('/v1/refunds')}
    },
    expireCheckoutSession: (id: string) => call<CheckoutSession>('POST', `/v1/checkout/sessions/${encodeURIComponent(id)}/expire`, new URLSearchParams()),
    retrieveCheckoutSession: (id: string) => call<CheckoutSession>('GET', `/v1/checkout/sessions/${encodeURIComponent(id)}`),
    listCheckoutSessions: () => call<{ data: CheckoutSession[] }>('GET', '/v1/checkout/sessions?limit=1'),
  }
}

const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('')

/** Stripe-Signature `t=<seconds>,v1=<hex>`: HMAC-SHA256 of `<t>.<raw body>` keyed by the endpoint's signing secret.
 * A forged signature or a timestamp outside the tolerance is refused before the body is read. */
export async function stripeSignatureValid(payload: string, header: string | undefined, secret: string, nowSeconds: number) {
  const parts = (header ?? '').split(',').map(part => part.trim().split('=') as [string, string | undefined])
  const timestamp = Number(parts.find(([name]) => name === 't')?.[1])
  const signatures = parts.filter(([name, value]) => name === 'v1' && /^[a-f0-9]{64}$/.test(value ?? '')).map(([, value]) => value!)
  if (!Number.isInteger(timestamp) || !signatures.length || Math.abs(nowSeconds - timestamp) > stripeSignatureToleranceSeconds) return false
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const expected = hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`)))
  // Compare every candidate in full so timing does not reveal a matching prefix.
  return signatures.map(signature => [...signature].reduce((difference, character, index) => difference | (character.charCodeAt(0) ^ expected.charCodeAt(index)), 0)).some(difference => difference === 0)
}
