import { useState, type ReactNode } from 'react'
import type { Operator } from '../../../app/api'
import { zonedInstant } from '../../../shared/timeZone'
import type { ActionFieldsInput } from './actionsApi'

/** The wall-clock value of an instant in the workspace zone, for a datetime-local field. */
export function localValue(instant: string, timeZone: string) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(instant)).map(part => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}

export function ActionForm({ initial, operators, timeZone, busy, submitLabel, onSubmit, children }: { initial: ActionFieldsInput; operators: Operator[]; timeZone: string; busy: boolean; submitLabel: string; onSubmit: (fields: ActionFieldsInput) => void; children?: ReactNode }) {
  const [title, setTitle] = useState(initial.title), [rationale, setRationale] = useState(initial.rationale)
  const [owner, setOwner] = useState(initial.ownerOperatorId), [reviewDate, setReviewDate] = useState(initial.reviewDate)
  const [metric, setMetric] = useState({ ...initial.metric, baselineValue: Number.isFinite(initial.metric.baselineValue) ? String(initial.metric.baselineValue) : '', observed: initial.metric.baselineObservedAt ? localValue(initial.metric.baselineObservedAt, timeZone) : '' })
  const [error, setError] = useState<string>()
  const submit = () => {
    setError(undefined)
    const baselineValue = Number(metric.baselineValue)
    if (metric.baselineValue.trim() === '' || !Number.isFinite(baselineValue)) return setError('Enter the baseline as a number.')
    let baselineObservedAt: string
    try { baselineObservedAt = zonedInstant(metric.observed, timeZone) } catch (reason) { return setError(reason instanceof Error ? reason.message : 'Choose when the baseline was observed.') }
    onSubmit({ title, rationale, ownerOperatorId: owner, reviewDate, metric: { name: metric.name, unit: metric.unit, direction: metric.direction, baselineValue, baselineSource: metric.baselineSource, baselineObservedAt } })
  }
  return <form className="panel" style={{ padding: '1.25rem', minWidth: 0 }} onSubmit={event => { event.preventDefault(); submit() }}>
    {children}
    <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      <label className="inspector-field">Title<input className="text-input" required maxLength={200} value={title} onChange={event => setTitle(event.target.value)} /></label>
      <label className="inspector-field">Rationale<textarea className="text-input text-area" required maxLength={4000} value={rationale} placeholder="In your own words, without respondent names" onChange={event => setRationale(event.target.value)} /></label>
      <label className="inspector-field">Owner<select className="text-input" required value={owner} onChange={event => setOwner(event.target.value)}><option value="">Choose an operator</option>{operators.map(operator => <option key={operator.id} value={operator.id}>{operator.displayName}</option>)}</select></label>
      <label className="inspector-field">Review date<input className="text-input" type="date" required value={reviewDate} onChange={event => setReviewDate(event.target.value)} /></label>
      <fieldset style={{ border: 0, padding: 0, margin: '1rem 0 0', minWidth: 0 }}><legend>Target metric</legend>
        <label className="inspector-field">Metric<input className="text-input" required maxLength={120} placeholder="Visitors saying the wait was short" value={metric.name} onChange={event => setMetric({ ...metric, name: event.target.value })} /></label>
        <label className="inspector-field">Unit<input className="text-input" required maxLength={40} placeholder="percent" value={metric.unit} onChange={event => setMetric({ ...metric, unit: event.target.value })} /></label>
        <label className="inspector-field">Desired direction<select className="text-input" value={metric.direction} onChange={event => setMetric({ ...metric, direction: event.target.value as 'increase' | 'decrease' })}><option value="increase">Higher is better</option><option value="decrease">Lower is better</option></select></label>
        <label className="inspector-field">Baseline value<input className="text-input" required inputMode="decimal" value={metric.baselineValue} onChange={event => setMetric({ ...metric, baselineValue: event.target.value })} /></label>
        <label className="inspector-field">Baseline source<input className="text-input" required maxLength={300} placeholder="Revision 1 results" value={metric.baselineSource} onChange={event => setMetric({ ...metric, baselineSource: event.target.value })} /></label>
        <label className="inspector-field">Baseline observed ({timeZone})<input className="text-input" type="datetime-local" required value={metric.observed} onChange={event => setMetric({ ...metric, observed: event.target.value })} /></label>
      </fieldset>
      {error ? <p className="status-note" data-tone="error" role="alert">{error}</p> : null}
      <div className="builder-actions" style={{ marginTop: '1rem' }}><button className="primary-button focus-ring" type="submit">{busy ? 'Saving…' : submitLabel}</button></div>
    </fieldset>
  </form>
}
