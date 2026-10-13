import { stateLabels } from '../states'
import type { ActionDetail } from './actionsApi'

const fieldLabels: Record<string, string> = { title: 'title', rationale: 'rationale', ownerOperatorId: 'owner', reviewDate: 'review date', metric: 'target metric', observedValue: 'observed value' }

export function ActionHistory({ history, timeZone }: { history: ActionDetail['history']; timeZone: string }) {
  return <section className="panel" style={{ padding: '1.25rem', minWidth: 0, overflowWrap: 'anywhere' }} aria-labelledby="history-title">
    <h2 id="history-title">History</h2>
    <ol>{history.map(event => <li key={event.id} style={{ marginBottom: '.5rem' }}>
      <span className="muted">{new Date(event.createdAt).toLocaleString('en', { timeZone })} · {event.operator ?? 'Removed operator'}</span><br />
      {event.kind === 'created' ? 'Created as planned' : event.kind === 'transition' ? `${stateLabels[event.fromState!]} → ${stateLabels[event.toState!]}` : event.kind === 'measurement' ? 'Recorded an observed value' : `Edited ${Object.keys(event.changes ?? {}).map(field => fieldLabels[field] ?? field).join(', ')}`}
      {event.note ? <><br />Note: {event.note}</> : null}
    </li>)}</ol>
  </section>
}
