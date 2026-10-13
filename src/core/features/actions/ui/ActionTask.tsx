import { useState } from 'react'
import { actionsApi, type TaskPreview, type TaskStatus } from './actionsApi'

const stateText: Record<string, string> = { pending: 'Pending', confirmed: 'Confirmed', unknown: 'Unknown — the task system may have it', failed: 'Failed' }

/** ACT-004, ACT-006, ACT-007: the confirmation screen shows exactly the JSON that will leave, and nothing else. */
export function ActionTask({ actionId, status, onChanged }: { actionId: string; status: TaskStatus; onChanged: () => void }) {
  const [preview, setPreview] = useState<TaskPreview>(), [busy, setBusy] = useState(false), [error, setError] = useState<string>()
  const delivery = status.delivery
  const run = async (operation: () => Promise<unknown>) => {
    setBusy(true); setError(undefined)
    try { await operation(); setPreview(undefined); onChanged() } catch (reason) { setError(reason instanceof Error ? reason.message : 'The task request failed.') } finally { setBusy(false) }
  }
  const open = async () => { setBusy(true); setError(undefined); try { setPreview(await actionsApi.task(actionId)) } catch (reason) { setError(reason instanceof Error ? reason.message : 'The task could not be prepared.') } finally { setBusy(false) } }
  return <section className="panel" style={{ padding: '1.25rem', minWidth: 0 }} aria-labelledby="task-title">
    <h2 id="task-title">External task</h2>
    {!status.available ? <><p className="muted" id="task-setup">{status.message}</p><button className="secondary-button focus-ring" type="button" disabled aria-describedby="task-setup">Create external task</button></> : null}
    {delivery ? <>
      <p>Delivery: <strong>{stateText[delivery.state]}</strong>{delivery.remoteTaskId ? <> · Remote task ID <code>{delivery.remoteTaskId}</code></> : null}</p>
      {delivery.state === 'unknown' ? <p className="muted">The request may have reached the task system. Retrying sends the same idempotency key, so it returns the task it already created instead of making a second one.</p> : null}
      {delivery.stale && delivery.state !== 'confirmed' ? <p className="status-note">The action changed after the task was confirmed. Review the task again before it is sent.</p> : null}
      <details><summary>Attempts ({delivery.attempts.length})</summary><ol>{delivery.attempts.map(attempt => <li key={attempt.id}>{attempt.startedAt} · {attempt.outcome ?? 'in progress'}{attempt.outcomeClass ? ` · ${attempt.outcomeClass}` : ''}{attempt.httpStatus ? ` · HTTP ${attempt.httpStatus}` : ''}{attempt.operator ? ` · ${attempt.operator}` : ''}</li>)}</ol><p className="muted">Idempotency key <code>{delivery.idempotencyKey}</code></p></details>
    </> : null}
    {status.available && delivery?.state !== 'confirmed' && !preview ? <div className="builder-actions" style={{ marginTop: '.75rem' }}>
      <button className="secondary-button focus-ring" type="button" disabled={busy || delivery?.inFlight} onClick={() => void open()}>{delivery ? 'Review and confirm the task again' : 'Create external task'}</button>
      {delivery && !delivery.stale && (delivery.state === 'failed' || delivery.state === 'unknown') ? <button className="quiet-button focus-ring" type="button" disabled={busy || delivery.inFlight} onClick={() => void run(() => actionsApi.retryTask(actionId))}>Retry with the same key</button> : null}
    </div> : null}
    {preview?.payload ? <section aria-labelledby="task-confirm-title" style={{ marginTop: '1rem' }}>
      <h3 id="task-confirm-title">This exact JSON will be sent</h3>
      <pre tabIndex={0} aria-label="Task JSON" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxWidth: '100%' }}>{JSON.stringify(preview.payload, null, 2)}</pre>
      <div className="builder-actions"><button className="primary-button focus-ring" type="button" disabled={busy} onClick={() => void run(() => actionsApi.confirmTask(actionId, preview.payloadSha256!))}>{busy ? 'Sending…' : 'Confirm and send'}</button><button className="quiet-button focus-ring" type="button" disabled={busy} onClick={() => setPreview(undefined)}>Cancel</button></div>
    </section> : null}
    {error ? <p className="status-note" data-tone="error" role="alert">{error}</p> : null}
  </section>
}
