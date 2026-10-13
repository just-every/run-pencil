import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { audienceRequest as request, launchSummary, segmentsPath, type Contact, type Segment, type Launch } from './audienceApi'
type Delivery = { id: string; name: string | null; email: string | null; revisionId: string; deliveryId: string; kind: string; status: string; reason: string | null; attempts: number; responseStatus: string; optedOutAt: string | null }
export function DistributionPanel({ flowId }: { flowId: string }) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [contactSearch, setContactSearch] = useState(''), [contactOffset, setContactOffset] = useState(0)
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [sender, setSender] = useState('Loading delivery availability…')
  const [selected, setSelected] = useState<string[]>([])
  const [segments, setSegments] = useState<Segment[]>([]), [segmentId, setSegmentId] = useState('')
  const [launches, setLaunches] = useState<Launch[]>([])
  const [pendingLaunch, setPendingLaunch] = useState<{ selector?: { segmentId: string } | { contactIds: string[] }; commandKey: string }>()
  const [error, setError] = useState<string>(), [notice, setNotice] = useState<string>()
  const [busy, setBusy] = useState(false)
  const load = async () => {
    const [nextContacts, nextSegments, distribution] = await Promise.all([request<Contact[]>(`/api/app/distribution/contacts?q=${encodeURIComponent(contactSearch)}&offset=${contactOffset}&limit=250`), request<Segment[]>(segmentsPath), request<{ sender: { message: string }; participants: Delivery[]; launches: Launch[] }>(`/api/app/flows/${encodeURIComponent(flowId)}/distribution`)])
    setContacts(nextContacts); setSegments(nextSegments); setLaunches(distribution.launches); setDeliveries(distribution.participants); setSender(distribution.sender.message)
  }
  useEffect(() => { void load().catch(e => setError((e as Error).message)) }, [flowId])
  useEffect(() => { let current = true; void request<Contact[]>(`/api/app/distribution/contacts?q=${encodeURIComponent(contactSearch)}&offset=${contactOffset}&limit=250`).then(people => { if (current) setContacts(people) }).catch(e => { if (current) setError((e as Error).message) }); return () => { current = false } }, [contactSearch, contactOffset])
  const act = async (operation: () => Promise<unknown>, success: string) => {
    setBusy(true); setError(undefined); setNotice(undefined)
    try { await operation(); await load(); setNotice(success) } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  const launch = async (selector?: { segmentId: string } | { contactIds: string[] }, savedKey?: string) => {
    setBusy(true); setError(undefined); setNotice(undefined)
    const commandKey = savedKey ?? crypto.randomUUID()
    setPendingLaunch({ selector, commandKey })
    try {
      let result: Launch
      do { result = await request<Launch>(`/api/app/flows/${flowId}/distribution`, { ...selector, commandKey }); setNotice(`Launch processing: ${launchSummary(result)}.`) } while (!result.complete)
      setPendingLaunch(undefined); setSelected([]); await load(); setNotice(`Launch complete: ${launchSummary(result)}. Review each durable delivery outcome below.`)
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  return <section className="panel flow-share-panel" aria-labelledby="distribution-title">
    <h2 id="distribution-title">Invitations</h2><p className="status-note">{sender}</p>
    {error ? <p role="alert" className="status-note" data-tone="error">{error}</p> : null}
    {notice ? <p role="status" className="status-note">{notice}</p> : null}
    <p><Link className="quiet-button focus-ring" to="/app/audience">Manage contacts, CSV imports and segments in Audience</Link></p>
    <label className="inspector-field">Launch segment<select className="text-input" disabled={busy} value={segmentId} onChange={event => setSegmentId(event.target.value)}><option value="">Choose a saved segment</option>{segments.map(segment => <option key={segment.id} value={segment.id}>{segment.name} · {segment.matchCount} current matches</option>)}</select></label>
    <button className="secondary-button focus-ring" type="button" disabled={busy || !!pendingLaunch || launches.some(item => item.resumable) || !segmentId} onClick={() => void launch({ segmentId })}>Queue segment invitations</button>
    <p>Launches freeze the audience and evaluated eligibility and reminder policies. Later edits do not change their recipients or addresses.</p>
    <label className="inspector-field">Search invitation contacts<input className="text-input" type="search" value={contactSearch} onChange={e => { setContactSearch(e.target.value); setContactOffset(0) }} /></label>
    <p>{contacts.length} contacts on this page · {selected.length} selected across pages. Search checks the whole audience.</p>
    <p><button className="quiet-button focus-ring" type="button" disabled={busy || contactOffset === 0} onClick={() => setContactOffset(Math.max(0, contactOffset - 250))}>Previous invitation contacts</button>{' '}<button className="quiet-button focus-ring" type="button" disabled={busy || contacts.length < 250} onClick={() => setContactOffset(contactOffset + 250)}>Next invitation contacts</button></p>
    {contacts.length ? <fieldset disabled={busy}><legend>Eligible recipients</legend>{contacts.map(contact => <div key={contact.id} style={{ overflowWrap: 'anywhere' }}>
      <label><input type="checkbox" disabled={!!contact.optedOutAt} checked={selected.includes(contact.id)} onChange={event => setSelected(current => event.target.checked ? [...current, contact.id] : current.filter(id => id !== contact.id))} /> {contact.name} — {contact.email}{contact.optedOutAt ? ' · opted out' : ''}</label>
    </div>)}</fieldset> : <p>No recipients saved.</p>}
    <button className="secondary-button focus-ring" type="button" disabled={busy || !!pendingLaunch || launches.some(item => item.resumable) || !selected.length} onClick={() => void launch({ contactIds: selected })}>Queue selected invitations</button>
    {pendingLaunch ? <p><button className="secondary-button focus-ring" disabled={busy} type="button" onClick={() => void launch(pendingLaunch.selector, pendingLaunch.commandKey)}>Resume invitation launch</button> The saved command resumes the same frozen audience.</p> : null}
    {launches.length ? <section aria-label="Invitation launch counts"><h3>Launch outcomes</h3><ul>{launches.map(item => <li key={item.id}>{launchSummary(item)} · {item.state === 'recovery-required' ? 'Restored unfinished launch cannot resume. Publish a new revision and start a new launch; restored links stay inactive.' : item.state}{item.resumable ? <button className="quiet-button focus-ring" disabled={busy} type="button" onClick={() => void launch(undefined, item.commandKey)}>Resume saved launch</button> : null}</li>)}</ul></section> : null}
    {deliveries.length ? <ul>{deliveries.map(delivery => <li key={delivery.deliveryId} style={{ overflowWrap: 'anywhere' }}>
      <strong>{delivery.name ?? 'Erased recipient'}</strong>{delivery.email ? ` · ${delivery.email}` : ''} · {delivery.kind}: {delivery.status} · response: {delivery.responseStatus} · {delivery.attempts} attempts
      {delivery.reason ? <p>{delivery.reason}</p> : null}
      {['failed','unknown'].includes(delivery.status) ? <button className="quiet-button focus-ring" disabled={busy} type="button" onClick={() => { const accepted = delivery.status === 'unknown' && window.confirm('The provider outcome is unknown. Resending can deliver a duplicate. Explicitly accept that risk?'); if (delivery.status !== 'unknown' || accepted) void act(() => request(`/api/app/distribution/deliveries/${delivery.deliveryId}/retry`, { duplicateRiskAccepted: accepted }), 'Retry requested with the original delivery key. Review its recorded outcome below.') }}>Queue retry{delivery.status === 'unknown' ? ' (duplicate risk)' : ''}</button> : null}
    </li>)}</ul> : <p>No invitations have been launched for this flow.</p>}
  </section>
}
