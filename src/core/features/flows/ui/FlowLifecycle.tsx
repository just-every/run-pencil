import { useState } from 'react'

type Action = 'close' | 'reopen' | 'archive' | 'restore'

/**
 * The builder's lifecycle strip. Archive asks once, in the page, naming the form that goes offline; an archived flow says so and offers Restore,
 * which brings it back closed (or as a draft when it was never published) for the owner to reopen or publish.
 */
export function FlowLifecycle({ title, status, disabled, onChange }: { title: string; status: 'draft' | 'open' | 'closed' | 'archived'; disabled: boolean; onChange: (action: Action) => Promise<void> }) {
  const [confirming, setConfirming] = useState(false)
  const label = status[0].toUpperCase() + status.slice(1)
  const archive = async () => { setConfirming(false); await onChange('archive') }
  return <footer className="builder-lifecycle" aria-label="Flow lifecycle">
    <div className="builder-lifecycle-status"><p className="eyebrow">Flow lifecycle</p><span className="badge" data-status={status}>{label}</span><p>{status === 'archived' ? 'The public form is offline.' : 'Publish your saved changes when you are ready to share.'}</p></div>
    {confirming ? <div className="builder-actions" role="group" aria-label={`Archive ${title}`}>
      <p className="builder-lifecycle-confirm" role="alert">Archive “{title}”? Its public form goes offline and its link shows “not found”. Responses are kept.</p>
      <button className="danger-button focus-ring" disabled={disabled} onClick={() => void archive()} type="button">Archive flow</button>
      <button className="secondary-button focus-ring" onClick={() => setConfirming(false)} type="button">Keep flow</button>
    </div> : <div className="builder-actions">
      {status === 'open' || status === 'closed' ? <button className="secondary-button focus-ring" disabled={disabled} onClick={() => void onChange('close')} type="button">Close responses</button> : null}
      {status === 'closed' ? <button className="secondary-button focus-ring" disabled={disabled} onClick={() => void onChange('reopen')} type="button">Reopen current revision</button> : null}
      {status === 'archived' ? <button className="secondary-button focus-ring" disabled={disabled} onClick={() => void onChange('restore')} type="button">Restore</button> : <button className="secondary-button focus-ring" disabled={disabled} onClick={() => setConfirming(true)} type="button">Archive flow</button>}
    </div>}
  </footer>
}
