import { formatUsd, paymentStateLabels, type LedgerPayment } from '../../../shared/payments'
import './payments.css'

export function PaymentBadge({ payment }: { payment: LedgerPayment }) {
  return <span className="payment-state" data-state={payment.state}>{paymentStateLabels[payment.state]} · {formatUsd(payment.amount)}</span>
}

/** The operator's view of a response's payment: its state, Pencil's amount and Stripe's IDs. Card or bank numbers are never stored. */
export function PaymentRecord({ payment, time }: { payment: LedgerPayment; time: (value: string) => string }) {
  // An expired or cancelled checkout can no longer be charged; a failed one can still be paid on the same page.
  const ended = payment.state === 'expired' || payment.state === 'cancelled'
  const rows: Array<[string, React.ReactNode]> = [
    ['Provider', 'Stripe'],
    ...(payment.mode ? [['Payment mode', payment.mode]] as Array<[string, React.ReactNode]> : []),
    ['Method', `${payment.methodType ?? 'Not received'}${payment.methodLast4 ? ` · ending ${payment.methodLast4}` : ''}`],
    ['Refunded', formatUsd(payment.refundedAmount ?? 0)],
    ...(payment.subscriptionStatus ? [['Subscription', payment.subscriptionStatus], ['Billing management', 'Stripe customer portal']] as Array<[string, React.ReactNode]> : []),
    ['State', <PaymentBadge payment={payment} />],
    ['Subtotal', payment.providerAmount === null ? ended ? 'Not charged' : 'Not yet' : formatUsd(payment.providerAmount)],
    ...([['Discount', payment.discount], ['Tax', payment.tax], ['Total charged', payment.total]] as const).map(([label, amount]): [string, React.ReactNode] => [label, amount == null ? 'Not yet' : formatUsd(amount)]),
    ['Checkout Session', <code>{payment.checkoutSessionId ?? 'Not opened'}</code>],
    ['Payment intent', <code>{payment.paymentIntentId ?? (ended ? 'None' : 'None yet')}</code>],
    ['Last change', `${time(payment.stateChangedAt)}${payment.attempt > 1 ? ` · attempt ${payment.attempt}` : ''}`],
  ]
  return <section aria-label="Payment"><p className="muted">Payment</p><dl>{rows.map(([label, value]) => <div className="ledger-answer" key={label}>
    <dt><strong>{label}</strong></dt><dd style={{ overflowWrap: 'anywhere' }}>{value}</dd>
  </div>)}</dl><a className="quiet-button focus-ring" href="/app/payments">View payments and refunds</a></section>
}
