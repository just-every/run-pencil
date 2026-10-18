import { QrKioskControls } from './QrKioskControls'
import { useEffect, useState, type FormEvent } from 'react'
import { collectorChannels, type CollectorChannel } from '../model'
import { collectorRequest, collectorsPath, type Collector } from './client'
import './collectors.css'

const channelLabels: Record<CollectorChannel, string> = { web: 'Web link', embed: 'Named website embed', email: 'Email campaign', sms: 'SMS link', qr: 'QR destination', social: 'Social post', partner: 'Partner link' }
export function CollectorsPanel({ flowId, timeZone }: { flowId: string; timeZone: string }) {
  const [collectors, setCollectors] = useState<Collector[]>([]), [error, setError] = useState<string>(), [notice, setNotice] = useState<string>()
  const [name, setName] = useState(''), [channel, setChannel] = useState<CollectorChannel>('web'), [limit, setLimit] = useState(''), [closeAt, setCloseAt] = useState('')
  const [editing, setEditing] = useState<string>(), [busy, setBusy] = useState(false)
  const path = collectorsPath(flowId)
  const load = async () => setCollectors(await collectorRequest<Collector[]>(path))
  useEffect(() => { void load().catch(reason => setError((reason as Error).message)) }, [flowId])
  const act = async (operation: () => Promise<unknown>, message: string) => {
    setBusy(true); setError(undefined); setNotice(undefined)
    try { await operation(); await load(); setNotice(message) } catch (reason) { setError((reason as Error).message) } finally { setBusy(false) }
  }
  const reset = () => { setEditing(undefined); setName(''); setChannel('web'); setLimit(''); setCloseAt('') }
  const save = (event: FormEvent) => {
    event.preventDefault()
    void act(async () => {
      await collectorRequest(editing ? `${path}/${encodeURIComponent(editing)}` : path, { name, channel, responseLimit: limit ? Number(limit) : null, closeAt: closeAt || null }, editing ? 'PUT' : 'POST'); reset()
    }, editing ? 'Collector settings saved.' : 'Collector created. Its link is ready to share.')
  }
  const edit = (collector: Collector) => {
    setEditing(collector.id); setName(collector.name); setChannel(collector.channel as CollectorChannel); setLimit(collector.responseLimit?.toString() ?? '')
    if (collector.deadlineAt) {
      const parts = new Intl.DateTimeFormat('sv-SE', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(collector.deadlineAt))
      setCloseAt(parts.replace(' ', 'T'))
    } else setCloseAt('')
  }
  const named = collectors.filter(item => !item.systemSource)
  return <section className="panel flow-share-panel collectors-panel" aria-labelledby="collectors-title">
    <h2 id="collectors-title">Named collectors</h2>
    <p>Give each campaign, website or partner its own link and collection limits. Links use the current published form; every response keeps the collector where it began. Form publication limits also apply.</p>
    <form onSubmit={save} className="collector-form">
      <h3>{editing ? 'Edit collector' : 'New collector'}</h3>
      <label className="inspector-field">Collector name<input aria-label="Collector name" className="text-input" required maxLength={120} value={name} onChange={event => setName(event.target.value)} /></label>
      <label className="inspector-field">Collector channel<select aria-label="Collector channel" className="text-input" value={channel} onChange={event => setChannel(event.target.value as CollectorChannel)}>{collectorChannels.map(value => <option value={value} key={value}>{channelLabels[value]}</option>)}</select></label>
      <label className="inspector-field">Response limit<input aria-label="Response limit" className="text-input" type="number" min={1} step={1} value={limit} onChange={event => setLimit(event.target.value)} /><span className="muted">Leave empty for no collector limit. All retained submissions, including quarantine, use a place.</span></label>
      <label className="inspector-field">Collector close date<input aria-label="Collector close date" className="text-input" type="datetime-local" value={closeAt} onChange={event => setCloseAt(event.target.value)} /><span className="muted">{timeZone}. Leave empty for no collector deadline.</span></label>
      <div className="builder-actions"><button className="secondary-button focus-ring" disabled={busy} type="submit">{editing ? 'Save collector' : 'Create collector'}</button>{editing ? <button className="quiet-button focus-ring" type="button" onClick={reset}>Cancel editing</button> : null}</div>
    </form>
    {error ? <p role="alert" className="status-note" data-tone="error">{error}</p> : null}{notice ? <p role="status" className="status-note">{notice}</p> : null}
    <div className="collector-list">{named.map(collector => <article className="quiet-panel collector-card" key={collector.id}>
      <h3>{collector.name}</h3><p>{channelLabels[collector.channel as CollectorChannel]} · <strong>{collector.state}</strong></p>
      <p>{collector.released} released · {collector.retained} retained{collector.remaining !== null ? ` · ${collector.remaining} places remaining` : ' · no collector response limit'}</p>
      {collector.deadlineAt ? <p>Closes {new Intl.DateTimeFormat(undefined, { timeZone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(collector.deadlineAt))} ({timeZone})</p> : null}
      <label className="inspector-field">{collector.name} link<input readOnly className="text-input" value={new URL(collector.publicPath!, location.origin).href} onFocus={event => event.target.select()} /></label>
      <QrKioskControls flowId={flowId} collectorId={collector.id} publicPath={collector.publicPath!} label={collector.name} />
      {collector.channel === 'embed' ? <label className="inspector-field">{collector.name} embed<textarea aria-label={`${collector.name} embed`} readOnly className="text-input" rows={3} value={`<iframe src="${new URL(collector.embedPath!, location.origin).href}" title="Feedback form" width="100%" height="700" sandbox="allow-scripts allow-forms" referrerpolicy="origin" style="border:0"></iframe>`} /></label> : null}
      <div className="builder-actions"><button type="button" className="quiet-button focus-ring" disabled={busy} onClick={() => edit(collector)}>Edit {collector.name}</button><button type="button" className="quiet-button focus-ring" disabled={busy} onClick={() => void act(() => collectorRequest(`${path}/${encodeURIComponent(collector.id)}/${collector.closedAt ? 'reopen' : 'close'}`, {}), collector.closedAt ? 'Collector reopened. Its deadline and limit still apply.' : 'Collector closed.')}>{collector.closedAt ? 'Reopen' : 'Close'} {collector.name}</button></div>
    </article>)}</div>
    {!named.length ? <p>No named collectors yet.</p> : null}
    <details><summary>Default source collectors</summary><p>Older responses retain their recorded source. Their campaign or website is unavailable.</p><ul>{collectors.filter(item => item.systemSource).map(item => <li key={item.id}>{item.name}: {item.released} released{item.publicPath ? <QrKioskControls flowId={flowId} collectorId={item.id} publicPath={item.publicPath} label={item.name} /> : null}</li>)}</ul></details>
  </section>
}
