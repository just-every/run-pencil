import type { ChoiceOption, FlowStep } from '../../app/api'
import { NotFoundError, ValidationError } from '../../shared/errors'
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

  async ledger(workspaceId: string, state?: string) {
    const rows=await this.repository.ledger(workspaceId,state)
    if(rows.length>1000)throw new ValidationError('This payment view exceeds 1,000 rows. Export responses or narrow the status.')
    return rows.map(row=>({responseId:row.responseId,provider:'stripe',id:row.paymentIntentId??row.checkoutSessionId,state:row.state,amount:row.amount,total:row.total,refundedAmount:row.refundedAmount,methodType:row.methodType,methodLast4:row.methodLast4,subscriptionStatus:row.subscriptionStatus,at:row.stateChangedAt}))
  }

  async refund(workspaceId:string,responseId:string,amount:number) {
    const payment=await this.repository.inWorkspace(workspaceId,responseId)
    if(!payment)throw new NotFoundError('This payment is not available.')
    if(!payment.paymentIntentId || !Number.isSafeInteger(amount) || amount<1 || amount>(payment.total??payment.providerAmount??payment.amount)-payment.refundedAmount)throw new ValidationError('Refund no more than the remaining captured amount.')
    if(!await this.repository.reserveRefund(payment,amount))throw new ValidationError('A refund is already awaiting its webhook, or this payment cannot be refunded. Reconcile with Stripe before retrying.')
    try {
      const result=await stripeClient(this.options.apiOrigin,(await this.connection()).secretKey).refund(payment.paymentIntentId,amount,`pencil-refund:${responseId}:${payment.refundedAmount+amount}`)
      return {requested:amount,status:result.status,message:'Refund requested. The signed Stripe webhook confirms the refunded amount.'}
    } catch { throw new ValidationError('Stripe did not confirm the request. Check Stripe before retrying; the refund reservation is retained to prevent a duplicate charge reversal.') }
  }

  async reconcile(workspaceId:string,period:string) {
    if(!/^\d{4}-\d{2}(?:-\d{2})?$/.test(period))throw new ValidationError('Choose a UTC day or month.')
    const start=new Date(period.length===7 ? period+'-01T00:00:00.000Z' : period+'T00:00:00.000Z')
    if(!Number.isFinite(start.getTime()) || start.toISOString().slice(0,period.length)!==period)throw new ValidationError('Choose a valid UTC day or month.')
    const end=new Date(start); if(period.length===7)end.setUTCMonth(end.getUTCMonth()+1);else end.setUTCDate(end.getUTCDate()+1)
    const rows=await this.repository.ledger(workspaceId)
    if(rows.length>1000)throw new ValidationError('Reconciliation exceeds 1,000 payments; use Stripe reporting.')
    let provider: Awaited<ReturnType<ReturnType<typeof stripeClient>['reconciliation']>>
    try { provider=await stripeClient(this.options.apiOrigin,(await this.connection()).secretKey).reconciliation(start.getTime()/1000,end.getTime()/1000) } catch { throw new ValidationError('Stripe period totals could not be read. Reconciliation is incomplete.') }
    const ids=new Set(rows.map(row=>row.paymentIntentId).filter(Boolean))
    const paid=provider.charges.filter(row=>row.paid && ids.has(row.payment_intent)).reduce((sum,row)=>sum+row.amount,0)
    const refunded=provider.refunds.filter(row=>row.status==='succeeded' && ids.has(row.payment_intent)).reduce((sum,row)=>sum+row.amount,0)
    const pencil=await this.repository.periodNet(workspaceId,start.toISOString(),end.toISOString())
    return {period,timezone:'UTC',pencil,providerPaid:paid,providerRefunded:refunded,providerNet:paid-refunded,mismatch:pencil!==paid-refunded,gap:'Historical payments from before the ledger upgrade use their recorded last-change date; verify those periods in Stripe.'}
  }

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
    if(input.quote.checkout?.mode==='subscription') {
      let price:Awaited<ReturnType<ReturnType<typeof stripeClient>['retrievePrice']>>
      try {price=await stripeClient(this.options.apiOrigin,input.connection.secretKey).retrievePrice(input.quote.checkout.priceId!)}catch{throw new ValidationError('Stripe could not verify the subscription price. Check the price and connection.')}
      if(!price.active || price.currency!=='usd' || price.unit_amount!==input.quote.total || price.recurring?.interval!==input.quote.checkout.interval || price.recurring?.interval_count!==1)throw new ValidationError('The active Stripe USD price must match this step’s fixed amount and monthly or yearly interval.')
    }
    return { stepId: input.stepId, completionStepId: input.completionStepId, livemode: input.connection.secretKey.includes('_live_'), attempt: input.attempt, amount: input.quote.total, lines: input.quote.lines, checkout: input.quote.checkout, returnTokenHash: (await this.returnToken(input.responseId, input.attempt)).hash }
  }

  /** Creates (or, after a lost answer, re-reads under the same idempotency key) the attempt's Checkout Session. */
  async checkout(payment: PaymentRow, slug: string): Promise<PaymentReceipt> {
    if (payment.checkoutSessionId && payment.checkoutUrl && payment.checkoutExpiresAt && payment.checkoutExpiresAt > new Date().toISOString()) return { state: payment.state, checkoutUrl: payment.checkoutUrl, checkoutSessionId: payment.checkoutSessionId }
    const connection = await this.connection()
    const { token } = await this.returnToken(payment.responseId, payment.attempt)
    const back = (outcome: 'success' | 'cancel') => `${this.options.appOrigin}/f/${encodeURIComponent(slug)}?payment-return=${outcome}&payment-key=${token}`
    let session: CheckoutSession
    try {
      session = await stripeClient(this.options.apiOrigin, connection.secretKey).createCheckoutSession({ lines: JSON.parse(payment.linesJson), checkout: JSON.parse(payment.checkoutSettingsJson), successUrl: back('success'), cancelUrl: back('cancel'), responseId: payment.responseId, attempt: payment.attempt, idempotencyKey: `pencil-checkout:${payment.responseId}:${payment.attempt}` })
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
    const session = (to: PaymentState, from: PaymentState[], extra: { paymentIntentId?: string | null; providerAmount?: number | null; discount?: number; tax?: number; total?: number } = {}) => text('id')?.startsWith('cs_') ? { match: { kind: 'session' as const, sessionId: text('id')! }, transition: { to, from, ...extra } } : undefined
    const details = object.total_details as Record<string, unknown> | undefined
    const amounts = { providerAmount: typeof object.amount_subtotal === 'number' ? object.amount_subtotal : null, discount: typeof details?.amount_discount === 'number' ? details.amount_discount : 0, tax: typeof details?.amount_tax === 'number' ? details.amount_tax : 0, total: typeof object.amount_total === 'number' ? object.amount_total : undefined }
    if(['customer.subscription.created','customer.subscription.updated','customer.subscription.deleted'].includes(event.type)) {
      const match=byAttempt(),id=text('id'),status=event.type==='customer.subscription.deleted'?'canceled':text('status')
      if(!match || !id || !status || !['incomplete','incomplete_expired','trialing','active','past_due','canceled','unpaid','paused'].includes(status))return {status:200,outcome:'ignored'}
      const payment=await this.repository.match(match)
      if(!payment || Boolean(payment.livemode)!==event.livemode)return {status:200,outcome:'ignored'}
      const settings=JSON.parse(payment.checkoutSettingsJson) as {mode?:string;interval?:string}
      if(settings.mode!=='subscription' && !(settings.mode==='donation' && settings.interval))return {status:200,outcome:'ignored'}
      return {status:200,outcome:await this.repository.subscriptionEvent(event,payment,id,status,new Date().toISOString())}
    }
    if(event.type==='charge.succeeded' && text('payment_intent')) {
      const payment=await this.repository.match({kind:'intent',intentId:text('payment_intent')!})
      if(!payment || Boolean(payment.livemode)!==event.livemode)return {status:200,outcome:'ignored'}
      const method=object.payment_method_details as {type?:unknown;card?:{last4?:unknown};us_bank_account?:{last4?:unknown}}|undefined
      if(method?.type!=='card' && method?.type!=='us_bank_account')return {status:200,outcome:'ignored'}
      const last4=method[method.type]?.last4
      await this.repository.recordMethod(payment.responseId,method.type,typeof last4==='string'&&/^\d{4}$/.test(last4)?last4:null)
      return {status:200,outcome:'applied'}
    }
    if ((event.type==='charge.refunded' || event.type==='refund.updated') && text('payment_intent')) {
      const payment=await this.repository.match({kind:'intent',intentId:text('payment_intent')!})
      if(!payment || Boolean(payment.livemode)!==event.livemode)return {status:200,outcome:'ignored'}
      let charge: {payment_intent:string;amount_refunded:number}|undefined
      if(event.type==='refund.updated') {
        if(object.status!=='succeeded' || !text('charge'))return {status:200,outcome:'awaiting-refund'}
        // Stripe supplies the charge's cumulative total. Never add a refund amount twice across event types.
        try {charge=await stripeClient(this.options.apiOrigin,connection.secretKey).retrieveCharge(text('charge')!)}catch{return {status:400,outcome:'charge-unavailable'}}
        if(charge.payment_intent!==payment.paymentIntentId)return {status:400,outcome:'charge-mismatch'}
      }
      const amount=charge?.amount_refunded ?? (typeof object.amount_refunded==='number' ? object.amount_refunded : object.refunded===true ? payment.total??payment.providerAmount??payment.amount : undefined)
      if(!Number.isSafeInteger(amount) || amount!<1 || amount!>(payment.total??payment.providerAmount??payment.amount))return {status:400,outcome:'invalid-refund-amount'}
      const details=object.payment_method_details as Record<string,unknown>|undefined
      const type=typeof details?.type==='string' && ['card','us_bank_account'].includes(details.type) ? details.type : undefined
      const method=type && details?.[type] && typeof details[type]==='object' ? details[type] as Record<string,unknown> : undefined
      const last4=typeof method?.last4==='string' && /^\d{4}$/.test(method.last4) ? method.last4 : undefined
      return {status:200,outcome:await this.repository.refundEvent(event,payment,amount!,{type,last4},new Date().toISOString())}
    }
    let paymentIntentId=text('payment_intent')??null
    if(['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type) && object.payment_status==='paid' && text('subscription') && !paymentIntentId) {
      if(!text('invoice'))return {status:400,outcome:'invoice-missing'}
      try {
        const invoice=await stripeClient(this.options.apiOrigin,connection.secretKey).retrieveInvoice(text('invoice')!)
        if(invoice.subscription!==text('subscription') || invoice.currency!=='usd' || invoice.amount_paid!==object.amount_total || !invoice.payment_intent)return {status:400,outcome:'invoice-mismatch'}
        paymentIntentId=invoice.payment_intent
      }catch{return {status:400,outcome:'invoice-unavailable'}}
    }
    const handled = event.type === 'checkout.session.completed' ? object.payment_status === 'paid' ? session('paid', ['pending', 'processing', 'failed'], { paymentIntentId, ...amounts }) : object.payment_status==='unpaid' ? session('processing',['pending'],{paymentIntentId}) : undefined
      : event.type === 'checkout.session.async_payment_succeeded' ? session('paid', ['pending', 'processing', 'failed'], { paymentIntentId, ...amounts })
      : event.type === 'checkout.session.async_payment_failed' ? session('failed', ['pending','processing'])
      : event.type === 'checkout.session.expired' ? session('expired', ['pending', 'failed'])
      : event.type === 'payment_intent.payment_failed' && byAttempt() ? { match: byAttempt()!, transition: { to: 'failed' as const, from: ['pending' as const] } }
      : event.type === 'charge.refunded' && object.refunded === true && text('payment_intent') ? { match: { kind: 'intent' as const, intentId: text('payment_intent')! }, transition: { to: 'refunded' as const, from: ['paid' as const] } }
      : undefined
    if (!handled) return { status: 200, outcome: 'ignored' }
    const payment = await this.repository.match(handled.match)
    // Events from other systems on the same Stripe account, or from the other mode, are acknowledged and not kept.
    if (!payment || Boolean(payment.livemode) !== event.livemode) return { status: 200, outcome: 'ignored' }
    const checkout=JSON.parse(payment.checkoutSettingsJson) as {ach?:boolean;customDonation?:boolean;minimum?:number;maximum?:number}
    if(handled.transition.to==='processing' && !checkout.ach)return {status:200,outcome:'ignored'}
    const quotedAmount=checkout.customDonation ? Number.isSafeInteger(amounts.providerAmount) && amounts.providerAmount!>=checkout.minimum! && amounts.providerAmount!<=checkout.maximum! : amounts.providerAmount===payment.amount
    if (handled.transition.to === 'paid' && (!quotedAmount || ![amounts.providerAmount, amounts.discount, amounts.tax, amounts.total].every(value => Number.isSafeInteger(value) && value! >= 0) || amounts.total !== amounts.providerAmount! - amounts.discount + amounts.tax)) return { status: 400, outcome: 'amount-mismatch' }
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
