import { useState } from 'react'

export function SaveResponse({ disabled, onSave }: { disabled: boolean; onSave: (email: string) => Promise<{ expiresAt: string }> }) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [expires, setExpires] = useState<string>()
  if (!open) return <button className="quiet-button focus-ring respondent-save" disabled={disabled} type="button" onClick={() => setOpen(true)}>Save and finish later</button>
  return <section className="privacy-card respondent-save-panel" aria-label="Save and finish later">
    <div>
      <h2>Finish when you’re ready</h2>
      {expires ? <><p role="status">Your answers are saved. Check your email for a private link that works on another device until {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(expires))}, or until this form closes.</p><button className="secondary-button focus-ring" type="button" onClick={() => { setOpen(false); setExpires(undefined) }}>Continue now</button></> :
        <form onSubmit={async event => {
          event.preventDefault(); setBusy(true); setError(undefined)
          try { const saved = await onSave(email); setExpires(saved.expiresAt); setEmail('') }
          catch (reason) { setError(reason instanceof Error ? reason.message : 'Your answers could not be saved. Try again.') }
          finally { setBusy(false) }
        }}>
          <p>Save the answers you have entered and email yourself a private resume link. This address is used only for that link and is separate from any email answer in this form.</p>
          <label className="inspector-field">Email for your resume link<input className="text-input" type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} disabled={busy} /></label>
          {error ? <p className="status-note" data-tone="error" role="alert">{error}</p> : null}
          <div className="builder-actions"><button className="primary-button focus-ring" disabled={disabled || busy} type="submit">{busy ? 'Saving…' : 'Email resume link'}</button><button className="quiet-button focus-ring" disabled={busy} type="button" onClick={() => setOpen(false)}>Keep answering</button></div>
        </form>}
    </div>
  </section>
}
