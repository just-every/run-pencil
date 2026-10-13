import { useEffect, useState } from 'react'
import { api, reportingApi, type DashboardFlow } from '../../../app/api'
import { zonedInstant } from '../../../shared/timeZone'
import { actionsApi, formatNumber, type ActionView } from './actionsApi'
import { localValue } from './ActionForm'

const directionText = { desired: 'in the desired direction', undesired: 'against the desired direction', unchanged: 'no change' } as const

/** ACT-005: the operator records a comparable value; Pencil shows the difference and never decides the outcome. */
export function ActionMeasurements({ action, timeZone, onChanged }: { action: ActionView; timeZone: string; onChanged: () => void }) {
  const [flows, setFlows] = useState<DashboardFlow[]>([]), [revisions, setRevisions] = useState<Array<{ id: string; number: number }>>([])
  const [flowId, setFlowId] = useState(action.evidence.flowId), [revisionId, setRevisionId] = useState('')
  const [value, setValue] = useState(''), [unit, setUnit] = useState(action.metric.unit), [observed, setObserved] = useState(localValue(new Date().toISOString(), timeZone))
  const [busy, setBusy] = useState(false), [error, setError] = useState<string>()
  useEffect(() => { api.dashboard().then(all => setFlows(all.filter(flow => flow.status !== 'draft'))).catch(() => undefined) }, [])
  useEffect(() => { setRevisionId(''); reportingApi.ledger(flowId, {}).then(ledger => setRevisions(ledger.revisions)).catch(() => setRevisions([])) }, [flowId])
  const closed = action.state === 'closed'
  const record = async () => {
    setError(undefined)
    const observedValue = Number(value)
    if (value.trim() === '' || !Number.isFinite(observedValue)) return setError('Enter the observed value as a number.')
    let observedAt: string
    try { observedAt = zonedInstant(observed, timeZone) } catch (reason) { return setError(reason instanceof Error ? reason.message : 'Choose when the value was observed.') }
    setBusy(true)
    try { await actionsApi.measure(action.id, { flowId, ...(revisionId ? { revisionId } : {}), observedValue, unit, observedAt }); setValue(''); onChanged() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The measurement could not be recorded.') }
    finally { setBusy(false) }
  }
  return <section className="panel" style={{ padding: '1.25rem', minWidth: 0 }} aria-labelledby="measurement-title">
    <h2 id="measurement-title">Follow-up measurement</h2>
    <p className="muted">Baseline: {formatNumber(action.metric.baselineValue)} {action.metric.unit} from {action.metric.baselineSource}, observed {new Date(action.metric.baselineObservedAt).toLocaleString('en', { timeZone })}. {action.metric.direction === 'increase' ? 'Higher is better.' : 'Lower is better.'}</p>
    {action.measurements.length ? <ul>{action.measurements.map(item => <li key={item.id}>
      <strong>{formatNumber(item.observedValue)} {item.unit}</strong> from {item.flowTitle}{item.revisionNumber ? `, revision ${item.revisionNumber}` : ''}, observed {new Date(item.observedAt).toLocaleString('en', { timeZone })}.
      {' '}Difference from baseline: <strong>{item.difference > 0 ? '+' : ''}{formatNumber(item.difference)} {item.unit}</strong>, {directionText[item.direction]}.{item.operator ? ` Recorded by ${item.operator}.` : ''}
    </li>)}</ul> : <p>No observed value recorded yet.</p>}
    {!closed ? <form onSubmit={event => { event.preventDefault(); void record() }}><fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}><legend>Record an observed value</legend>
      <label className="inspector-field">Later flow<select className="text-input" value={flowId} onChange={event => setFlowId(event.target.value)}>{flows.map(flow => <option key={flow.id} value={flow.id}>{flow.title}</option>)}</select></label>
      <label className="inspector-field">Revision<select className="text-input" value={revisionId} onChange={event => setRevisionId(event.target.value)}><option value="">The flow's results when observed</option>{revisions.map(revision => <option key={revision.id} value={revision.id}>Revision {revision.number}</option>)}</select></label>
      <label className="inspector-field">Observed value<input className="text-input" inputMode="decimal" required value={value} onChange={event => setValue(event.target.value)} /></label>
      <label className="inspector-field">Unit<input className="text-input" required value={unit} onChange={event => setUnit(event.target.value)} /></label>
      <label className="inspector-field">Observed ({timeZone})<input className="text-input" type="datetime-local" required value={observed} onChange={event => setObserved(event.target.value)} /></label>
      <button className="secondary-button focus-ring" type="submit">{busy ? 'Recording…' : 'Record observed value'}</button>
    </fieldset></form> : null}
    {error ? <p className="status-note" data-tone="error" role="alert">{error}</p> : null}
  </section>
}
