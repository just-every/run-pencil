import { BrandIdentity } from '../../brand'
import { brandStyle } from '../../brand'
import { useEmbedProtocol } from '../../embedding'
import type { ClosedFlow } from '../../../app/api'
import type { PublicSeedConfig } from '../../../shared/config'

export function PublicClosedPage({ config, flow, landing, embedded, recovery }: { recovery?: { mode: 'submission' | 'session'; busy: boolean; error?: string; onRetry: () => void }; config: PublicSeedConfig; flow: ClosedFlow; landing?: boolean; embedded?: boolean }) {
  useEmbedProtocol(!!embedded, false, config.embedHostOrigin)
  const theme = brandStyle(config)
  return <main className="pencil-canvas respondent-shell brand-surface" data-state="closed" data-landing={landing ? 'true' : undefined} data-embedded={embedded ? 'true' : undefined} style={theme}>
    {landing ? <header className="respondent-landing-header"><span className="eyebrow">{config.publicFlowBusinessName}</span><a className="secondary-button focus-ring" href="/signin">Operator sign in</a></header> : null}
    <article className="respondent-card respondent-note-sheet" aria-labelledby="closed-title">
      <BrandIdentity config={config} />
      <h1 className="display" id="closed-title">This feedback flow is closed.</h1>
      <p className="respondent-helper">{flow.title}</p>
      <p>Thank you for your interest. This form is no longer accepting responses.</p>
      {recovery ? <section aria-label={recovery.mode === 'submission' ? 'Pending submission' : 'Response recovery'}><p>Your answers are kept privately in this tab. {recovery.mode === 'submission' ? 'Retry to check this submission.' : 'Try again to answer the current form.'}</p>{recovery.error ? <p className="status-note" data-tone="error" role="alert">{recovery.error}</p> : null}<button className="primary-button focus-ring" disabled={recovery.busy} onClick={recovery.onRetry} type="button">{recovery.busy ? 'Checking…' : recovery.mode === 'submission' ? 'Retry submission' : 'Start again'}</button></section> : null}
    </article>
    {landing && config.showPoweredByCredit ? <footer className="respondent-landing-credit">Powered by {config.productName} · <a href="https://runeditrun.com">runeditrun.com</a></footer> : null}
  </main>
}
