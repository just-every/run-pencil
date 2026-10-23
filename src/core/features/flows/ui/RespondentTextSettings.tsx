import { useState } from 'react'
import type { BuilderDraft } from '../../../app/api'
import { respondentTextDefaults, respondentTextLimits, type RespondentText, type RespondentTextKey } from '../../../shared/respondentText'

const fields: Array<{ key: RespondentTextKey; label: string; message: boolean }> = [
  { key: 'startLabel', label: 'Start button label', message: false },
  { key: 'nextLabel', label: 'Next button label', message: false },
  { key: 'submitLabel', label: 'Submit button label', message: false },
  { key: 'progressText', label: 'Progress text (use {remaining} for the count)', message: false },
  { key: 'closedMessage', label: 'Closed-form message', message: true },
  { key: 'limitMessage', label: 'Response-limit message', message: true },
]

/** LANG-002: per-form overrides of Pencil's respondent text. Part of the published revision; an empty field uses Pencil's default. */
export function RespondentTextSettings({ draft, disabled, onSave }: { draft: BuilderDraft; disabled: boolean; onSave: (text: RespondentText) => Promise<void> }) {
  const [value, setValue] = useState<RespondentText>(draft.formSettings?.text ?? {})
  const [saving, setSaving] = useState(false), [error, setError] = useState<string>()
  const busy = disabled || saving
  return <details><summary className="focus-ring">Respondent text</summary>
    <p className="muted">Plain text only. Leave a field empty to use Pencil’s wording. Publish to apply. Button labels allow {respondentTextLimits.labelCharacters} characters and messages {respondentTextLimits.messageCharacters}.</p>
    {fields.map(field => <label className="inspector-field" key={field.key}>{field.label}
      {field.message
        ? <textarea className="textarea-input" disabled={busy} value={value[field.key] ?? ''} maxLength={respondentTextLimits.messageCharacters} placeholder={respondentTextDefaults[field.key]} onChange={event => setValue(current => ({ ...current, [field.key]: event.target.value }))} />
        : <input className="text-input" disabled={busy} value={value[field.key] ?? ''} maxLength={respondentTextLimits.labelCharacters} placeholder={respondentTextDefaults[field.key]} onChange={event => setValue(current => ({ ...current, [field.key]: event.target.value }))} />}
    </label>)}
    <button className="secondary-button focus-ring" type="button" disabled={busy} onClick={async () => { setSaving(true); setError(undefined); try { await onSave(Object.fromEntries(Object.entries(value).filter(([, text]) => text !== ''))) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Respondent text could not be saved.') } finally { setSaving(false) } }}>Save respondent text</button>
    {error ? <p role="alert">{error}</p> : null}
  </details>
}
