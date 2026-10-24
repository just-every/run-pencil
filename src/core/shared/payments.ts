import type { ChoiceOption, FlowStep } from '../app/api'
import { selectedChoiceIds } from './otherChoices'

/** PAY-001 payment step settings, kept as the step's `payment` setting. Every amount is whole US cents. */
export type PaymentProduct = { id: string; name: string; unitAmount: number; quantity?: number; quantityStepId?: string }
export type PaymentOption = { stepId: string; prices: Record<string, number> }
export type CheckoutOptions = { automaticTax?: boolean; promotionCodes?: boolean; couponId?: string; receipts?: boolean }
export type PaymentSettings = CheckoutOptions & { products: PaymentProduct[]; options: PaymentOption[]; calculationId?: string; minimum: number; maximum: number }
export type PaymentLine = { name: string; unitAmount: number; quantity: number }
export type PaymentQuote = { lines: PaymentLine[]; total: number; checkout?: CheckoutOptions }
export type PaymentState = 'pending' | 'paid' | 'failed' | 'expired' | 'cancelled' | 'refunded'
/** What an operator sees of a response's payment. Card or bank numbers are never stored. */
export type LedgerPayment = { state: PaymentState; amount: number; providerAmount: number | null; discount?: number | null; tax?: number | null; total?: number | null; checkoutSessionId: string | null; paymentIntentId: string | null; stateChangedAt: string; attempt: number }

/** Stripe's US-dollar charge floor is $0.50 and its ceiling $999,999.99. */
export const paymentLimits = { minimum: 50, maximum: 99_999_999, products: 20, options: 20, quantity: 999, nameCharacters: 250 } as const
export const paymentStateLabels: Record<PaymentState, string> = { pending: 'Payment pending', paid: 'Paid', failed: 'Payment failed', expired: 'Checkout expired', cancelled: 'Checkout cancelled', refunded: 'Refunded' }

const cents = (value: unknown, minimum = 0): value is number => Number.isInteger(value) && (value as number) >= minimum && (value as number) <= paymentLimits.maximum
const identifier = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 200

