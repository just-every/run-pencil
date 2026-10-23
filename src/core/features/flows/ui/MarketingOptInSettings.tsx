import { useState } from 'react'
import type { BuilderDraft } from '../../../app/api'
import { marketingWordingLimit, type MarketingOptIn } from '../../../shared/marketingConsent'

const defaultWording = 'By submitting you agree to receive our emails. You can unsubscribe at any time.'

/** GOV-007: the form itself as the email-marketing opt-in. SMS marketing is never form-level: it needs its own unticked consent question. */
export function MarketingOptInSettings({ draft, disabled, onSave }: { draft: BuilderDraft; disabled: boolean; onSave: (marketing: MarketingOptIn | undefined) => Promise<void> }) {
  const saved = draft.formSettings?.marketing
  const [enabled, setEnabled] = useState(!!saved), [wording, setWording] = useState(saved?.wording ?? defaultWording)
  const [saving, setSaving] = useState(false), [error, setError] = useState<string>()
  const busy = disabled || saving
  return <details><summary className="focus-ring">Email marketing opt-in</summary>
    <p className="muted">Off by default. When on, this wording is shown directly above the submit button and is stored with each response as its email-marketing consent, with the time. Nothing is sent to an email platform yet. SMS marketing cannot be a form-level opt-in: add a separate unticked consent question with the disclosure and the SMS marketing purpose.</p>
    <label className="toggle-row"><input type="checkbox" checked={enabled} disabled={busy} onChange={event => setEnabled(event.target.checked)} /><span>This form is an email-marketing opt-in</span></label>
    {enabled ? <label className="inspector-field">Opt-in wording<textarea className="textarea-input" disabled={busy} value={wording} maxLength={marketingWordingLimit} onChange={event => setWording(event.target.value)} /></label> : null}
    <button className="secondary-button focus-ring" type="button" disabled={busy} onClick={async () => { setSaving(true); setError(undefined); try { await onSave(enabled ? { purpose: 'email_marketing', wording } : undefined) } catch (reason) { setError(reason instanceof Error ? reason.message : 'The opt-in could not be saved.') } finally { setSaving(false) } }}>Save marketing opt-in</button>
    {error ? <p role="alert">{error}</p> : null}
  </details>
}
