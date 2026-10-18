import './hidden-fields.css'
import { useEffect, useState } from 'react'
import { hiddenFieldLimits, hiddenSettingsIssue, type FormSettings, type HiddenField } from '../../../shared/hiddenFields'
import { useProtectUnsavedChanges } from '../../../shared/ui/UnsavedChanges'

type Props = {
  settings: FormSettings
  disabled: boolean
  onSave: (settings: FormSettings) => Promise<void> | void
  onDirtyChange?: (dirty: boolean) => void
}

export function HiddenFieldsSettings(props: Props) {
  return <HiddenFieldsEditor key={JSON.stringify(props.settings)} {...props} />
}

function HiddenFieldsEditor({ settings, disabled, onSave, onDirtyChange }: Props) {
  const [draft, setDraft] = useState(settings)
  const [saved, setSaved] = useState(JSON.stringify(settings))
  const [error, setError] = useState('')
  const dirty = JSON.stringify(draft) !== saved
  const markSaved = useProtectUnsavedChanges(dirty)
  const issue = hiddenSettingsIssue(draft)
  useEffect(() => {
    onDirtyChange?.(dirty)
    return () => onDirtyChange?.(false)
  }, [dirty, onDirtyChange])

  function updateField(id: string, change: Partial<HiddenField>) {
    setError('')
    setDraft(current => ({
      ...current,
      hiddenFields: current.hiddenFields.map(field => field.id === id ? { ...field, ...change } : field),
    }))
  }

  async function save() {
    if (disabled || issue || !dirty) return
    setError('')
    try {
      await onSave(draft)
      setSaved(JSON.stringify(draft))
      markSaved()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Hidden fields could not be saved.')
    }
  }

  return <details className="quiet-panel hidden-fields-settings" style={{ minWidth: 0 }}>
    <summary className="focus-ring">Hidden fields and identity</summary>
    <fieldset disabled={disabled} style={{ minWidth: 0, border: 0, padding: 0 }}>
      <legend>Public link settings</legend>
      <p className="muted">Hidden field names are query parameters in the form link, such as ?campaign=spring. Their values are unverified input from the visitor.</p>
      <label className="inspector-field">Public link identity
        <select aria-label="Public link identity" className="text-input" value={draft.identityMode} onChange={event => {
          setError('')
          setDraft(current => ({ ...current, identityMode: event.target.value as FormSettings['identityMode'] }))
        }}>
          <option value="anonymous">Anonymous</option>
          <option value="identified">Identified</option>
        </select>
      </label>
      <p className="muted">Anonymous forms cannot be published with identifying hidden fields. Click IDs on anonymous forms are discarded until conversion delivery is available.</p>
      <p className="muted">Use lowercase names beginning with a letter, followed by letters, numbers or underscores. Email fields must have the identifying purpose.</p>
      {draft.hiddenFields.map((field, index) => <fieldset className="quiet-panel hidden-field-row" key={field.id} style={{ minWidth: 0 }}>
        <legend>Hidden field {index + 1}</legend>
        <label className="inspector-field">Parameter name {index + 1}
          <input className="text-input" style={{ minWidth: 0, width: '100%' }} value={field.name} maxLength={64}
            onChange={event => updateField(field.id, { name: event.target.value })} />
        </label>
        <label className="inspector-field">Value type {index + 1}
          <select aria-label={`Value type ${index+1}`} className="text-input" value={field.type} onChange={event => {
            const type = event.target.value as HiddenField['type']
            updateField(field.id, { type, ...(type === 'email' ? { category: 'identifying' } : {}) })
          }}>
            <option value="text">Text</option>
            <option value="number">Number</option>
            <option value="email">Email</option>
            <option value="date">Date</option>
            <option value="boolean">True or false</option>
          </select>
        </label>
        <label className="inspector-field">Purpose {index + 1}
          <select aria-label={`Purpose ${index+1}`} className="text-input" value={field.category} onChange={event => updateField(field.id, { category: event.target.value as HiddenField['category'] })}>
            <option value="plain">Plain</option>
            <option value="campaign">Campaign</option>
            <option value="identifying">Identifying</option>
            <option value="click_id">Click ID</option>
          </select>
        </label>
        <button className="secondary-button focus-ring" type="button" aria-label={`Remove hidden field ${index + 1}`} onClick={() => {
          setError('')
          setDraft(current => ({ ...current, hiddenFields: current.hiddenFields.filter(item => item.id !== field.id) }))
        }}>Remove field</button>
      </fieldset>)}
      <button className="secondary-button focus-ring" type="button" disabled={draft.hiddenFields.length >= hiddenFieldLimits.perRevision} onClick={() => {
        setError('')
        setDraft(current => ({ ...current, hiddenFields: [...current.hiddenFields, { id: crypto.randomUUID(), name: '', type: 'text', category: 'plain' }] }))
      }}>Add hidden field</button>
      {dirty && issue ? <p role="alert">{issue}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      <button className="secondary-button focus-ring" type="button" disabled={!dirty || !!issue} onClick={() => { void save() }}>Save hidden fields</button>
    </fieldset>
  </details>
}
