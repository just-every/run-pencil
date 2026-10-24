import { StudioPanel } from '../../studio/ui'
import { TeamTemplatePicker } from './TeamTemplatePicker'
import { flowTemplates, type FlowTemplateId } from '../../flows'
import { Plus, RefreshCw } from 'lucide-react'
import { Link, useNavigate, useRouter } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { api, type DashboardFlow, type WorkspaceSettings } from '../../../app/api'
import { useProtectUnsavedChanges, useUnsavedChanges } from '../../../shared/ui/UnsavedChanges'
import { AppNote } from '../../../app/ui/AppNote'
import { NoteIllustration } from '../../../app/ui/NoteIllustration'
import { FlowCard } from './FlowCard'
import { ReviewDueNotice } from './ReviewDueNotice'
import { TemplatePreview } from './TemplatePreview'

function suggestedSlug(title: string) {
  return title.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120).replace(/-+$/g, '')
}

export function DashboardPage({ initialData }: { initialData: { flows: DashboardFlow[]; workspace: WorkspaceSettings; hasFlows: boolean } }) {
  const navigate = useNavigate()
  const router = useRouter()
  const [flows, setFlows] = useState(initialData.flows)
  const [workspace, setWorkspace] = useState(initialData.workspace)
  const [hasFlows, setHasFlows] = useState(initialData.hasFlows)
  const [error, setError] = useState<string>()
  const [status, setStatus] = useState<DashboardFlow['status'] | 'active'>('active')
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [showStudio,setShowStudio]=useState(false)
  const [showCreate, setShowCreate] = useState(!initialData.hasFlows)
  const [teamTemplate,setTeamTemplate]=useState<string>()
  const [template, setTemplate] = useState<FlowTemplateId>()
  const [templateSearch, setTemplateSearch] = useState('')
  const [templateCategory, setTemplateCategory] = useState('All categories')
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
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; requestVersion.current++ } }, [])
  useEffect(() => {
    setFlows(initialData.flows); setWorkspace(initialData.workspace); setHasFlows(initialData.hasFlows)
    if (initialData.hasFlows && !title && !slug) setShowCreate(false)
  }, [initialData])
  const updateList = (nextStatus = status) => {
    if (loading || saving) return
    if (!showCreate && dirty && !window.confirm('Discard unfinished copies and update this list?')) return
    setStatus(nextStatus)
    load(nextStatus)
  }

  const createFlow = async () => {
    setError(undefined); setCreating(true)
    try {
      const input = { title, slug, ...(template ? { template } : {}) }
      const flow = teamTemplate ? await api.createFromTeamTemplate(teamTemplate,{title,slug}) : await api.createFlow(input)
      if (!mounted.current) return
      setTitle(''); setSlug(''); setSlugEdited(false); setTemplate(undefined); setTeamTemplate(undefined); setShowCreate(false); markSaved()
      await router.invalidate({ filter: match => match.routeId === '/app/' })
      if (!mounted.current) return
      await navigate({ to: '/app/flows/$flowId/builder', params: { flowId: flow.id } })
    } catch (reason) { if (mounted.current) setError(reason instanceof Error ? reason.message : 'The draft flow could not be created.') }
    finally { if (mounted.current) setCreating(false) }
  }
  const cancel = () => { setShowCreate(false); setTitle(''); setSlug(''); setSlugEdited(false); setTemplate(undefined); setTeamTemplate(undefined); setError(undefined) }

  const openCreate = () => { if (dirty && !window.confirm('Discard the unfinished copy and create a new flow?')) return; setError(undefined); setShowCreate(true) }
  const firstFlow = !hasFlows && status === 'active'

  return <section className="dashboard" aria-labelledby="dashboard-title">
    <header className="dashboard-heading">
      <div><p className="eyebrow">{workspace.name}</p><h1 id="dashboard-title" className="display">Your flows</h1></div>
      <div className="builder-actions dashboard-actions">
        <Link className="secondary-button focus-ring" to="/app/import">Import a form</Link>
        {!showCreate ? <button className="primary-button focus-ring" disabled={loading || saving} type="button" onClick={openCreate}><Plus size={16} aria-hidden="true" /> New flow</button> : null}
        <button className="quiet-button focus-ring" disabled={loading || saving} onClick={() => updateList()} type="button"><RefreshCw aria-hidden="true" size={16} /> Refresh</button>
      </div>
    </header>
    {error ? <p className="status-note" data-tone="error" role="alert">{error}</p> : null}
    <ReviewDueNotice />
    <nav className="filter-row" aria-label="Filter flows">
      {(['active', 'draft', 'open', 'closed', 'archived'] as const).map((item) => <button aria-pressed={status === item} className="quiet-button focus-ring" data-selected={status === item} key={item} disabled={loading || saving} onClick={() => { if (status !== item) updateList(item) }} type="button">{item === 'active' ? 'All flows' : item[0].toUpperCase() + item.slice(1)}</button>)}
    </nav>
    {showCreate && !showStudio ? <form className="panel dashboard-create-panel" onSubmit={(event) => { event.preventDefault(); void createFlow() }}>
      <div className="dashboard-create">
        {!hasFlows ? <><p className="eyebrow">Ask → Signal → Act</p><h2 className="display">Create your first flow</h2><p className="muted">Ask a clear question, use the answers to make a decision, then act.</p></> : <h2 className="display">New flow</h2>}
        <button className="secondary-button focus-ring" type="button" disabled={creating} onClick={()=>setShowStudio(true)}>Generate with AI</button>
        <label className="inspector-field">Search templates<input className="text-input" type="search" value={templateSearch} onChange={event => setTemplateSearch(event.target.value)} /></label>
        <label className="inspector-field">Template category<select aria-label="Template category" className="text-input" value={templateCategory} onChange={event => setTemplateCategory(event.target.value)}><option>All categories</option>{[...new Set(flowTemplates.map(item => item.category))].map(category => <option key={category}>{category}</option>)}</select></label>
        <div aria-label="Flow templates" className="template-gallery">
          {flowTemplates.filter(item => (templateCategory === 'All categories' || item.category === templateCategory) && `${item.title} ${item.category}`.toLowerCase().includes(templateSearch.toLowerCase())).map(item => <button className="secondary-button focus-ring" aria-pressed={template === item.id} disabled={creating} type="button" key={item.id} onClick={() => { setTeamTemplate(undefined); setTemplate(item.id); setTitle(item.title); setSlug(`${suggestedSlug(item.title)}-${crypto.randomUUID().slice(0, 8)}`); setSlugEdited(false) }}>{item.title}</button>)}
          <button className="secondary-button focus-ring" aria-pressed={!template && !teamTemplate} disabled={creating} type="button" onClick={() => { setTemplate(undefined); setTeamTemplate(undefined); setTitle(''); setSlug(''); setSlugEdited(false) }}>Blank flow</button>
        </div>
        <TeamTemplatePicker selected={teamTemplate} disabled={creating} onSelect={item=>{setTeamTemplate(item?.id);setTemplate(undefined);if(item){setTitle(item.name);setSlug(`${suggestedSlug(item.name)}-${crypto.randomUUID().slice(0,8)}`);setSlugEdited(false)}}} />
        {template ? <p className="muted">{flowTemplates.find(item => item.id === template)?.description} You can edit every question before publishing.</p> : null}
        <label className="inspector-field">Flow name<input disabled={creating} required className="text-input" onChange={(event) => { const name = event.target.value; setTitle(name); if (!slugEdited) setSlug(suggestedSlug(name)) }} placeholder="Post-visit feedback" value={title} /></label>
        <label className="inspector-field">Public link<input disabled={creating} required maxLength={120} className="text-input" onChange={(event) => { setSlugEdited(true); setSlug(event.target.value) }} placeholder="post-visit-feedback" value={slug} /></label>
        <div className="builder-actions dashboard-create-actions"><button className="primary-button focus-ring" disabled={creating || !title.trim() || !slug.trim()} type="submit"><Plus aria-hidden="true" size={16} /> {creating ? 'Creating…' : 'Create draft flow'}</button><button className="quiet-button focus-ring" disabled={creating} onClick={cancel} type="button">Cancel</button></div>
      </div>
      {template ? <div className="dashboard-create-preview"><TemplatePreview template={template} /><AppNote className="create-note" wideOnly>you can edit every question</AppNote></div> : null}
    </form> : null}
    {showStudio ? <StudioPanel onClose={()=>{setShowStudio(false);void router.invalidate({filter:match=>match.routeId==='/app/'})}} /> : null}
    {loading ? <p className="status-note" role="status">Updating flows…</p> : null}
    {!loading && !error && !flows.length && !showCreate ? firstFlow
      ? <section className="panel dashboard-empty" aria-labelledby="empty-title"><div className="dashboard-empty__copy"><h2 id="empty-title" className="display">No flows yet</h2><p className="muted">Ask → Signal → Act. Create a flow to ask, make a decision, then act.</p><button className="primary-button focus-ring" disabled={saving} type="button" onClick={openCreate}><Plus size={16} aria-hidden="true" /> New flow</button></div><div className="dashboard-empty__art"><NoteIllustration variant="blank" /><AppNote className="empty-note">ask your first question</AppNote></div></section>
      : <section className="quiet-panel dashboard-filter-empty" aria-labelledby="empty-title"><h2 id="empty-title" className="display">{`No ${status} flows`}</h2><p className="muted">Choose another filter or create a new flow.</p></section> : null}
    {!showCreate && !showStudio ? <div className="flow-grid" aria-busy={loading}>{flows.map((flow) => <FlowCard flow={flow} key={flow.id} refreshing={loading || saving} onSavingChange={onCopySaving} timeZone={workspace.timeZone} />)}</div> : null}
  </section>
}