export function formatUsd(amount: number) {
  return `$${(amount / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function paymentSettings(step: Pick<FlowStep, 'kind' | 'questionSettings'>): PaymentSettings | undefined {
  return step.kind === 'payment' && !paymentSettingsIssue(step.questionSettings?.payment) ? step.questionSettings!.payment as PaymentSettings : undefined
}

/** Only a payment step holds `payment`, and it holds nothing else: no screen, visibility or redirect. */
export function paymentStepSettingsIssue(kind: FlowStep['kind'], settings: Record<string, unknown> | null | undefined) {
  if (kind !== 'payment') return settings?.payment === undefined ? undefined : 'Only a payment step can hold payment settings.'
  if (Object.keys(settings ?? {}).some(key => key !== 'payment')) return 'A payment step holds only its pricing.'
  return settings?.payment === undefined ? undefined : paymentSettingsIssue(settings.payment)
}

/** Shape only. Placement, sources and the amount's range are proved at publication (FLOW-006). */
export function paymentSettingsIssue(value: unknown): string | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'A payment step needs its pricing.'
  const settings = value as Record<string, unknown>
  if (Object.keys(settings).some(key => !['products', 'options', 'calculationId', 'minimum', 'maximum', 'automaticTax', 'promotionCodes', 'couponId', 'receipts'].includes(key))) return 'A payment step has an unknown setting.'
  if (!cents(settings.minimum, paymentLimits.minimum) || !cents(settings.maximum, paymentLimits.minimum) || settings.minimum > settings.maximum) return `Set a minimum and maximum between ${formatUsd(paymentLimits.minimum)} and ${formatUsd(paymentLimits.maximum)}, with the minimum no larger than the maximum.`
  for (const key of ['automaticTax', 'promotionCodes', 'receipts']) if (settings[key] !== undefined && typeof settings[key] !== 'boolean') return 'Checkout switches must be on or off.'
  if (settings.couponId !== undefined && (typeof settings.couponId !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(settings.couponId))) return 'Enter a valid Stripe coupon identifier.'
  if (settings.couponId && settings.promotionCodes) return 'Use a coupon or allow promotion codes, rather than both.'
  const products = settings.products, options = settings.options
  if (!Array.isArray(products) || products.length > paymentLimits.products || !Array.isArray(options) || options.length > paymentLimits.options) return `A payment step lists at most ${paymentLimits.products} products and ${paymentLimits.options} option-price questions.`
  for (const product of products as unknown[]) {
    const item = product as Record<string, unknown>
    if (!item || typeof item !== 'object' || Object.keys(item).some(key => !['id', 'name', 'unitAmount', 'quantity', 'quantityStepId'].includes(key)) || !identifier(item.id)
      || typeof item.name !== 'string' || !item.name.trim() || item.name.length > paymentLimits.nameCharacters || !cents(item.unitAmount, 1)
      || (item.quantity !== undefined && (!Number.isInteger(item.quantity) || (item.quantity as number) < 1 || (item.quantity as number) > paymentLimits.quantity))
      || (item.quantityStepId !== undefined && (!identifier(item.quantityStepId) || item.quantity !== undefined))) return 'Each product needs a name, a price of at least one cent, and either a fixed quantity or a quantity question.'
  }
  if (new Set((products as PaymentProduct[]).map(product => product.id)).size !== products.length) return 'Each product needs a distinct identifier.'
  for (const option of options as unknown[]) {
    const item = option as Record<string, unknown>
    if (!item || typeof item !== 'object' || Object.keys(item).some(key => !['stepId', 'prices'].includes(key)) || !identifier(item.stepId) || !item.prices || typeof item.prices !== 'object' || Array.isArray(item.prices)
      || !Object.keys(item.prices).length || Object.entries(item.prices).some(([choiceId, price]) => !identifier(choiceId) || !cents(price))) return 'Each option-price question needs a price for at least one of its choices.'
  }
  if (new Set((options as PaymentOption[]).map(option => option.stepId)).size !== options.length) return 'Price each choice question once.'
  if (settings.calculationId !== undefined && (!identifier(settings.calculationId) || products.length || options.length)) return 'A calculated amount replaces products and option prices; use one or the other.'
  if (settings.calculationId === undefined && !products.length && !options.length) return 'Add a product, an option price or a calculated amount.'
  return undefined
}

/** The respondent's total from accepted on-path answers and server-evaluated calculations. A blank quantity or
 * option adds nothing; a blank or out-of-range total cannot be charged. */
export function paymentQuote(settings: PaymentSettings, flow: { steps: FlowStep[]; choices: ChoiceOption[] }, answers: Record<string, unknown>, calculations: Record<string, unknown>, label: string): PaymentQuote | { issue: string } {
  const lines: PaymentLine[] = []
  if (settings.calculationId !== undefined) {
    const value = calculations[settings.calculationId]
    if (typeof value !== 'number' || !Number.isFinite(value)) return { issue: 'The amount could not be calculated from these answers. Go back and check them.' }
    lines.push({ name: label, unitAmount: Math.round(value * 100), quantity: 1 })
  }
  for (const product of settings.products) {
    const answered = product.quantityStepId === undefined ? product.quantity ?? 1 : answers[product.quantityStepId]
    const quantity = typeof answered === 'number' && Number.isInteger(answered) && answered >= 0 ? answered : 0
    if (quantity > paymentLimits.quantity) return { issue: `Order at most ${paymentLimits.quantity} of “${product.name}”.` }
    if (quantity) lines.push({ name: product.name, unitAmount: product.unitAmount, quantity })
  }
  for (const option of settings.options) {
    const question = flow.steps.find(step => step.id === option.stepId)
    for (const choiceId of selectedChoiceIds(answers[option.stepId])) {
      const price = option.prices[choiceId], choice = flow.choices.find(entry => entry.stepId === option.stepId && entry.id === choiceId)
      if (price && choice) lines.push({ name: `${question?.prompt ?? 'Option'}: ${choice.label}`.slice(0, paymentLimits.nameCharacters), unitAmount: price, quantity: 1 })
    }
  }
  const total = lines.reduce((sum, line) => sum + line.unitAmount * line.quantity, 0)
  if (total < settings.minimum || total > settings.maximum) return { issue: `The total ${formatUsd(total)} is outside this form's limits of ${formatUsd(settings.minimum)} to ${formatUsd(settings.maximum)}. Go back and check your answers.` }
  if (lines.some(line => line.unitAmount < 1)) return { issue: 'A calculated amount must be at least one cent.' }
  return { lines, total, checkout: { automaticTax: settings.automaticTax, promotionCodes: settings.promotionCodes, couponId: settings.couponId, receipts: settings.receipts } }
}

/** Builder copies and duplicates keep a payment step pointing at the copied questions, choices and calculation. */
export function remapPaymentSettings(value: PaymentSettings, steps: ReadonlyMap<string, string>, choices: ReadonlyMap<string, string>): PaymentSettings {
  return {
    ...value,
    products: value.products.map(product => product.quantityStepId === undefined ? product : { ...product, quantityStepId: steps.get(product.quantityStepId) ?? product.quantityStepId }),
    options: value.options.map(option => ({ stepId: steps.get(option.stepId) ?? option.stepId, prices: Object.fromEntries(Object.entries(option.prices).map(([choiceId, price]) => [choices.get(choiceId) ?? choiceId, price])) })),
    ...(value.calculationId === undefined ? {} : { calculationId: steps.get(`variable:${value.calculationId}`)?.slice('variable:'.length) ?? value.calculationId }),
  }
}
