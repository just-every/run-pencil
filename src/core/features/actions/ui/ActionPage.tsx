import { ActionReminders } from './ActionReminders'
import './action-page.css'
import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { api, type Operator } from '../../../app/api'
import { editableStates, stateLabels, type ActionState } from '../states'
import { ActionForm } from './ActionForm'
import { ActionHistory } from './ActionHistory'
import { ActionMeasurements } from './ActionMeasurements'
import { ActionTask } from './ActionTask'
import { EvidenceFigures } from './EvidenceFigures'
import { ReviewDue } from './ActionsPage'
import { actionsApi, directionLabel, formatNumber, type ActionView } from './actionsApi'

const moveLabels: Partial<Record<ActionState, string>> = { in_progress: 'Start work', ready_for_review: 'Ready for review', closed: 'Close action' }

export function ActionPage({ actionId }: { actionId: string }) {
  const [action, setAction] = useState<ActionView>(), [operators, setOperators] = useState<Operator[]>([]), [timeZone, setTimeZone] = useState<string>()
  const [editing, setEditing] = useState(false), [note, setNote] = useState(''), [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>(), [notice, setNotice] = useState<string>()
  const load = () => actionsApi.get(actionId).then(setAction).catch(reason => setError(reason instanceof Error ? reason.message : 'This action could not load.'))
  useEffect(() => { void load(); Promise.all([api.operators(), api.workspace()]).then(([people, workspace]) => { setOperators(people); setTimeZone(workspace.timeZone) }).catch(() => undefined) }, [actionId])
  const move = async (to: ActionState) => {
    if (!action) return
    setBusy(true); setError(undefined); setNotice(undefined)
    try { setAction(await actionsApi.move(action.id, to, note, action.version)); setNote(''); setNotice(`Moved to ${stateLabels[to]}.`) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The action could not move.') }
    finally { setBusy(false) }
  }
  if (!action || !timeZone) return <section aria-labelledby="action-title"><h1 className="display" id="action-title">Action</h1>{error ? <p className="status-note" data-tone="error" role="alert">{error}</p> : <p className="status-note" role="status">Loading action…</p>}</section>
  const moves = action.legalTransitions.filter(state => state !== 'effective' && state !== 'ineffective')
  const verdicts = action.legalTransitions.filter(state => state === 'effective' || state === 'ineffective')
  const creation = action.history.find(event => event.kind === 'created'), preparer = creation?.preparedBy
  return <section className="action-detail" aria-labelledby="action-title">
    <header className="page-heading">
      <div className="builder-actions"><Link className="quiet-button focus-ring" to="/app/actions"><ArrowLeft aria-hidden="true" size={15} /> All actions</Link><Link className="quiet-button focus-ring" to="/app/flows/$flowId/results" params={{ flowId: action.evidence.flowId }}>Results</Link></div>
      <p className="eyebrow">{stateLabels[action.state]}{action.verdict && action.state === 'closed' ? ` · verdict ${stateLabels[action.verdict].toLowerCase()}` : ''} · {preparer ? `prepared by ${preparer.agent.name} for ${preparer.for.name}` : 'recommendation written by an operator'}</p>
      <h1 className="display" id="action-title" style={{ overflowWrap: 'anywhere' }}>{action.title}</h1>
      {preparer && creation?.approvers?.length ? <p className="muted">Approved by {creation.approvers.map(person => person.name).join(', ')}</p> : null}
      {action.reviewDue ? <ReviewDue /> : null}
    </header>
    {error ? <p className="status-note" data-tone="error" role="alert">{error}</p> : null}{notice ? <p className="status-note" role="status">{notice}</p> : null}
    <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 24rem), 1fr))', alignItems: 'start' }}>
      <section className="panel" style={{ padding: '1.25rem', minWidth: 0, overflowWrap: 'anywhere' }} aria-labelledby="action-details">
        <h2 id="action-details">Action</h2>
        <dl>
          <div><dt>Owner</dt><dd>{action.owner?.displayName ?? 'No owner — choose one'}</dd></div>
          <div><dt>Review date</dt><dd>{action.reviewDate}{action.reviewDue ? ' · review due' : ''}</dd></div>
          <div><dt>Target metric</dt><dd>{action.metric.name} ({action.metric.unit}) · {directionLabel(action.metric.direction)} · baseline {formatNumber(action.metric.baselineValue)}</dd></div>
          <div><dt>Rationale</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{action.rationale}</dd></div>
        </dl>
        {editableStates.includes(action.state) && !editing ? <button className="quiet-button focus-ring" type="button" onClick={() => setEditing(true)}>Edit action</button> : null}
        {action.legalTransitions.length ? <div style={{ marginTop: '1rem' }}>
          <label className="inspector-field">Note for the next step (optional)<textarea className="text-input" maxLength={2000} value={note} onChange={event => setNote(event.target.value)} /></label>
          <div className="builder-actions">{moves.map(state => <button key={state} className={state === 'closed' ? 'quiet-button focus-ring' : 'secondary-button focus-ring'} type="button" disabled={busy} onClick={() => void move(state)}>{state === 'in_progress' && action.state === 'ready_for_review' ? 'Back to in progress' : moveLabels[state] ?? stateLabels[state]}</button>)}</div>
          {verdicts.length ? <div style={{ marginTop: '1rem' }}><p>Your verdict. Pencil shows the measured difference but never decides whether the action worked.</p><div className="builder-actions">{verdicts.map(state => <button key={state} className="primary-button focus-ring" type="button" disabled={busy} onClick={() => void move(state)}>Mark {stateLabels[state].toLowerCase()}</button>)}</div></div> : null}
        </div> : <p className="muted">A closed action stays closed.</p>}
      </section>
      {editing ? <ActionForm operators={operators} timeZone={timeZone} busy={busy} submitLabel="Save changes" initial={{ title: action.title, rationale: action.rationale, ownerOperatorId: action.owner?.id ?? '', reviewDate: action.reviewDate, metric: action.metric }}
        onSubmit={fields => { setBusy(true); setError(undefined); actionsApi.edit(action.id, { ...fields, expectedVersion: action.version }).then(next => { setAction(next); setEditing(false); setNotice('Changes saved and recorded in the history.') }).catch(reason => setError(reason instanceof Error ? reason.message : 'The changes could not be saved.')).finally(() => setBusy(false)) }}>
        <h2>Edit action</h2><button className="quiet-button focus-ring" type="button" onClick={() => setEditing(false)}>Cancel editing</button>
      </ActionForm> : null}
      <section className="panel" style={{ padding: '1.25rem', minWidth: 0, overflowWrap: 'anywhere' }} aria-labelledby="evidence-title">
        <h2 id="evidence-title">Evidence</h2>
        <EvidenceFigures figures={action.evidence.figures} />
        <p className="muted">Copied from results on {new Date(action.evidence.capturedAt).toLocaleString('en', { timeZone })}. Later responses do not change these figures.</p>
      </section>
      <ActionReminders reminders={action.reminders} />
      <ActionMeasurements action={action} timeZone={timeZone} onChanged={() => void load()} />
      <ActionTask actionId={action.id} status={action.task} onChanged={() => void load()} />
      <ActionHistory history={action.history} timeZone={timeZone} />
    </div>
  </section>
}
