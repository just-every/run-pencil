import { Clock3 } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { api, type Operator, type WorkspaceSettings } from '../../../app/api'
import { useProtectUnsavedChanges } from '../../../shared/ui/UnsavedChanges'
import { OperatorAccess } from './OperatorAccess'

type Notice = { tone: 'error' | 'success'; message: string }
export function SettingsPage({ operatorId }: { operatorId: string }) {
  const [workspace, setWorkspace] = useState<WorkspaceSettings>()
  const [operators, setOperators] = useState<Operator[]>()
  const [embedOrigins, setEmbedOrigins] = useState('')
  const [timeZone, setTimeZone] = useState('')
  const [sendingWindowStart, setSendingWindowStart] = useState('')
  const [sendingWindowEnd, setSendingWindowEnd] = useState('')
  const [notice, setNotice] = useState<Notice>()
  const [saving, setSaving] = useState(false)
  const applyWorkspace = (next: WorkspaceSettings) => {
    setWorkspace(next); setEmbedOrigins(next.embedAllowedOrigins.join('\n')); setTimeZone(next.timeZone)
    setSendingWindowStart(next.sendingWindowStart); setSendingWindowEnd(next.sendingWindowEnd)
  }
  const dirty = !!workspace && (timeZone !== workspace.timeZone || sendingWindowStart !== workspace.sendingWindowStart || sendingWindowEnd !== workspace.sendingWindowEnd || JSON.stringify(embedOrigins.split(/\s+/).filter(Boolean)) !== JSON.stringify(workspace.embedAllowedOrigins))
  useProtectUnsavedChanges(dirty)
  const load = () => {
    setNotice(undefined)
    void Promise.all([api.workspace(), api.operators()]).then(([nextWorkspace, nextOperators]) => {
      applyWorkspace(nextWorkspace); setOperators(nextOperators)
    }).catch((reason: unknown) => setNotice({ tone: 'error', message: reason instanceof Error ? reason.message : 'Workspace settings could not load.' }))
  }
  useEffect(load, [])
  const saveWorkspace = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSaving(true); setNotice(undefined)
    try {
      applyWorkspace(await api.updateWorkspace({ timeZone, sendingWindowStart, sendingWindowEnd, embedAllowedOrigins: embedOrigins.split(/\s+/).filter(Boolean) }))
      setNotice({ tone: 'success', message: 'Workspace settings saved.' })
    } catch (reason) { setNotice({ tone: 'error', message: reason instanceof Error ? reason.message : 'Workspace settings could not be saved.' }) }
    finally { setSaving(false) }
  }
  if (!workspace || !operators) return <section aria-label="Load workspace settings"><Link className="quiet-button focus-ring" to="/app">All flows</Link>{notice ? <><p className="status-note" data-tone="error" role="alert">{notice.message}</p><button className="secondary-button focus-ring" type="button" onClick={load}>Retry settings</button></> : <p className="status-note">Loading workspace settings…</p>}</section>
  return <section aria-labelledby="settings-title">
    <header className="page-heading"><p className="eyebrow">{workspace.name}</p><h1 className="display" id="settings-title">Workspace settings</h1></header>
    {notice ? <p className="status-note" data-tone={notice.tone} role={notice.tone === 'error' ? 'alert' : 'status'}>{notice.message}</p> : null}
    <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 23rem), 1fr))' }}>
      <form className="panel" onSubmit={saveWorkspace} style={{ padding: '1.25rem' }}>
        <header style={{ display: 'flex', gap: '.7rem', alignItems: 'center' }}><Clock3 aria-hidden="true" color="var(--violet)" size={20} /><h2 className="display" style={{ fontSize: '2rem', margin: 0 }}>Time and embeds</h2></header>
        <label className="inspector-field" style={{ marginTop: '1.25rem' }}>Time zone<input disabled={saving} autoComplete="off" className="text-input" onChange={(event) => setTimeZone(event.target.value)} placeholder="Australia/Brisbane" required value={timeZone} /></label>
        <p className="muted" style={{ fontSize: '.84rem', lineHeight: 1.5 }}>Use <code>UTC</code> or an IANA name such as <code>Australia/Brisbane</code>. Published deadlines keep their original zone.</p>
        <div style={{ display: 'grid', gap: '.75rem', gridTemplateColumns: '1fr 1fr', marginTop: '1rem' }}>
          <label className="inspector-field">Send from<input disabled={saving} className="text-input" onChange={(event) => setSendingWindowStart(event.target.value)} required type="time" value={sendingWindowStart} /></label>
          <label className="inspector-field">Send until<input disabled={saving} className="text-input" onChange={(event) => setSendingWindowEnd(event.target.value)} required type="time" value={sendingWindowEnd} /></label>
        </div>
        <p className="muted">Sign-in links send immediately. Queued reminders are held until the configured window opens. Delivery outcomes are shown with each invitation. Digests are deferred in this release profile.</p>
        <label className="inspector-field" style={{ marginTop: '1rem' }}>Allowed embed hosts<textarea disabled={saving} className="text-area" placeholder="https://www.your-business.example" value={embedOrigins} onChange={(event) => setEmbedOrigins(event.target.value)} /></label><p className="muted">One exact HTTPS origin per line. An empty list blocks embedding; direct links remain available.</p>
        <button className="primary-button focus-ring" disabled={saving} style={{ marginTop: '1.25rem' }} type="submit">{saving ? 'Saving…' : 'Save workspace settings'}</button>
      </form>
      <OperatorAccess initialOperators={operators} operatorId={operatorId} />
    </div>
  </section>
}
