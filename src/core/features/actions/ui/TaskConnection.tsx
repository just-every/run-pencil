import { useEffect, useState, type FormEvent } from 'react'
import { actionRequest } from './actionsApi'

type Connection = { saved: boolean; configured: boolean; url?: string; hasKey: boolean }
type TestResult = { message: string; taskId: string }
const path = '/api/app/connections/task'
const example = {
  idempotencyKey: 'pencil-action-example-action-id',
  action: {
    title: 'Shorten the wait at the counter',
    rationale: 'Improve the waiting experience.',
    owner: { name: 'Example owner', email: 'owner@example.com' },
    metric: { name: 'Short waits', unit: 'percent', direction: 'increase', baseline: { value: 33, source: 'Revision 1 results', observedAt: '2026-10-12T09:00:00.000Z' } },
    reviewDate: '2026-12-01',
    reportLink: 'https://pencil.example.com/app/actions/example-action-id',
  },
}

export function TaskConnection({ onSaved }: { onSaved: () => void }) {
  const [connection, setConnection] = useState<Connection>()
  const [url, setUrl] = useState(''), [apiKey, setApiKey] = useState('')
  const [busy, setBusy] = useState<string>(), [error, setError] = useState<string>(), [notice, setNotice] = useState<string>()
  const [test, setTest] = useState<TestResult>()
  const update = (next: Connection) => { setConnection(next); setUrl(next.url ?? ''); setApiKey('') }
  const load = async () => {
    setBusy('load'); setError(undefined)
    try { update(await actionRequest<Connection>(path)) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The connection could not load.') }
    finally { setBusy(undefined) }
  }
  useEffect(() => { void load() }, [])
  const save = async (event: FormEvent) => {
    event.preventDefault(); setBusy('save'); setError(undefined); setNotice(undefined); setTest(undefined)
    try {
      update(await actionRequest<Connection>(path, { url: url.trim(), apiKey }, 'PUT'))
      setNotice('Connection saved. You can send a test task now.'); onSaved()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'The connection could not be saved.') }
    finally { setBusy(undefined) }
  }
  const reset = async () => {
    setBusy('reset'); setError(undefined); setNotice(undefined); setTest(undefined)
    try {
      update(await actionRequest<Connection>(path, undefined, 'DELETE'))
      setNotice('Saved connection removed. Deployment settings now apply.'); onSaved()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Deployment settings could not be restored.') }
    finally { setBusy(undefined) }
  }
  const sendTest = async () => {
    setBusy('test'); setError(undefined); setNotice(undefined); setTest(undefined)
    try { setTest(await actionRequest<TestResult>(`${path}/test`, {})) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The test task failed.') }
    finally { setBusy(undefined) }
  }
  const dirty = !!connection && (url.trim() !== (connection.url ?? '') || !!apiKey)
  return <section aria-labelledby="task-connection-title" style={{ marginBlock: '1rem', minWidth: 0, overflowWrap: 'anywhere' }}>
    <h3 id="task-connection-title">Connection</h3>
    <p>A webhook is the address Pencil sends a confirmed action to. You need a custom receiver that creates tasks in your tool; Pencil does not include a built-in Jira, Asana or other vendor connection.</p>
    <p>Ask the administrator or developer of your receiver for its endpoint URL and bearer key. To build a receiver, create an HTTPS route that accepts POST requests, checks a secret bearer key you choose, and follows the contract below. A task tool's website address or ordinary API key alone is not a receiver.</p>
    <p className="muted">Pencil charges no integration fee. Your receiver's hosting and your task tool may have their own costs.</p>
    <p className="muted">Only the installation owner can save, reset or test the connection.</p>
    {connection ? <p className="muted">{connection.saved ? 'Using the saved connection for this workspace. It overrides deployment settings.' : connection.configured ? 'Using deployment settings. Saving here will override them.' : 'No connection is configured yet.'}{connection.hasKey ? ' A bearer key is configured; it is never shown here.' : ''}</p> : <p className="muted" role="status">{busy === 'load' ? 'Loading connection…' : 'Connection settings could not load.'}</p>}
    <form onSubmit={event => void save(event)}>
      <fieldset disabled={!!busy || !connection} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <label className="inspector-field">Endpoint URL<input className="text-input" type="url" required maxLength={2000} value={url} placeholder="https://receiver.example.com/pencil/tasks" autoComplete="off" aria-describedby="task-endpoint-note" onChange={event => { setUrl(event.target.value); setTest(undefined); setNotice(undefined) }} /></label>
        <p className="muted" id="task-endpoint-note">Use HTTPS without credentials, a query or a fragment in the URL. Local development and tests also accept HTTP on loopback addresses.</p>
        <label className="inspector-field">Bearer key<input className="text-input" type="password" required maxLength={4096} value={apiKey} autoComplete="new-password" aria-describedby="task-key-note" onChange={event => { setApiKey(event.target.value); setTest(undefined); setNotice(undefined) }} /></label>
        <p className="muted" id="task-key-note">Enter a fresh key each time you save, including when changing the URL. Saved credentials are encrypted and excluded from backups. They are sent only to your receiver in the Authorization header.</p>
        <div className="builder-actions">
          <button className="secondary-button focus-ring" type="submit" disabled={!url.trim() || !apiKey.trim()}>{busy === 'save' ? 'Saving…' : 'Save connection'}</button>
          {connection?.saved ? <button className="quiet-button focus-ring" type="button" onClick={() => void reset()}>Use deployment settings</button> : null}
        </div>
      </fieldset>
    </form>
    <p id="task-test-note">Send test task creates or retrieves a real sample named Pencil connection test at the saved or deployment connection, using fixed example values and a link to this installation's Actions page. It sends no respondent answers, operator details or content from this action. Repeating the test uses the same key so your receiver should return the same sample task. You can delete the sample in your task tool afterward.</p>
    {dirty ? <p className="muted">Save your changes before testing the connection.</p> : null}
    <button className="quiet-button focus-ring" type="button" disabled={!!busy || !connection?.configured || dirty} aria-describedby="task-test-note" onClick={() => void sendTest()}>{busy === 'test' ? 'Sending test task…' : 'Send test task'}</button>
    {!connection && !busy ? <div className="builder-actions"><button className="quiet-button focus-ring" type="button" onClick={() => void load()}>Reload connection</button><button className="quiet-button focus-ring" type="button" onClick={() => void reset()}>Use deployment settings</button></div> : null}
    {notice ? <p className="status-note" role="status">{notice}</p> : null}
    {test ? <p className="status-note" role="status">{test.message} Returned task ID: <code>{test.taskId}</code></p> : null}
    {error ? <p className="status-note" data-tone="error" role="alert">{error}</p> : null}
    <ReceiverContract />
  </section>
}

function ReceiverContract() {
  return <details style={{ marginTop: '1rem' }}>
    <summary>Receiver contract and complete request example</summary>
    <p>Your receiver must validate the bearer key and create or get one task by the idempotency key. Store the key-to-task mapping atomically: repeated requests, including simultaneous requests, must return the same task ID without creating another task.</p>
    <p>Pencil sends POST to your endpoint with these headers (replace the example key with your secret):</p>
    <pre tabIndex={0} style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{'Authorization: Bearer <your bearer key>\nContent-Type: application/json\nAccept: application/json\nIdempotency-Key: pencil-action-example-action-id'}</pre>
    <p>The JSON body has this exact shape. These are fictional example values. For real actions, the confirmation screen shows the actual title, rationale, owner name and email, metric, review date and signed-in action link before sending. It includes no raw answers, excerpts or evidence counts.</p>
    <pre tabIndex={0} aria-label="Receiver request example" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxWidth: '100%' }}>{JSON.stringify(example, null, 2)}</pre>
    <p>The header and body idempotency keys match. A real action uses <code>pencil-action-&lt;action ID&gt;</code> for its whole life; retries keep that key. Connection tests use a separate stable key, <code>pencil-connection-test-&lt;workspace ID&gt;</code>, so repeating a test checks that your receiver returns the same sample task.</p>
    <p>Return HTTP 200 or another 2xx status with JSON <code>{'{"taskId":"TASK-123"}'}</code>. The task ID must be 1–200 visible ASCII characters with no spaces. A repeat of this example request must return <code>{'{"taskId":"TASK-123"}'}</code> again. Pencil reads only the task ID.</p>
    <p>Respond within 10 seconds with at most 16 KiB. Redirects are not followed. A redirect or error status fails delivery; a timeout, lost connection or invalid response leaves its outcome unknown because the task may already exist. Pencil shows the outcome and offers manual retry with the same key.</p>
  </details>
}
