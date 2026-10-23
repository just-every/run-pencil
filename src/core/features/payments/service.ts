import type { ChoiceOption, FlowStep } from '../../app/api'
import { ValidationError } from '../../shared/errors'
import { paymentQuote, paymentSettings, type PaymentQuote, type PaymentState } from '../../shared/payments'
import type { IntegrationConnections, PaymentConnection } from '../../platform/config/connections'
import type { EventMatch, PaymentAttempt, PaymentRepository, PaymentRow } from './repository'
import { StripeRequestError, stripeClient, stripeSignatureValid, type CheckoutSession } from './stripe'

type StripeEvent = { id: string; type: string; created: number; livemode: boolean; data: { object: Record<string, unknown> } }
export type PaymentReceipt = { state: PaymentState; checkoutUrl?: string; checkoutSessionId?: string }
const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('')
const sha256 = async (value: string) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))
const unavailable = 'This form takes payment through Stripe, and the business has not finished connecting it. Your answers have not been sent; try again later.'

function stripeEvent(value: unknown): StripeEvent | undefined {
  const event = value as StripeEvent
  return event && typeof event === 'object' && typeof event.id === 'string' && /^evt_/.test(event.id) && typeof event.type === 'string' && Number.isInteger(event.created)
    && typeof event.livemode === 'boolean' && !!event.data?.object && typeof event.data.object === 'object' ? event : undefined
}

/** PAY-001: the respondent pays on Stripe Checkout; the amount is Pencil's, and only a signed Stripe event marks it paid. */
export class PaymentService {
  constructor(private readonly repository: PaymentRepository, private readonly connections: IntegrationConnections, private readonly options: { appOrigin: string; apiOrigin: string; secret: string }) {}

  forResponse(responseId: string) { return this.repository.forResponse(responseId) }

  async connection(): Promise<PaymentConnection> {
    const saved = await this.connections.payment().catch(() => undefined)
    if (!saved) throw new ValidationError(unavailable)
    return saved
  }

  /** The total recomputed from the published revision: accepted on-path answers and server-evaluated calculations only. */
  quote(step: FlowStep, flow: { steps: FlowStep[]; choices: ChoiceOption[] }, answers: Record<string, unknown>, calculations: Record<string, unknown>): PaymentQuote {
    const settings = paymentSettings(step)
    if (!settings) throw new ValidationError('This payment step has no valid pricing.')
    const quote = paymentQuote(settings, flow, answers, calculations, step.prompt)
    if ('issue' in quote) throw new ValidationError(quote.issue, [{ stepId: step.id, reason: quote.issue }])
    return quote
  }

