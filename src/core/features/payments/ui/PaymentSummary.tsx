import { formAnswerContext } from '../../../shared/calculationContext'
import { formatUsd, paymentQuote, paymentSettings, type PaymentQuote } from '../../../shared/payments'
import type { FlowStep, PublicFlow } from '../../../app/api'
import './payments.css'

/** The same quote the Worker recomputes before checkout, from accepted on-path answers and calculations. */
export function paymentQuoteFor(flow: Pick<PublicFlow, 'steps' | 'choices' | 'formSettings' | 'hiddenContext'>, step: FlowStep, answers: Record<string, unknown>): PaymentQuote | { issue: string } {
  const settings = paymentSettings(step)
  if (!settings) return { issue: 'This payment step has no pricing yet.' }
  const context = formAnswerContext(flow.formSettings, answers, flow.hiddenContext)
  const calculations = Object.fromEntries(Object.entries(context).filter(([id]) => id.startsWith('variable:')).map(([id, value]) => [id.slice('variable:'.length), value]))
  return paymentQuote(settings, flow, answers, calculations, step.prompt)
}

export function PaymentSummary({ quote }: { quote: PaymentQuote | { issue: string } }) {
  if ('issue' in quote) return <p className="status-note" data-tone="error" role="alert">{quote.issue}</p>
  return <dl className="payment-summary" aria-label="Order summary">
    {quote.lines.map((line, index) => <div className="payment-summary__line" key={`${index}:${line.name}`}><dt>{line.name}{line.quantity > 1 ? ` × ${line.quantity}` : ''}</dt><dd>{formatUsd(line.unitAmount * line.quantity)}</dd></div>)}
    <div className="payment-summary__line payment-summary__total"><dt>Total</dt><dd>{formatUsd(quote.total)}</dd></div>
  </dl>
}
