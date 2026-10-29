import { useEffect, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { actionStates, stateLabels } from '../states'
import { actionsApi, type ActionSummary } from './actionsApi'

export function ReviewDue() {
  return <span className="badge" data-status="review-due">Review due</span>
}

export function ActionsPage() {
  const navigate = useNavigate()
  const [actions, setActions] = useState<ActionSummary[]>(), [error, setError] = useState<string>()
  // With no action yet the list opens the form to start one (U5).
  useEffect(() => { actionsApi.list().then(result => { if (result.actions.length) setActions(result.actions); else void navigate({ to: '/app/actions/new', replace: true }) }).catch(reason => setError(reason instanceof Error ? reason.message : 'Actions could not load.')) }, [])
  return <section aria-labelledby="actions-title">
    <header className="dashboard-heading">
      <div><p className="eyebrow">Owned follow-through</p><h1 className="display" id="actions-title">Actions</h1></div>
      <div className="builder-actions"><Link className="primary-button focus-ring" to="/app/actions/new"><Plus aria-hidden="true" size={16} /> New action</Link></div>
    </header>
    <p className="muted">Recommendations are written by people: turn what results show into an action with an owner, a metric and a review date, then record what changed. Pencil never decides whether an action worked.</p>
    {error ? <p className="status-note" data-tone="error" role="alert">{error}</p> : null}
    {!actions && !error ? <p className="status-note" role="status">Loading actions…</p> : null}
    {actions?.length ? actionStates.map(state => {
      const items = actions.filter(action => action.state === state)
      if (!items.length) return null
      return <section key={state} aria-labelledby={`actions-${state}`} style={{ marginTop: '1.25rem' }}>
        <h2 id={`actions-${state}`}>{stateLabels[state]} <span className="muted">({items.length})</span></h2>
        <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: '.75rem' }}>{items.map(action => <li key={action.id} className="panel" style={{ padding: '1rem', overflowWrap: 'anywhere' }}>
          <Link className="focus-ring" to="/app/actions/$actionId" params={{ actionId: action.id }}><strong>{action.title}</strong></Link>
          <p className="muted" style={{ margin: '.4rem 0 0' }}>Owner: {action.owner?.displayName ?? 'No owner — choose one'} · Metric: {action.metric.name} ({action.metric.unit}) · Review {action.reviewDate}{action.verdict ? ` · Verdict: ${stateLabels[action.verdict]}` : ''}</p>
          {action.reviewDue ? <p style={{ margin: '.5rem 0 0' }}><ReviewDue /></p> : null}
        </li>)}</ul>
      </section>
    }) : null}
  </section>
}
