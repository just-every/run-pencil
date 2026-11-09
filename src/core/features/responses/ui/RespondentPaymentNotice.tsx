import { Check, Clock3 } from 'lucide-react'
import type { PaymentState } from '../../../shared/payments'

export function RespondentPaymentNotice({ state }: { state: PaymentState }) {
  const processing = state === 'processing'
  return <p className="privacy-card respondent-payment-notice" data-state={state} role="status" aria-label="Payment status" aria-live="polite" aria-atomic="true">
    {processing ? <Clock3 aria-hidden="true" size={22} /> : <Check aria-hidden="true" color="var(--green)" size={22} />}
    <span>{processing ? <><strong>Payment processing</strong> Your payment is not paid yet; the business sees it once Stripe confirms.</> : state === 'paid' ? 'Your payment is received.' : state === 'refunded' ? 'Your payment was refunded.' : 'Stripe is confirming your payment; the business sees it once Stripe confirms.'}</span>
  </p>
}