  /** A respondent's return link for one attempt. It is derived, so a retry rebuilds the same Checkout URLs. */
  async returnToken(responseId: string, attempt: number) {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(`pencil-payment-return:${this.options.secret}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    const token = hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${responseId}:${attempt}`)))
    return { token, hash: await sha256(token) }
  }

  returnTokenHash(token: string) { return sha256(token) }
  byReturnToken(hash: string) { return this.repository.byReturnToken(hash) }

  async attempt(input: { responseId: string; attempt: number; stepId: string; completionStepId: string; quote: PaymentQuote; connection: PaymentConnection }): Promise<PaymentAttempt> {
    return { stepId: input.stepId, completionStepId: input.completionStepId, livemode: input.connection.secretKey.includes('_live_'), attempt: input.attempt, amount: input.quote.total, lines: input.quote.lines, returnTokenHash: (await this.returnToken(input.responseId, input.attempt)).hash }
  }

  /** Creates (or, after a lost answer, re-reads under the same idempotency key) the attempt's Checkout Session. */
  async checkout(payment: PaymentRow, slug: string): Promise<PaymentReceipt> {
    if (payment.checkoutSessionId && payment.checkoutUrl && payment.checkoutExpiresAt && payment.checkoutExpiresAt > new Date().toISOString()) return { state: payment.state, checkoutUrl: payment.checkoutUrl, checkoutSessionId: payment.checkoutSessionId }
    const connection = await this.connection()
    const { token } = await this.returnToken(payment.responseId, payment.attempt)
    const back = (outcome: 'success' | 'cancel') => `${this.options.appOrigin}/f/${encodeURIComponent(slug)}?payment-return=${outcome}&payment-key=${token}`
    let session: CheckoutSession
    try {
      session = await stripeClient(this.options.apiOrigin, connection.secretKey).createCheckoutSession({ lines: JSON.parse(payment.linesJson), successUrl: back('success'), cancelUrl: back('cancel'), responseId: payment.responseId, attempt: payment.attempt, idempotencyKey: `pencil-checkout:${payment.responseId}:${payment.attempt}` })
    } catch (error) {
      if (error instanceof StripeRequestError) throw new ValidationError('Stripe could not open checkout. Your answers are saved; retry to continue to payment.')
      throw new ValidationError('Stripe could not be reached. Your answers are saved; retry to continue to payment.')
    }
    if (!session.url) throw new ValidationError('Stripe returned no checkout page. Retry to continue to payment.')
    await this.repository.recordCheckout(payment.responseId, payment.attempt, { id: session.id, url: session.url, expiresAt: new Date(session.expires_at * 1000).toISOString() }, new Date().toISOString())
    return { state: 'pending', checkoutUrl: session.url, checkoutSessionId: session.id }
  }

  /** Cancel ends the session at Stripe first, so the old checkout can never be paid after it is replaced.
   * False means Stripe has already completed that checkout: the payment stands and its webhook will mark it. */
  async cancel(payment: PaymentRow): Promise<boolean> {
    if (payment.checkoutSessionId) {
      const stripe = stripeClient(this.options.apiOrigin, (await this.connection()).secretKey)
      try { await stripe.expireCheckoutSession(payment.checkoutSessionId) } catch (error) {
        if (!(error instanceof StripeRequestError)) throw new ValidationError('Stripe could not be reached to cancel the checkout. Try again.')
        const session = await stripe.retrieveCheckoutSession(payment.checkoutSessionId).catch(() => undefined)
        if (session?.status === 'complete') return false
        if (session?.status !== 'expired') throw new ValidationError('Stripe did not confirm the cancelled checkout. Try again.')
      }
    }
    await this.repository.cancel(payment.responseId, payment.attempt, new Date().toISOString())
    return true
  }

  /** Stripe webhook: the signature is verified over the raw body before anything is parsed. */
  async webhook(payload: string, signature: string | undefined): Promise<{ status: 200 | 400; outcome: string }> {
    const connection = await this.connections.payment().catch(() => undefined)
    if (!connection) return { status: 400, outcome: 'not-connected' }
    if (!await stripeSignatureValid(payload, signature, connection.webhookSecret, Math.floor(Date.now() / 1000))) return { status: 400, outcome: 'invalid-signature' }
    let parsed: unknown
    try { parsed = JSON.parse(payload) } catch { return { status: 400, outcome: 'invalid-event' } }
    const event = stripeEvent(parsed)
    if (!event) return { status: 400, outcome: 'invalid-event' }
    const object = event.data.object, text = (key: string) => typeof object[key] === 'string' ? object[key] as string : undefined
    const metadata = (object.metadata && typeof object.metadata === 'object' ? object.metadata : {}) as Record<string, unknown>
    const byAttempt = (): EventMatch | undefined => typeof metadata.pencil_response === 'string' && /^\d+$/.test(String(metadata.pencil_attempt)) ? { kind: 'attempt', responseId: metadata.pencil_response, attempt: Number(metadata.pencil_attempt) } : undefined
    const session = (to: PaymentState, from: PaymentState[], extra: { paymentIntentId?: string | null; providerAmount?: number | null } = {}) => text('id')?.startsWith('cs_') ? { match: { kind: 'session' as const, sessionId: text('id')! }, transition: { to, from, ...extra } } : undefined
    const handled = event.type === 'checkout.session.completed' ? object.payment_status === 'paid' ? session('paid', ['pending', 'failed'], { paymentIntentId: text('payment_intent') ?? null, providerAmount: typeof object.amount_total === 'number' ? object.amount_total : null }) : undefined
      : event.type === 'checkout.session.async_payment_succeeded' ? session('paid', ['pending', 'failed'], { paymentIntentId: text('payment_intent') ?? null, providerAmount: typeof object.amount_total === 'number' ? object.amount_total : null })
      : event.type === 'checkout.session.async_payment_failed' ? session('failed', ['pending'])
      : event.type === 'checkout.session.expired' ? session('expired', ['pending', 'failed'])
      : event.type === 'payment_intent.payment_failed' && byAttempt() ? { match: byAttempt()!, transition: { to: 'failed' as const, from: ['pending' as const] } }
      : event.type === 'charge.refunded' && object.refunded === true && text('payment_intent') ? { match: { kind: 'intent' as const, intentId: text('payment_intent')! }, transition: { to: 'refunded' as const, from: ['paid' as const] } }
      : undefined
    if (!handled) return { status: 200, outcome: 'ignored' }
    const payment = await this.repository.match(handled.match)
    // Events from other systems on the same Stripe account, or from the other mode, are acknowledged and not kept.
    if (!payment || Boolean(payment.livemode) !== event.livemode) return { status: 200, outcome: 'ignored' }
    return { status: 200, outcome: await this.repository.applyEvent(event, payment, handled.transition, new Date().toISOString()) }
  }

  async testConnection() {
    const connection = await this.connections.payment()
    if (!connection) throw new ValidationError('Save a Stripe key and webhook signing secret first.')
    try { await stripeClient(this.options.apiOrigin, connection.secretKey).listCheckoutSessions() } catch (error) {
      throw new ValidationError(!(error instanceof StripeRequestError) ? 'Stripe could not be reached. Try again.' : error.status === 401 ? 'Stripe refused the key. Check that it is complete and still active.'
        : `Stripe refused the key (${error.status}${error.code ? `, ${error.code}` : ''}). Give the restricted key write access to Checkout Sessions.`)
    }
    return { message: `Stripe accepted the ${connection.secretKey.startsWith('rk_') ? 'restricted' : 'secret'} key in ${connection.secretKey.includes('_live_') ? 'live' : 'test'} mode.` }
  }
}
