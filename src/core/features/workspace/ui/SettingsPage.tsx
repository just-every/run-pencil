import { SmsConnection } from '../../sms/ui'
import { Link } from '@tanstack/react-router'
import { TimeZoneField } from './TimeZoneField'
import { canonicalTimeZone } from '../../../shared/ianaTimeZone'
import { BrandSettings } from '../../brand'
import { PaymentConnection } from '../../payments/ui'
import { IntegrationLedger, ResponseWebhooks } from '../../webhooks/ui'
import { Clock3 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api, type Operator, type WorkspaceSettings } from '../../../app/api'
import { useProtectUnsavedChanges } from '../../../shared/ui/UnsavedChanges'
import { OperatorAccess } from './OperatorAccess'
import { LoadProblem } from '../../../app/ui/LoadProblem'

type Notice = { tone: 'error' | 'success'; message: string }
export function SettingsPage({ operatorId }: { operatorId: string }) {
  const [workspace, setWorkspace] = useState<WorkspaceSettings>()
  const [operators, setOperators] = useState<Operator[]>()
  const [embedOrigins, setEmbedOrigins] = useState('')
  const [timeZone, setTimeZone] = useState('')
  const [zoneError, setZoneError] = useState<string>()
  const [sendingWindowStart, setSendingWindowStart] = useState('')
  const [sendingWindowEnd, setSendingWindowEnd] = useState('')
  const [reminderDelayHours, setReminderDelayHours] = useState(48)
  const [notice, setNotice] = useState<Notice>()
  const [saving, setSaving] = useState(false)
  const applyWorkspace = (next: WorkspaceSettings) => {
    setWorkspace(next); setEmbedOrigins(next.embedAllowedOrigins.join('\n')); setTimeZone(next.timeZone)
    setSendingWindowStart(next.sendingWindowStart); setSendingWindowEnd(next.sendingWindowEnd); setReminderDelayHours(next.reminderDelayHours)
  }
  const dirty = !!workspace && (reminderDelayHours !== workspace.reminderDelayHours || timeZone !== workspace.timeZone || sendingWindowStart !== workspace.sendingWindowStart || sendingWindowEnd !== workspace.sendingWindowEnd || JSON.stringify(embedOrigins.split(/\s+/).filter(Boolean)) !== JSON.stringify(workspace.embedAllowedOrigins))
  useProtectUnsavedChanges(dirty)
  const load = () => {
    setNotice(undefined)
    void Promise.all([api.workspace(), api.operators()]).then(([nextWorkspace, nextOperators]) => {
      applyWorkspace(nextWorkspace); setOperators(nextOperators)
    }).catch((reason: unknown) => setNotice({ tone: 'error', message: reason instanceof Error ? reason.message : 'Workspace settings could not load.' }))
  }
  useEffect(load, [])
  const saveWorkspace = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setZoneError(undefined)
    const canonical = canonicalTimeZone(timeZone)
    if (!canonical) { setZoneError(`Choose a valid time zone. Your saved zone is still ${workspace?.timeZone}.`); return }
    setSaving(true); setNotice(undefined)
    try {
      applyWorkspace(await api.updateWorkspace({ reminderDelayHours, timeZone: canonical, sendingWindowStart, sendingWindowEnd, embedAllowedOrigins: embedOrigins.split(/\s+/).filter(Boolean) }))
      setNotice({ tone: 'success', message: 'Workspace settings saved.' })
    } catch (reason) { setNotice({ tone: 'error', message: reason instanceof Error ? reason.message : 'Workspace settings could not be saved.' }) }
    finally { setSaving(false) }
  }
  if (!workspace || !operators) return <section aria-label="Load workspace settings">{notice ? <LoadProblem message={notice.message} retryLabel="Retry settings" onRetry={load} /> : <p className="status-note">Loading workspace settings…</p>}</section>
  return <section className="workspace-settings" aria-labelledby="settings-title">
    <header className="page-heading"><p className="eyebrow">{workspace.name}</p><h1 className="display" id="settings-title">Workspace settings</h1></header>
    {notice ? <p className="status-note" data-tone={notice.tone} role={notice.tone === 'error' ? 'alert' : 'status'}>{notice.message}</p> : null}
    <div className="settings-grid">
      <form className="panel settings-card" onSubmit={saveWorkspace}>
        <header className="card-title"><Clock3 aria-hidden="true" size={22} strokeWidth={1.75} /><h2 className="display">Time and embeds</h2></header>
        <TimeZoneField value={timeZone} disabled={saving} onChange={value => { setTimeZone(value); setZoneError(undefined) }} error={zoneError} />
        <div className="settings-pair">
          <label className="inspector-field">Send from<input disabled={saving} className="text-input" onChange={(event) => setSendingWindowStart(event.target.value)} required type="time" value={sendingWindowStart} /></label>
          <label className="inspector-field">Send until<input disabled={saving} className="text-input" onChange={(event) => setSendingWindowEnd(event.target.value)} required type="time" value={sendingWindowEnd} /></label>
        </div>
        <label className="inspector-field">Reminder delay (hours)<input className="text-input" disabled={saving} required type="number" min={0} max={8760} value={reminderDelayHours} onChange={e => setReminderDelayHours(Number(e.target.value))} /></label>
        <p className="muted settings-help">New launches keep this delay. Changing it does not move reminders already launched.</p>
        <p className="muted settings-help">Sign-in links send immediately. Queued reminders are held until the configured window opens. Delivery outcomes are shown with each invitation.</p>
        <label className="inspector-field">Allowed embed hosts<textarea disabled={saving} className="text-area" placeholder="https://www.your-business.example" value={embedOrigins} onChange={(event) => setEmbedOrigins(event.target.value)} /></label><p className="muted settings-help">One exact HTTPS origin per line. An empty list blocks embedding; direct links remain available.</p>
        <button className="primary-button focus-ring settings-save" disabled={saving} type="submit">{saving ? 'Saving…' : 'Save workspace settings'}</button>
      </form>
      <section className="panel settings-card"><h2 className="display">Backup and restore</h2><p>Download and check a private copy of your forms, answers and workspace history.</p><Link className="secondary-button focus-ring" to="/app/backup">Open backup and restore</Link></section>
      <SmsConnection/><PaymentConnection />
      <ResponseWebhooks />
      <IntegrationLedger />
      <BrandSettings />
      <OperatorAccess initialOperators={operators} operatorId={operatorId} />
    </div>
  </section>
}
