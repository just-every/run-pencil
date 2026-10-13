import { useProtectUnsavedChanges } from '../../../shared/ui/UnsavedChanges'
import { useState } from 'react'
import { audienceRequest, contactsPath, type Contact } from './audienceApi'
export function ContactEditor({ contact, saved, cancel }: { contact?: Contact; saved: () => Promise<void>; cancel: () => void }) {
  const [name, setName] = useState(contact?.name ?? ''), [email, setEmail] = useState(contact?.email ?? '')
  const [fields, setFields] = useState(Object.entries(contact?.fields ?? {}).map(([key, value]) => ({ key, value })))
  const [busy, setBusy] = useState(false), [error, setError] = useState<string>()
  useProtectUnsavedChanges(name !== (contact?.name ?? '') || email !== (contact?.email ?? '') || JSON.stringify(Object.fromEntries(fields.map(field => [field.key, field.value]))) !== JSON.stringify(contact?.fields ?? {}))
  return <form className="panel" style={{ padding: '1.25rem', minWidth: 0 }} onSubmit={event => {
    event.preventDefault(); setBusy(true); setError(undefined)
    void (async () => {
      if (new Set(fields.map(field => field.key)).size !== fields.length) throw new Error('Each custom field needs a different key.')
      await audienceRequest(contact ? `${contactsPath}/${contact.id}` : contactsPath, { name, email, fields: Object.fromEntries(fields.map(field => [field.key, field.value])) }, contact ? 'PUT' : 'POST')
      await saved()
    })().catch(e => setError((e as Error).message)).finally(() => setBusy(false))
  }}>
    <h2>{contact ? 'Edit contact' : 'Add contact'}</h2>
    {error ? <p role="alert" className="status-note" data-tone="error">{error}</p> : null}
    <fieldset style={{ minWidth: 0 }} disabled={busy}><legend>Contact details</legend>
      <label className="inspector-field">Contact name<input className="text-input" required maxLength={200} value={name} onChange={e => setName(e.target.value)} /></label>
      <label className="inspector-field">Contact email<input className="text-input" required type="email" maxLength={320} value={email} onChange={e => setEmail(e.target.value)} /></label>
      {fields.map((field, index) => <div key={index} style={{ marginTop: '.75rem' }}>
        <label className="inspector-field">Field {index + 1} key<input className="text-input" required maxLength={64} value={field.key} onChange={e => setFields(fields.map((f, i) => i === index ? { ...f, key: e.target.value } : f))} /></label>
        <label className="inspector-field">Field {index + 1} value<input className="text-input" maxLength={500} value={field.value} onChange={e => setFields(fields.map((f, i) => i === index ? { ...f, value: e.target.value } : f))} /></label>
        <button type="button" className="quiet-button focus-ring" onClick={() => setFields(fields.filter((_, i) => i !== index))}>Remove field {index + 1}</button>
      </div>)}
      <button type="button" disabled={fields.length >= 20} className="quiet-button focus-ring" onClick={() => setFields([...fields, { key: '', value: '' }])}>Add custom field</button>
    </fieldset>
    <button className="primary-button focus-ring" disabled={busy} type="submit">Save contact</button>{' '}
    <button className="quiet-button focus-ring" disabled={busy} type="button" onClick={cancel}>Cancel contact edit</button>
  </form>
}
