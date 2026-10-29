import { useEffect, useRef, useState } from 'react'
import { audienceRequest, contactsPath, segmentsPath, type Contact, type Segment, type ErasureReceipt } from './audienceApi'
import { ContactEditor } from './ContactEditor'
import { ContactImport } from './ContactImport'
import { AudienceSegments } from './AudienceSegments'
const erasureLabels: Record<string, string> = { contacts: 'Contacts erased', participants: 'Invitations anonymised', responses: 'Responses erased', answers: 'Answers erased', deliveries: 'Delivery records anonymised', attempts: 'Delivery attempts anonymised', consentEvents: 'Consent records erased', localMessages: 'Local mail copies erased' }

export function AudiencePage() {
  const [contacts, setContacts] = useState<Contact[]>([]), [segments, setSegments] = useState<Segment[]>([])
  const [offset, setOffset] = useState(0)
  const [search, setSearch] = useState(''), [editing, setEditing] = useState<Contact | 'new'>()
  const [busy, setBusy] = useState(false), [error, setError] = useState<string>(), [notice, setNotice] = useState<string>()
  const [receipt, setReceipt] = useState<ErasureReceipt>()
  const [loaded, setLoaded] = useState(false), opened = useRef(false)
  const load = async () => { const [people, groups] = await Promise.all([audienceRequest<Contact[]>(`${contactsPath}?q=${encodeURIComponent(search)}&offset=${offset}&limit=250`), audienceRequest<Segment[]>(segmentsPath)]); setContacts(people); setSegments(groups) }
  useEffect(() => { let current = true; void audienceRequest<Contact[]>(`${contactsPath}?q=${encodeURIComponent(search)}&offset=${offset}&limit=250`).then(people => { if (current) { setContacts(people); setLoaded(true); if (!search && !offset && !people.length && !opened.current) { opened.current = true; setEditing('new') } } }).catch(e => { if (current) setError((e as Error).message) }); return () => { current = false } }, [search, offset])
  useEffect(() => { void audienceRequest<Segment[]>(segmentsPath).then(setSegments).catch(e => setError((e as Error).message)) }, [])
  const act = async (operation: () => Promise<unknown>, message: string) => { setBusy(true); setError(undefined); setNotice(undefined); try { await operation(); await load(); setNotice(message) } catch (e) { setError((e as Error).message) } finally { setBusy(false) } }
  const visible = contacts
  // An audience with no contacts at all opens the form to add one (U5); search and paging only appear once there are people to search.
  const empty = loaded && !search && !offset && !contacts.length
  return <section aria-labelledby="audience-title">
    <header className="page-heading"><p className="eyebrow">Contacts and consent</p><h1 className="display" id="audience-title">Audience</h1></header>
    {error ? <p role="alert" className="status-note" data-tone="error">{error}</p> : null}{notice ? <p role="status" className="status-note">{notice}</p> : null}
    {receipt ? <section className="panel" style={{ padding: '1.25rem' }} aria-label="Erasure receipt"><h2>Erasure complete</h2><p>Completed in {receipt.elapsedMilliseconds} milliseconds.</p><dl>{Object.entries(receipt.counts).map(([kind, count]) => <div key={kind}><dt>{erasureLabels[kind]}</dt><dd>{count}</dd></div>)}</dl><p>This receipt contains counts only. Invitation links are revoked and identified answers and local mail copies removed; retained delivery facts are anonymised.</p></section> : null}
    <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 27rem), 1fr))' }}>
      <section className="panel" style={{ padding: '1.25rem', minWidth: 0 }} aria-labelledby="contacts-title"><h2 id="contacts-title">Contacts</h2>
        {empty ? null : <label className="inspector-field">Search contacts<input className="text-input" type="search" value={search} onChange={e => { setSearch(e.target.value); setOffset(0) }} /></label>}
        <button className="secondary-button focus-ring" type="button" disabled={busy} onClick={() => setEditing('new')}>Add contact</button>
        {empty ? null : <><p>{visible.length} contacts on this page{offset ? ` · starting at ${offset + 1}` : ''}. Search checks the whole audience.</p><p><button className="quiet-button focus-ring" type="button" disabled={busy || offset === 0} onClick={() => setOffset(Math.max(0, offset - 250))}>Previous contacts</button>{' '}<button className="quiet-button focus-ring" type="button" disabled={busy || contacts.length < 250} onClick={() => setOffset(offset + 250)}>Next contacts</button></p></>}<ul>{visible.map(contact => <li key={contact.id} style={{ overflowWrap: 'anywhere', marginBottom: '1rem' }}><strong>{contact.name}</strong> · {contact.email}{contact.optedOutAt ? ' · opted out' : ''}
          <dl>{Object.entries(contact.fields).map(([key, value]) => <div key={key} style={{ display: 'flex', gap: '.5rem' }}><dt>{key}:</dt><dd style={{ margin: 0 }}>{value}</dd></div>)}</dl>
          <button className="quiet-button focus-ring" disabled={busy} type="button" aria-label={`Edit contact ${contact.name}`} onClick={() => setEditing(contact)}>Edit</button>{' '}
          <button className="quiet-button focus-ring" disabled={busy} type="button" onClick={() => { const source = contact.optedOutAt ? window.prompt('Record where this recipient explicitly renewed consent:') : 'Operator recorded recipient opt-out'; if (source?.trim()) void act(() => audienceRequest(`${contactsPath}/${contact.id}/consent`, { renewed: !!contact.optedOutAt, source }), contact.optedOutAt ? 'Renewed consent recorded. Cancelled messages remain cancelled.' : 'Flow mail stopped for this contact.') }}>{contact.optedOutAt ? 'Record renewed consent' : 'Record opt-out'}</button>{' '}
          <button className="quiet-button focus-ring" disabled={busy} type="button" aria-label={`Erase contact and responses for ${contact.name}`} onClick={() => { if (window.confirm(`Erase ${contact.name} (${contact.email}), their custom fields, consent history, identified responses and answers, local mail copies, and revoke their invitation links? Delivery facts and audit references will be anonymised.`)) void act(async () => { setReceipt(await audienceRequest<ErasureReceipt>(`${contactsPath}/${contact.id}/erase`, { confirm: true })); if (editing !== 'new' && editing?.id === contact.id) setEditing(undefined) }, 'Contact erasure completed.') }}>Erase contact and responses</button>
        </li>)}</ul>{loaded && !empty && !visible.length ? <p>No contacts match.</p> : null}
      </section>
      {editing ? <ContactEditor key={editing === 'new' ? 'new' : editing.id} contact={editing === 'new' ? undefined : editing} cancel={() => setEditing(undefined)} saved={async () => { await load(); setEditing(undefined); setNotice('Contact saved. No mail was sent.') }} /> : null}
      <ContactImport changed={load} /><AudienceSegments segments={segments} changed={load} />
    </div>
  </section>
}
