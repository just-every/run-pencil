import { ListChecks } from 'lucide-react'
import { useEffect, useState } from 'react'
import { webhooksApi, type LedgerDelivery } from './webhooksApi'
import './webhooks.css'

const when = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'medium' }).format(new Date(value))
const label = (state: string) => state.charAt(0).toUpperCase() + state.slice(1)

/** INTEG-015: one operator view over the deliveries that exist (response events and external tasks): state, idempotency key and each attempt with its reason. */
export function IntegrationLedger() {
  const [refresh,setRefresh]=useState(0)
  const [state, setState] = useState<LedgerDelivery['state'] | ''>('')
  const [deliveries, setDeliveries] = useState<LedgerDelivery[]>(), [error, setError] = useState<string>()
  useEffect(() => {
    let current = true
    setDeliveries(undefined); setError(undefined)
    void webhooksApi.ledger(state || undefined).then(result => { if (current) setDeliveries(result.deliveries) }).catch(reason => { if (current) setError(reason instanceof Error ? reason.message : 'The delivery ledger could not load.') })
    return () => { current = false }
  }, [state,refresh])
  return <section className="panel settings-card response-webhooks" aria-labelledby="integration-ledger-title">
    <header className="card-title"><ListChecks aria-hidden="true" size={22} strokeWidth={1.75} /><h2 className="display" id="integration-ledger-title">Delivery ledger</h2></header>
    <p>Every outbound delivery Pencil makes for you, in one place: response events to your webhooks, Google Sheets rows, Slack and Teams posts, and confirmed-action tasks. It shows identifiers and states only, never answers or secrets. Replay a webhook event from its endpoint above; retry a task from its action.</p>
    <label className="inspector-field">Show<select className="text-input" value={state} onChange={event => setState(event.target.value as LedgerDelivery['state'] | '')}><option value="">Every delivery</option><option value="failed">Failed</option><option value="pending">Pending</option><option value="unknown">Unknown</option><option value="confirmed">Confirmed</option></select></label>
    {error ? <p className="status-note" data-tone="error" role="alert">{error}</p> : null}
    {!deliveries ? <p className="muted" aria-busy={!error}>{error ? '' : 'Loading deliveries…'}</p> : deliveries.length ? <ul className="webhook-deliveries" aria-label="Deliveries">{deliveries.map(delivery => <li key={`${delivery.kind}-${delivery.id}`} data-status={delivery.state}>
      <p><strong>{label(delivery.state)}</strong> · {delivery.kind === 'webhook' ? 'Webhook' : delivery.kind==='sheet'?'Google Sheets':delivery.kind==='slack'?'Slack':delivery.kind==='teams'?'Teams':'Task'} · {delivery.subject} · key <code>{delivery.idempotencyKey}</code></p>
      <p className="muted">{delivery.responseId ? <>Response <code>{delivery.responseId}</code> · </> : null}{delivery.actionId ? <>Action <code>{delivery.actionId}</code> · </> : null}{delivery.attempts.length === 1 ? '1 attempt' : `${delivery.attempts.length} attempts`} · {when(delivery.updatedAt)}</p>
      {delivery.kind==='sheet'&&['failed','unknown'].includes(delivery.state)?<button className="quiet-button focus-ring" type="button" onClick={()=>{void webhooksApi.replaySheet(delivery.id).then(()=>{setRefresh(value=>value+1);window.dispatchEvent(new Event('pencil:webhooks-changed'))}).catch(reason=>setError(reason instanceof Error?reason.message:'The sheet replay failed.'))}}>Replay sheet delivery</button>:null}
      {delivery.attempts.length ? <ol className="muted webhook-attempts">{delivery.attempts.map((attempt, index) => <li key={`${attempt.ordinal}-${index}`}>#{attempt.ordinal} {attempt.outcome ?? 'started'}{attempt.httpStatus ? ` · HTTP ${attempt.httpStatus}` : ''}{attempt.reason ? ` · ${attempt.reason}` : ''} · {when(attempt.at)}</li>)}</ol> : null}
    </li>)}</ul> : <p className="muted">No deliveries {state ? `are ${state}` : 'yet'}.</p>}
  </section>
}
