import { BarChart3, PencilLine } from 'lucide-react'
import { Link, useNavigate, useRouter } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { useProtectUnsavedChanges } from '../../../shared/ui/UnsavedChanges'
import { api, type DashboardFlow } from '../../../app/api'
import { shortDateTime } from '../../../shared/ui/shortDate'

export function FlowCard({ flow, timeZone, refreshing = false, onSavingChange }: { flow: DashboardFlow & { hasUnpublishedChanges?: boolean }; timeZone: string; refreshing?: boolean; onSavingChange?: (id: string, busy: boolean) => void }) {
  const navigate = useNavigate()
  const router = useRouter()
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
      await router.invalidate({ filter: match => match.routeId === '/app/' })
      if (!mounted.current) return
      await navigate({ to: '/app/flows/$flowId/builder', params: { flowId: copy.id } })
    } catch (reason) { if (mounted.current) setError(reason instanceof Error ? reason.message : 'The flow could not be copied.') }
    finally { if (mounted.current) setBusy(false) }
  }
  const date = new Date(flow.lastActivityAt)
  const activity = Number.isNaN(date.valueOf()) ? 'No recorded activity' : `Last activity ${shortDateTime(date, timeZone)}`
  const { audience } = flow
  const meta = [
    flow.hasUnpublishedChanges ? 'Unpublished changes' : undefined,
    flow.completedResponses ? `${flow.completedResponses} ${flow.completedResponses === 1 ? 'response' : 'responses'}` : undefined,
    activity,
    audience.launchedParticipants === 0 ? undefined : audience.eligibleParticipants === 0 ? '0 / 0 eligible participants' : `${audience.completedParticipants ?? 0} / ${audience.eligibleParticipants} eligible participants completed`,
  ].filter(Boolean)
  return <article className="panel flow-card">
    <h2 className="display">{flow.status === 'draft' ? <Link className="focus-ring" to="/app/flows/$flowId/builder" params={{ flowId: flow.id }}>{flow.title}</Link> : <Link className="focus-ring" to="/app/flows/$flowId/results" params={{ flowId: flow.id }}>{flow.title}</Link>}</h2>
    <p className="muted flow-card-meta"><span className="flow-card-status" data-status={flow.status}>{flow.status[0].toUpperCase() + flow.status.slice(1)}</span>{meta.map(part => <span key={part}> · {part}</span>)}</p>
    <nav className="flow-card-actions" aria-label={`${flow.title} actions`}>
      <Link className="secondary-button focus-ring" to="/app/flows/$flowId/builder" params={{ flowId: flow.id }}><PencilLine aria-hidden="true" size={15} /> Builder</Link>
      <Link className="secondary-button focus-ring" to="/app/flows/$flowId/results" params={{ flowId: flow.id }}><BarChart3 aria-hidden="true" size={15} /> Results</Link>
      {flow.analysis ? <Link className="secondary-button focus-ring" to="/app/analysis/$runId" params={{ runId: flow.analysis.id }}>Analysis{flow.analysis.stale ? ' · Stale' : ''}</Link> : null}
      {!duplicating ? <button className="quiet-button focus-ring" disabled={refreshing} type="button" onClick={() => { setError(undefined); setDuplicating(true) }}>Duplicate flow</button> : null}
    </nav>
    {duplicating ? <form className="flow-card-copy" onSubmit={(event) => { event.preventDefault(); void duplicate() }}>
      <p className="muted">Copy questions and paths. Existing responses stay with the original.</p>
      <label className="inspector-field">Copy name<input disabled={busy || refreshing} required className="text-input" value={copyTitle} onChange={(event) => setCopyTitle(event.target.value)} /></label>
      <label className="inspector-field">Copy public link<input disabled={busy || refreshing} required maxLength={120} className="text-input" value={copySlug} onChange={(event) => setCopySlug(event.target.value)} /></label>
      {error ? <p className="status-note" data-tone="error" role="alert">{error}</p> : null}
      <div className="builder-actions">
        <button className="primary-button focus-ring" disabled={busy || refreshing} type="submit">{busy ? 'Copying…' : 'Create independent copy'}</button>
        <button className="quiet-button focus-ring" disabled={busy} type="button" onClick={() => { setDuplicating(false); setError(undefined); setCopyTitle(`${flow.title} copy`); setCopySlug(`${flow.slug}-copy`) }}>Cancel copy</button>
      </div>
    </form> : null}
  </article>
}
