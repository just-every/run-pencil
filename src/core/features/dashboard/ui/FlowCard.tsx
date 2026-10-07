import { BarChart3, PencilLine } from 'lucide-react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { useProtectUnsavedChanges } from '../../../shared/ui/UnsavedChanges'
import { api, type DashboardFlow } from '../../../app/api'

export function FlowCard({ flow, timeZone, refreshing = false, onSavingChange }: { flow: DashboardFlow; timeZone: string; refreshing?: boolean; onSavingChange?: (id: string, busy: boolean) => void }) {
  const navigate = useNavigate()
  const [duplicating, setDuplicating] = useState(false)
  const [copyTitle, setCopyTitle] = useState(`${flow.title} copy`)
  const [copySlug, setCopySlug] = useState(`${flow.slug}-copy`)
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  useEffect(() => { onSavingChange?.(flow.id, busy); return () => { onSavingChange?.(flow.id, false) } }, [busy, flow.id, onSavingChange])
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const markSaved = useProtectUnsavedChanges(busy || (duplicating && (copyTitle !== `${flow.title} copy` || copySlug !== `${flow.slug}-copy`)))
  const duplicate = async () => {
    setBusy(true); setError(undefined)
    try {
      const copy = await api.duplicateFlow(flow.id, { title: copyTitle, slug: copySlug })
      if (!mounted.current) return
      setDuplicating(false); markSaved()
      await navigate({ to: '/app/flows/$flowId/builder', params: { flowId: copy.id } })
    } catch (reason) { if (mounted.current) setError(reason instanceof Error ? reason.message : 'The flow could not be copied.') }
    finally { if (mounted.current) setBusy(false) }
  }
  const date = new Date(flow.lastActivityAt)
  const activity = Number.isNaN(date.valueOf()) ? 'No recorded activity' : `Last activity ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone }).format(date)}`
  return <article className="panel flow-card">
    <header><span className="badge" data-status={flow.status}>{flow.status}</span><span className="muted" style={{ fontSize: '.78rem' }}>Draft v{flow.draftVersion}</span></header>
    <div><h2>{flow.title}</h2><p className="muted" style={{ margin: '.55rem 0 0', fontSize: '.9rem' }}>{activity}</p></div>
    <div className="quiet-panel" style={{ padding: '.75rem' }}><strong style={{ display: 'block', fontSize: '1.2rem' }}>{flow.completedResponses} completed · {flow.starts} starts</strong></div>
    <p className="muted" style={{ margin: 0, fontSize: '.82rem' }}>Audience: {flow.audience.launchedParticipants === 0 ? 'Anonymous public link' : flow.audience.eligibleParticipants === 0 ? '0 / 0 eligible participants' : `${flow.audience.completedParticipants ?? 0} / ${flow.audience.eligibleParticipants} eligible participants completed`} · Analysis: {flow.analysisStatus}.</p>
    <nav className="flow-card-actions" aria-label={`${flow.title} actions`}>
      <Link className="secondary-button focus-ring" to="/app/flows/$flowId/builder" params={{ flowId: flow.id }}><PencilLine aria-hidden="true" size={15} /> Builder</Link>
      <Link className="quiet-button focus-ring" to="/app/flows/$flowId/results" params={{ flowId: flow.id }}><BarChart3 aria-hidden="true" size={15} /> Results</Link>
      {!duplicating ? <button className="quiet-button focus-ring" disabled={refreshing} type="button" onClick={() => { setError(undefined); setDuplicating(true) }}>Duplicate flow</button> : null}
    </nav>
    {duplicating ? <form onSubmit={(event) => { event.preventDefault(); void duplicate() }}>
      <p className="muted">Copy questions and paths. Existing responses stay with the original.</p>
      <label className="inspector-field">Copy name<input disabled={busy || refreshing} required className="text-input" value={copyTitle} onChange={(event) => setCopyTitle(event.target.value)} /></label>
      <label className="inspector-field">Copy public link<input disabled={busy || refreshing} required maxLength={120} className="text-input" value={copySlug} onChange={(event) => setCopySlug(event.target.value)} /></label>
      {error ? <p className="status-note" data-tone="error" role="alert">{error}</p> : null}
      <div className="builder-actions" style={{ marginTop: '1rem' }}>
        <button className="secondary-button focus-ring" disabled={busy || refreshing} type="submit">{busy ? 'Copying…' : 'Create independent copy'}</button>
        <button className="quiet-button focus-ring" disabled={busy} type="button" onClick={() => { setDuplicating(false); setError(undefined); setCopyTitle(`${flow.title} copy`); setCopySlug(`${flow.slug}-copy`) }}>Cancel copy</button>
      </div>
    </form> : null}
  </article>
}
