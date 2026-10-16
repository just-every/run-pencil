import { useEffect, useState, type FormEvent } from 'react'
import { actionRequest } from './actionsApi'
import { isTodoist, todoistEndpoint } from '../task-request'
import { ReceiverContract } from './ReceiverContract'
import { TaskSetup } from './TaskSetup'

type Connection = { saved: boolean; configured: boolean; url?: string; hasKey: boolean }
type TestResult = { message: string; taskId: string; taskUrl?: string }
const path = '/api/app/connections/task'

export function TaskConnection({ onSaved }: { onSaved: () => void }) {
  const [connection, setConnection] = useState<Connection>()
  const [url, setUrl] = useState(todoistEndpoint), [apiKey, setApiKey] = useState('')
  const [busy, setBusy] = useState<string>(), [error, setError] = useState<string>(), [notice, setNotice] = useState<string>()
  const [test, setTest] = useState<TestResult>()
  const update = (next: Connection) => { setConnection(next); setUrl(next.url ?? todoistEndpoint); setApiKey('') }
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
  const dirty = !!connection && (url.trim() !== (connection.url ?? todoistEndpoint) || !!apiKey)
  return <section aria-labelledby="task-connection-title" style={{ marginBlock: '1rem', minWidth: 0, overflowWrap: 'anywhere' }}>
    <h3 id="task-connection-title">Connection</h3>
    <label className="inspector-field">Task service<select className="text-input" value={isTodoist(url) ? 'todoist' : 'webhook'} disabled={!!busy || !connection} onChange={event => { setUrl(event.target.value === 'todoist' ? todoistEndpoint : ''); setApiKey(''); setTest(undefined); setNotice(undefined) }}><option value="todoist">Todoist · connect with your API token</option><option value="webhook">Custom receiver · advanced</option></select></label>
    <TaskSetup todoist={isTodoist(url)} />
    <p className="muted">Only the installation owner can save, reset or test the connection.</p>
    {connection ? <p className="muted">{connection.saved ? 'Using the saved connection for this workspace. It overrides deployment settings.' : connection.configured ? 'Using deployment settings. Saving here will override them.' : 'No connection is configured yet.'}{connection.hasKey ? ' A bearer key is configured; it is never shown here.' : ''}</p> : <p className="muted" role="status">{busy === 'load' ? 'Loading connection…' : 'Connection settings could not load.'}</p>}
    <form onSubmit={event => void save(event)}>
      <fieldset disabled={!!busy || !connection} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        {!isTodoist(url) ? <><label className="inspector-field">Endpoint URL<input className="text-input" type="url" required maxLength={2000} value={url} placeholder="https://receiver.example.com/pencil/tasks" autoComplete="off" aria-describedby="task-endpoint-note" onChange={event => { setUrl(event.target.value); setTest(undefined); setNotice(undefined) }} /></label>
        <p className="muted" id="task-endpoint-note">Use HTTPS without credentials, a query or a fragment in the URL. Local development and tests also accept HTTP on loopback addresses.</p></> : null}
        <label className="inspector-field">{isTodoist(url) ? 'Todoist API token' : 'Bearer key'}<input className="text-input" type="password" required maxLength={4096} value={apiKey} autoComplete="new-password" aria-describedby="task-key-note" onChange={event => { setApiKey(event.target.value); setTest(undefined); setNotice(undefined) }} /></label>
        <p className="muted" id="task-key-note">Enter a fresh key each time you save, including when changing the URL. Saved credentials are encrypted and excluded from backups. They are sent only to the selected service in the Authorization header.</p>
        <div className="builder-actions">
          <button className="secondary-button focus-ring" type="submit" disabled={!url.trim() || !apiKey.trim()}>{busy === 'save' ? 'Saving…' : 'Save connection'}</button>
          {connection?.saved ? <button className="quiet-button focus-ring" type="button" onClick={() => void reset()}>Use deployment settings</button> : null}
        </div>
      </fieldset>
    </form>
    <p id="task-test-note">Send test task creates or retrieves a real sample named Pencil connection test in your Todoist Inbox or at your custom receiver, using fixed example values and a link to this installation's Actions page. It sends no respondent answers, operator details or content from this action. Repeating the test uses the same key so it does not add a second sample task. You can delete the sample in your task tool afterward.</p>
    {dirty ? <p className="muted">Save your changes before testing the connection.</p> : null}
    <button className="quiet-button focus-ring" type="button" disabled={!!busy || !connection?.configured || dirty} aria-describedby="task-test-note" onClick={() => void sendTest()}>{busy === 'test' ? 'Sending test task…' : 'Send test task'}</button>
    {!connection && !busy ? <div className="builder-actions"><button className="quiet-button focus-ring" type="button" onClick={() => void load()}>Reload connection</button><button className="quiet-button focus-ring" type="button" onClick={() => void reset()}>Use deployment settings</button></div> : null}
    {notice ? <p className="status-note" role="status">{notice}</p> : null}
    {test ? <p className="status-note" role="status">{test.message} Returned task ID: <code>{test.taskId}</code>{test.taskUrl ? <> · <a className="analysis-link focus-ring" href={test.taskUrl} target="_blank" rel="noreferrer">Open test task in Todoist</a></> : null}</p> : null}
    {error ? <p className="status-note" data-tone="error" role="alert">{error}</p> : null}
    {!isTodoist(url) ? <ReceiverContract /> : null}
  </section>
}
