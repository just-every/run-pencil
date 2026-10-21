import { useEffect, useState } from 'react'
import { api, type PaymentReturnView } from '../../../app/api'
import type { PublicSeedConfig } from '../../../shared/config'
import { useRespondentFocus } from '../../../shared/ui/useRespondentFocus'
import { BrandIdentity, brandStyle } from '../../brand'
import { RespondentFlowPage } from './RespondentFlowPage'

/** Stripe Checkout's success and cancel links land here. Success shows the completion screen the path reached; cancel
 * reopens the payment step with every answer, ready for the next attempt under the same response key. */
export function PaymentReturnPage({ config, slug, token, outcome }: { config: PublicSeedConfig; slug: string; token: string; outcome: 'success' | 'cancel' }) {
  const [view, setView] = useState<PaymentReturnView>()
  const [error, setError] = useState<string>()
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    setError(undefined)
    api.paymentReturn(slug, { token, outcome }).then(value => {
      if (!active) return
      if (value.state === 'completed' && value.redirectUrl) window.location.assign(value.redirectUrl)
      setView(value)
    }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Your payment status could not load. Try again.') })
    return () => { active = false }
  }, [slug, token, outcome, attempt])
  useRespondentFocus(view?.state ?? error, Boolean(error), 'payment-return-title')
  if (view?.state === 'open') return <RespondentFlowPage key={view.sessionToken} config={config} slug={slug} initialFlow={view.flow} resume={view} payment={{ state: view.payment.state, notice: view.payment.state === 'expired' ? 'Your checkout expired before payment. Your answers are kept: go back to change them, or pay again.' : 'Payment cancelled. Your answers are kept: go back to change them, or pay again.' }} />
  if (view?.state === 'completed') return <RespondentFlowPage config={config} slug={slug} initialFlow={{ ...view.flow, completedStepId: view.completionStepId }} restoredAnswers={view.answers} payment={view.payment} />
  return <main className="pencil-canvas respondent-shell brand-surface" style={brandStyle(config)}><article className="respondent-card respondent-note-sheet"><BrandIdentity config={config} />
    <h1 className="display" id="payment-return-title" tabIndex={-1}>{outcome === 'success' ? 'Returning from Stripe' : 'Returning to your answers'}</h1>
    {error ? <><p className="status-note" data-tone="error" role="alert">{error}</p><button className="primary-button focus-ring" type="button" onClick={() => setAttempt(value => value + 1)}>Try again</button></> : <p role="status">Loading your response…</p>}
  </article></main>
}
