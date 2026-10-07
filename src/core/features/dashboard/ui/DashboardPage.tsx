import { Plus, RefreshCw } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { api, type DashboardFlow, type WorkspaceSettings } from '../../../app/api'
import { useProtectUnsavedChanges, useUnsavedChanges } from '../../../shared/ui/UnsavedChanges'
import { FlowCard } from './FlowCard'

function suggestedSlug(title: string) {
  return title.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120).replace(/-+$/g, '')
}

export function DashboardPage({ initialData }: { initialData: { flows: DashboardFlow[]; workspace: WorkspaceSettings; hasFlows: boolean } }) {
  const navigate = useNavigate()
  const [flows, setFlows] = useState(initialData.flows)
  const [workspace, setWorkspace] = useState(initialData.workspace)
  const [hasFlows, setHasFlows] = useState(initialData.hasFlows)
  const [error, setError] = useState<string>()
  const [status, setStatus] = useState<DashboardFlow['status'] | 'active'>('active')
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [showCreate, setShowCreate] = useState(!initialData.hasFlows)
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(false)
  const [copySaves, setCopySaves] = useState(new Set<string>())
  const onCopySaving = useCallback((id: string, busy: boolean) => {
    setCopySaves((previous) => {
      if (previous.has(id) === busy) return previous
      const next = new Set(previous)
      if (busy) next.add(id); else next.delete(id)
      return next
    })
  }, [])
  const saving = creating || copySaves.size > 0
  const requestVersion = useRef(0)
  const mounted = useRef(true)
  const markSaved = useProtectUnsavedChanges(!!title || !!slug)
  const { dirty } = useUnsavedChanges()

  const load = (requestedStatus = status) => {
    const version = ++requestVersion.current
    setError(undefined); setLoading(true)
    Promise.all([api.dashboard(requestedStatus === 'active' ? undefined : requestedStatus), api.workspace()]).then(([nextFlows, nextWorkspace]) => {
      if (requestVersion.current !== version) return
      setFlows(nextFlows); setWorkspace(nextWorkspace)
      if (nextFlows.length) setHasFlows(true)
    }).catch((reason: unknown) => {
      if (requestVersion.current === version) setError(reason instanceof Error ? reason.message : 'The dashboard could not load.')
    }).finally(() => { if (requestVersion.current === version) setLoading(false) })
  }
  // The route loader already provided this view. Refresh only on an explicit
  // request, with editors locked until the replacement list is acknowledged.
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; requestVersion.current++ } }, [])
  const updateList = (nextStatus = status) => {
    if (loading || saving) return
    if (!showCreate && dirty && !window.confirm('Discard unfinished copies and update this list?')) return
    setStatus(nextStatus)
    load(nextStatus)
  }

  const createFlow = async () => {
    setError(undefined); setCreating(true)
    try {
      const flow = await api.createFlow({ title, slug })
      if (!mounted.current) return
      setTitle(''); setSlug(''); markSaved()
      await navigate({ to: '/app/flows/$flowId/builder', params: { flowId: flow.id } })
    } catch (reason) { if (mounted.current) setError(reason instanceof Error ? reason.message : 'The draft flow could not be created.') }
    finally { if (mounted.current) setCreating(false) }
  }
  const cancel = () => { setShowCreate(false); setTitle(''); setSlug(''); setSlugEdited(false); setError(undefined) }

  return <section aria-labelledby="dashboard-title">
    <header className="dashboard-heading">
      <div><p className="eyebrow">{workspace.name}</p><h1 id="dashboard-title" className="display">Your flows</h1></div>
      <div className="builder-actions">
        {!showCreate ? <button className="primary-button focus-ring" disabled={loading || saving} type="button" onClick={() => { if (dirty && !window.confirm('Discard the unfinished copy and create a new flow?')) return; setError(undefined); setShowCreate(true) }}><Plus size={16} aria-hidden="true" /> New flow</button> : null}
        <button className="quiet-button focus-ring" disabled={loading || saving} onClick={() => updateList()} type="button"><RefreshCw aria-hidden="true" size={16} /> Refresh</button>
      </div>
    </header>
    {error ? <p className="status-note" data-tone="error" role="alert">{error}</p> : null}
    <nav className="builder-actions" aria-label="Filter flows" style={{ marginBottom: '1rem' }}>
      {(['active', 'draft', 'open', 'closed', 'archived'] as const).map((item) => <button aria-pressed={status === item} className="quiet-button focus-ring" data-selected={status === item} key={item} disabled={loading || saving} onClick={() => { if (status !== item) updateList(item) }} type="button">{item}</button>)}
    </nav>
    {showCreate ? <form className="panel" onSubmit={(event) => { event.preventDefault(); void createFlow() }} style={{ padding: '2rem', maxWidth: '42rem', marginBottom: '1.5rem' }}>
      {!hasFlows ? <><p className="eyebrow">Ask → Signal → Act</p><h2 className="display" style={{ fontSize: '2.35rem', margin: '.55rem 0' }}>Create your first flow</h2><p className="muted" style={{ lineHeight: 1.55 }}>Ask a clear question, use the answers to make a decision, then act.</p></> : <h2 className="display" style={{ fontSize: '2.35rem', margin: 0 }}>New flow</h2>}
      <div className="dashboard-create">
        <label className="inspector-field">Flow name<input disabled={creating} required className="text-input" onChange={(event) => { const name = event.target.value; setTitle(name); if (!slugEdited) setSlug(suggestedSlug(name)) }} placeholder="Post-visit feedback" value={title} /></label>
        <label className="inspector-field">Public link<input disabled={creating} required maxLength={120} className="text-input" onChange={(event) => { setSlugEdited(true); setSlug(event.target.value) }} placeholder="post-visit-feedback" value={slug} /></label>
        <div className="builder-actions"><button className="primary-button focus-ring" disabled={creating || !title.trim() || !slug.trim()} type="submit"><Plus aria-hidden="true" size={16} /> {creating ? 'Creating…' : 'Create draft flow'}</button><button className="quiet-button focus-ring" disabled={creating} onClick={cancel} type="button">Cancel</button></div>
      </div>
    </form> : null}
    {loading ? <p className="status-note" role="status">Updating flows…</p> : null}
    {!loading && !error && !flows.length && !showCreate ? <section className="quiet-panel" style={{ padding: '1.5rem' }}><h2>{hasFlows || status !== 'active' ? `No ${status} flows` : 'No flows yet'}</h2>{!hasFlows && status === 'active' ? <p className="muted">Ask → Signal → Act. Create a flow to ask, make a decision, then act.</p> : <p className="muted">Choose another filter or create a new flow.</p>}</section> : null}
    {!showCreate ? <div className="flow-grid" aria-busy={loading}>{flows.map((flow) => <FlowCard flow={flow} key={flow.id} refreshing={loading || saving} onSavingChange={onCopySaving} timeZone={workspace.timeZone} />)}</div> : null}
  </section>
}
