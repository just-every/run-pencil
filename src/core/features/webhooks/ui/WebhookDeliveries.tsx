import { useCallback, useEffect, useState } from 'react'
import { webhooksApi, type DeliverySummary } from './webhooksApi'

const label = (status: string) => status.charAt(0).toUpperCase() + status.slice(1)
const when = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'medium' }).format(new Date(value))

/** The delivery ledger of one endpoint (INTEG-010, INTEG-015): state, event ID, every attempt with its reason, replay, and the responses not yet delivered. Identifiers and states only. */
export function WebhookDeliveries({ endpointId, canReplay, version, onChanged }: { endpointId: string; canReplay: boolean; version: number; onChanged: () => void }) {
  const [deliveries, setDeliveries] = useState<DeliverySummary[]>()
  const [undelivered, setUndelivered] = useState<Array<{ responseId: string; status: string }>>([])
  const [busy, setBusy] = useState<string>(), [error, setError] = useState<string>()
  const load = useCallback(async () => {
    try {
      const [list, missing] = await Promise.all([webhooksApi.deliveries(endpointId), webhooksApi.undelivered(endpointId)])
      setDeliveries(list.deliveries); setUndelivered(missing.responses)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'The delivery ledger could not load.') }
  }, [endpointId])
  useEffect(() => { void load() }, [load, version])
  const replay = async (id: string) => {
    setBusy(id); setError(undefined)
    try { await webhooksApi.replay(id); await load(); onChanged() } catch (reason) { setError(reason instanceof Error ? reason.message : 'The replay failed.') } finally { setBusy(undefined) }
  }
  return <div className="webhook-ledger" role="group" aria-label="Deliveries for this endpoint">
    <h3>Deliveries</h3>
    {error ? <p className="status-note" data-tone="error" role="alert">{error}</p> : null}
    {undelivered.length ? <p className="muted" data-testid="webhook-undelivered">Not delivered yet ({undelivered.length}): {undelivered.map(item => item.responseId).join(', ')}</p> : null}
    {!deliveries ? <p className="muted" role="status">Loading deliveries…</p> : deliveries.length ? <ul className="webhook-deliveries">{deliveries.map(delivery => <li key={delivery.id} data-status={delivery.status}>
      <p><strong>{label(delivery.status)}</strong> · {delivery.eventType} · <code>{delivery.eventId}</code></p>
      <p className="muted">{delivery.responseId ? <>Response <code>{delivery.responseId}</code> · </> : null}{delivery.attempts === 1 ? '1 attempt' : `${delivery.attempts} attempts`} · {when(delivery.updatedAt)}{delivery.status === 'pending' && delivery.attempts > 0 ? ` · next try ${when(delivery.availableAt)}` : ''}</p>
      {delivery.reason ? <p className="muted">{delivery.reason}</p> : null}
      {delivery.attemptLog.length ? <ol className="muted webhook-attempts">{delivery.attemptLog.map((attempt, index) => <li key={`${attempt.ordinal}-${attempt.event}-${index}`}>#{attempt.ordinal} {attempt.event}{attempt.httpStatus ? ` · HTTP ${attempt.httpStatus}` : ''}{attempt.outcomeClass ? ` · ${attempt.outcomeClass}` : ''}{attempt.reason ? ` · ${attempt.reason}` : ''} · {when(attempt.createdAt)}</li>)}</ol> : null}
      {canReplay && ['confirmed', 'failed'].includes(delivery.status) ? <button className="quiet-button focus-ring" type="button" disabled={!!busy} onClick={() => void replay(delivery.id)}>{busy === delivery.id ? 'Replaying…' : 'Replay this event'}</button> : null}
    </li>)}</ul> : <p className="muted">No events yet. They appear here as responses arrive.</p>}
  </div>
}
