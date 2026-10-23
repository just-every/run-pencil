import { Webhook } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { api, type DashboardFlow } from '../../../app/api'
import { eventTypes } from '../events'
import { WebhookDeliveries } from './WebhookDeliveries'
import { webhooksApi, type EndpointSummary } from './webhooksApi'
import './webhooks.css'

/** INTEG-010: the owner's response-event endpoints. A secret is shown once at creation or rotation and never read back. */
export function ResponseWebhooks() {
  const [endpoints, setEndpoints] = useState<EndpointSummary[]>()
  const [forms, setForms] = useState<DashboardFlow[]>([])
  const [url, setUrl] = useState(''), [flowId, setFlowId] = useState('')
  const [secret, setSecret] = useState<{ endpointId: string; value: string }>()
  const [busy, setBusy] = useState<string>(), [error, setError] = useState<string>(), [notice, setNotice] = useState<string>()
  const [version, setVersion] = useState(0)
  const run = async (name: string, work: () => Promise<void>) => {
    setBusy(name); setError(undefined); setNotice(undefined)
    try { await work() } catch (reason) { setError(reason instanceof Error ? reason.message : 'The webhook request failed.') } finally { setBusy(undefined) }
  }
  const refresh = async () => { setEndpoints((await webhooksApi.list()).endpoints); setVersion(current => current + 1) }
  useEffect(() => { void run('load', refresh); void api.dashboard().then(setForms).catch(() => undefined) }, [])
  const add = (event: FormEvent) => event.preventDefault() ?? void run('add', async () => {
    const created = await webhooksApi.create({ url: url.trim(), ...(flowId ? { flowId } : {}) })
    setSecret({ endpointId: created.endpoint.id, value: created.secret }); setUrl(''); setFlowId('')
    await refresh(); setNotice('Endpoint added. Copy the signing secret now: it is not shown again.')
  })
  return <section className="panel settings-card response-webhooks" aria-labelledby="response-webhooks-title">
    <header className="card-title"><Webhook aria-hidden="true" size={22} strokeWidth={1.75} /><h2 className="display" id="response-webhooks-title">Response webhooks</h2></header>
    <p>Pencil sends a signed message to your HTTPS address when a response is created, deleted or partly saved, or its payment changes. Messages carry identifiers only: no answers, names or contact details.</p>
    <details className="webhook-contract"><summary className="focus-ring">What the receiver gets</summary>
      <p className="muted">A <code>POST</code> of JSON with <code>{eventTypes.join(', ')}</code> events. Headers: <code>Pencil-Event-Id</code>, <code>Pencil-Event-Type</code>, <code>Pencil-Timestamp</code> (Unix seconds) and <code>Pencil-Signature: sha256=&lt;hex&gt;</code>, an HMAC-SHA256 of the exact body, keyed by the signing secret. Reject a <code>sentAt</code> older than five minutes. A failed delivery is retried with growing waits for 24 hours with the same event ID, so keep a list of event IDs you already handled. Answer 2xx to confirm.</p>
    </details>
    <p className="muted">Only the installation owner can add, pause, rotate or remove an endpoint. An endpoint that fails for 24 hours is disabled and raises an alert.</p>
    {error ? <p className="status-note" data-tone="error" role="alert">{error}</p> : null}
    {notice ? <p className="status-note" role="status">{notice}</p> : null}
    <form onSubmit={add}>
      <fieldset disabled={!!busy || !endpoints} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <label className="inspector-field">Endpoint address<input className="text-input" type="url" required maxLength={2000} placeholder="https://receiver.example.com/pencil" autoComplete="off" value={url} onChange={event => setUrl(event.target.value)} /></label>
        <label className="inspector-field">Forms<select className="text-input" value={flowId} onChange={event => setFlowId(event.target.value)}><option value="">Every form in this workspace</option>{forms.map(form => <option key={form.id} value={form.id}>{form.title}</option>)}</select></label>
        <div className="builder-actions"><button className="secondary-button focus-ring" type="submit" disabled={!url.trim()}>{busy === 'add' ? 'Adding…' : 'Add endpoint'}</button></div>
      </fieldset>
    </form>
    {!endpoints ? <p className="muted" role="status">{busy === 'load' ? 'Loading endpoints…' : 'Endpoints could not load.'}</p> : endpoints.length ? <ul className="webhook-endpoints">{endpoints.map(endpoint => <li key={endpoint.id} data-state={endpoint.state}>
      <p><strong>{endpoint.url}</strong></p>
      <p className="muted">{endpoint.flowTitle ? `Form: ${endpoint.flowTitle}` : 'Every form'} · {endpoint.state === 'active' ? 'Active' : endpoint.state === 'paused' ? 'Paused' : 'Disabled'} · {endpoint.pending} waiting · {endpoint.failed} not delivered{endpoint.secretSet ? '' : ' · no signing secret'}</p>
      {endpoint.state === 'disabled' ? <p className="status-note" data-tone="error" role="alert">Disabled: {endpoint.disabledReason}</p> : endpoint.failureStreak > 0 ? <p className="status-note" role="status">Failing: {endpoint.failureStreak} attempts in a row. Pencil keeps retrying for 24 hours.</p> : null}
      {secret?.endpointId === endpoint.id ? <p className="status-note" role="status" data-testid="webhook-secret">Signing secret (shown once): <code>{secret.value}</code></p> : null}
      <div className="builder-actions">
        <button className="quiet-button focus-ring" type="button" disabled={!!busy || endpoint.state === 'paused'} onClick={() => void run('test', async () => { const { delivery } = await webhooksApi.test(endpoint.id); await refresh(); setNotice(`Test event ${delivery.status === 'confirmed' ? 'delivered' : 'was not delivered'}${delivery.reason ? `: ${delivery.reason}` : '.'}`) })}>Send test event</button>
        {endpoint.state === 'active' ? <button className="quiet-button focus-ring" type="button" disabled={!!busy} onClick={() => void run('pause', async () => { await webhooksApi.setActive(endpoint.id, false); await refresh() })}>Pause</button>
          : <button className="quiet-button focus-ring" type="button" disabled={!!busy} onClick={() => void run('resume', async () => { await webhooksApi.setActive(endpoint.id, true); await refresh() })}>Resume</button>}
        <button className="quiet-button focus-ring" type="button" disabled={!!busy} onClick={() => { if (window.confirm('Rotate the signing secret? The old secret stops working at once.')) void run('rotate', async () => { const rotated = await webhooksApi.rotate(endpoint.id); setSecret({ endpointId: endpoint.id, value: rotated.secret }); await refresh(); setNotice('Secret rotated. Copy the new signing secret now: it is not shown again.') }) }}>Rotate secret</button>
        <button className="quiet-button focus-ring" type="button" disabled={!!busy} onClick={() => { if (window.confirm('Remove this endpoint? Queued events for it are discarded.')) void run('remove', async () => { await webhooksApi.remove(endpoint.id); await refresh() }) }}>Remove</button>
      </div>
      <WebhookDeliveries endpointId={endpoint.id} canReplay={endpoint.state === 'active'} version={version} onChanged={() => void refresh()} />
    </li>)}</ul> : <p className="muted">No endpoints yet.</p>}
  </section>
}
