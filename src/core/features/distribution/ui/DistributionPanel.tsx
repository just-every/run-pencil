import { useEffect, useState } from 'react'
type Contact = { id: string; name: string; email: string; optedOutAt: string | null }
type Delivery = { id: string; name: string | null; email: string | null; revisionId: string; deliveryId: string; kind: string; status: string; reason: string | null; attempts: number; responseStatus: string; optedOutAt: string | null }
async function request<T>(path: string, body?: unknown) {
  const response = await fetch(path, body === undefined ? undefined : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const data = response.status === 204 ? undefined : await response.json() as { message?: string }
  if (!response.ok) throw new Error(data?.message ?? 'The distribution request failed.')
  return data as T
}
export function DistributionPanel({ flowId }: { flowId: string }) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [sender, setSender] = useState('Loading delivery availability…')
  const [selected, setSelected] = useState<string[]>([])
  const [name, setName] = useState(''), [email, setEmail] = useState('')
  const [error, setError] = useState<string>(), [notice, setNotice] = useState<string>()
  const [busy, setBusy] = useState(false)
  const load = async () => {
    const [nextContacts, distribution] = await Promise.all([request<Contact[]>('/api/app/distribution/contacts'), request<{ sender: { message: string }; participants: Delivery[] }>(`/api/app/flows/${encodeURIComponent(flowId)}/distribution`)])
    setContacts(nextContacts); setDeliveries(distribution.participants); setSender(distribution.sender.message)
  }
  useEffect(() => { void load().catch(e => setError((e as Error).message)) }, [flowId])
  const act = async (operation: () => Promise<unknown>, success: string) => {
    setBusy(true); setError(undefined); setNotice(undefined)
    try { await operation(); await load(); setNotice(success) } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  return <section className="panel flow-share-panel" aria-labelledby="distribution-title">
    <h2 id="distribution-title">Invitations</h2><p className="status-note">{sender}</p>
    {error ? <p role="alert" className="status-note" data-tone="error">{error}</p> : null}
    {notice ? <p role="status" className="status-note">{notice}</p> : null}
    <form onSubmit={event => { event.preventDefault(); void act(async () => { await request('/api/app/distribution/contacts', { name, email }); setName(''); setEmail('') }, 'Recipient saved. No mail was sent.') }}>
      <label className="inspector-field">Recipient name<input className="text-input" required maxLength={200} value={name} onChange={event => setName(event.target.value)} /></label>
      <label className="inspector-field">Recipient email<input className="text-input" required type="email" maxLength={320} value={email} onChange={event => setEmail(event.target.value)} /></label>
      <button className="secondary-button focus-ring" type="submit" disabled={busy}>Save recipient</button>
    </form>
    {contacts.length ? <fieldset disabled={busy}><legend>Eligible recipients</legend>{contacts.map(contact => <div key={contact.id}>
      <label><input type="checkbox" disabled={!!contact.optedOutAt} checked={selected.includes(contact.id)} onChange={event => setSelected(current => event.target.checked ? [...current, contact.id] : current.filter(id => id !== contact.id))} /> {contact.name} — {contact.email}{contact.optedOutAt ? ' · opted out' : ''}</label>
      {contact.optedOutAt ? <button className="quiet-button focus-ring" type="button" onClick={() => { const source = window.prompt('Record where this recipient explicitly renewed consent:'); if (source?.trim()) void act(() => request(`/api/app/distribution/contacts/${contact.id}/consent`, { renewed: true, source }), 'Renewed consent recorded. Cancelled messages remain cancelled.') }}>Record renewed consent</button> : <button className="quiet-button focus-ring" type="button" onClick={() => void act(() => request(`/api/app/distribution/contacts/${contact.id}/consent`, { renewed: false, source: 'Operator recorded recipient opt-out' }), 'Flow mail stopped for this contact.')}>Record opt-out</button>}
      <button className="quiet-button focus-ring" type="button" onClick={() => { if (window.confirm('Erase this contact and all identified responses, and revoke invitation links?')) void act(() => request(`/api/app/distribution/contacts/${contact.id}/erase`, { confirm: true }), 'Contact and identified responses erased; invitation links revoked.') }}>Erase contact and responses</button>
    </div>)}</fieldset> : <p>No recipients saved.</p>}
    <button className="secondary-button focus-ring" type="button" disabled={busy || !selected.length} onClick={() => void act(async () => { await request(`/api/app/flows/${flowId}/distribution`, { contactIds: selected, commandKey: crypto.randomUUID() }); setSelected([]) }, 'Invitation launch recorded for the current revision. Review each durable delivery outcome below.')}>Queue selected invitations</button>
    {deliveries.length ? <ul>{deliveries.map(delivery => <li key={delivery.deliveryId}>
      <strong>{delivery.name ?? 'Erased recipient'}</strong> · {delivery.kind}: {delivery.status} · response: {delivery.responseStatus} · {delivery.attempts} attempts
      {delivery.reason ? <p>{delivery.reason}</p> : null}
      {['failed','unknown'].includes(delivery.status) ? <button className="quiet-button focus-ring" disabled={busy} type="button" onClick={() => { const accepted = delivery.status === 'unknown' && window.confirm('The provider outcome is unknown. Resending can deliver a duplicate. Explicitly accept that risk?'); if (delivery.status !== 'unknown' || accepted) void act(() => request(`/api/app/distribution/deliveries/${delivery.deliveryId}/retry`, { duplicateRiskAccepted: accepted }), 'Retry requested with the original delivery key. Review its recorded outcome below.') }}>Queue retry{delivery.status === 'unknown' ? ' (duplicate risk)' : ''}</button> : null}
    </li>)}</ul> : <p>No invitations have been launched for this flow.</p>}
  </section>
}
