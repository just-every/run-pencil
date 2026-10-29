import './analysis.css'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Sparkle } from 'lucide-react'
import { api, type DashboardFlow } from '../../../app/api'
import { analysisApi, type AnalysisOptions } from './analysisApi'
import { ProviderNote } from './AnalysisPage'

export type RequestSearch = { flowId?: string; revisionId?: string }

export function RequestAnalysisPage({ search }: { search: RequestSearch }) {
  const navigate = useNavigate()
  const [flows, setFlows] = useState<DashboardFlow[]>([]), [flowId, setFlowId] = useState(search.flowId), [options, setOptions] = useState<AnalysisOptions>()
  const [revisionId, setRevisionId] = useState(search.revisionId), [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false), [error, setError] = useState<string>()
  useEffect(() => { api.dashboard().then(all => setFlows(all.filter(flow => flow.status !== 'draft'))).catch(reason => setError(reason instanceof Error ? reason.message : 'Flows could not load.')) }, [])
  useEffect(() => {
    setOptions(undefined); if (!flowId) return
    analysisApi.options(flowId).then(result => { setOptions(result); setRevisionId(current => result.revisions.some(revision => revision.id === current) ? current : (result.revisions.find(revision => revision.isCurrent) ?? result.revisions[0])?.id) })
      .catch(reason => setError(reason instanceof Error ? reason.message : 'Revisions could not load.'))
  }, [flowId])
  const revision = options?.revisions.find(item => item.id === revisionId)
  // Long text is chosen by default; a short text answer is often a name, so it leaves only when you tick it.
  useEffect(() => { setSelected(revision ? revision.questions.filter(question => question.questionType === 'long_text').map(question => question.id) : []) }, [revision?.id])
  const ready = options?.provider.state === 'on' && revision && revision.completed > 0 && selected.length > 0
  const submit = () => {
    if (!flowId || !revisionId) return
    setBusy(true); setError(undefined)
    analysisApi.request({ flowId, revisionId, questionIds: selected }).then(run => navigate({ to: '/app/analysis/$runId', params: { runId: run.id } }))
      .catch(reason => { setError(reason instanceof Error ? reason.message : 'The analysis could not be requested.'); setBusy(false) })
  }
  return <section aria-labelledby="request-title">
    <header className="page-heading">
      <div className="builder-actions"><Link className="quiet-button focus-ring" to="/app/analysis"><ArrowLeft aria-hidden="true" size={15} /> All analyses</Link></div>
      <p className="eyebrow">Analysis</p><h1 className="display" id="request-title">Request analysis</h1>
    </header>
    {error ? <p className="status-note" data-tone="error" role="alert">{error}</p> : null}
    <div className="analysis-grid">
      <section className="panel analysis-card" aria-labelledby="evidence-heading">
        <p className="eyebrow" id="evidence-heading">Evidence</p>
        <label className="inspector-field">Flow<select className="text-input" value={flowId ?? ''} onChange={event => { setFlowId(event.target.value || undefined); setRevisionId(undefined) }}><option value="">Choose a flow</option>{flows.map(flow => <option key={flow.id} value={flow.id}>{flow.title}</option>)}</select></label>
        <label className="inspector-field">Published revision<select className="text-input" value={revisionId ?? ''} disabled={!options?.revisions.length} onChange={event => setRevisionId(event.target.value || undefined)}>{options?.revisions.map(item => <option key={item.id} value={item.id}>Revision {item.number}{item.isCurrent ? ' · current' : ''} · {item.completed} completed</option>)}</select></label>
        {revision ? <fieldset className="analysis-questions" style={{ border: 0, padding: 0 }}><legend className="muted" style={{ fontSize: '.84rem' }}>Questions to read</legend>
          {revision.questions.length ? revision.questions.map(question => <label key={question.id}><input type="checkbox" checked={selected.includes(question.id)} onChange={event => setSelected(current => event.target.checked ? [...current, question.id] : current.filter(id => id !== question.id))} /> <span>{question.prompt} <span className="muted">({question.questionType.replaceAll('_',' ')})</span></span></label>)
            : <p className="muted">This revision has no text or score question to analyse.</p>}
        </fieldset> : null}
        {revision && !revision.completed ? <p className="status-note" style={{ marginTop: '1rem' }}>This revision has no completed responses yet.</p> : null}
      </section>
      <section className="panel analysis-card" aria-labelledby="leaves-title">
        <p className="eyebrow" id="leaves-title">What leaves Pencil</p>
        {options ? <ProviderNote provider={options.provider} /> : <p className="muted">Choose a flow to see where its answers would go.</p>}
        <div className="analysis-leaves"><p style={{ margin: 0 }}>Only the answers to the questions you tick, and each response’s ID.</p>
          <details><summary className="focus-ring">What stays out</summary><p className="muted" style={{ margin: '.4rem 0 0' }}>Contact, invitation and session identity, email-type answers, unselected answers, network addresses and devices are excluded. Names and emails typed into a selected text answer are sent.</p></details></div>
        <button className="primary-button focus-ring" type="button" style={{ marginTop: '1.2rem' }} disabled={!ready || busy} onClick={submit}><Sparkle aria-hidden="true" size={15} /> {busy ? 'Analysing…' : 'Request analysis'}</button>
      </section>
    </div>
  </section>
}
