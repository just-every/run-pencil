import type { PublicFlow } from '../../../app/api'

/** RESP-005 before answering: a payment form names Stripe and what it receives. */
export function PaymentDisclosure({ flow }: { flow: Pick<PublicFlow, 'steps'> }) {
  if (!flow.steps.some(step => step.kind === 'payment')) return null
  return <span data-disclosure="payment" style={{ display: 'block', marginTop: '.5rem' }}>This form takes payment on Stripe Checkout, Stripe’s own page. Stripe receives your order’s items and amounts, never your other answers; card and bank details go only to Stripe.</span>
}
