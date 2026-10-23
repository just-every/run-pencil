import { ResultMetrics } from './ResultMetrics'
import { DeviceSplit } from './DeviceSplit'
import type { DeviceReport } from '../../reporting'
import { TrafficPanel } from './TrafficPanel'
import { CollectorComparison } from '../../collectors'
import { TrendsPanel } from './TrendsPanel'
import { CrosstabPanel } from './CrosstabPanel'
import { NotificationsPanel } from '../../notifications'
import { ArrowLeft, PencilLine } from 'lucide-react'
import { Link, useParams } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { QuestionResults } from './QuestionResults'
import { RevisionComparison } from './RevisionComparison'
import { ResponseLedger } from './ResponseLedger'
import { QuarantineReview } from './QuarantineReview'
import { api, reportingApi, type QuestionReport, type FlowResults, type LedgerFilter, type Ledger } from '../../../app/api'
import { LoadProblem } from '../../../app/ui/LoadProblem'

export function ResultsPage() {
  const { flowId } = useParams({ from: '/app/flows/$flowId/results' })
  const [results, setResults] = useState<FlowResults>()
  const [comparing, setComparing] = useState(false)
  const [questions, setQuestions] = useState<QuestionReport[]>([])
  const [responseFilter, setResponseFilter] = useState<LedgerFilter>({})
  const [devices, setDevices] = useState<DeviceReport>()
  const [selectedRevision, setSelectedRevision] = useState<string>()
  const [revisions, setRevisions] = useState<Ledger['revisions']>([])
  const [timeZone, setTimeZone] = useState<string>()
  const [refresh, setRefresh] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [exportSlot, setExportSlot] = useState<HTMLDivElement | null>(null)

  const selectionKey = JSON.stringify({...responseFilter,offset:undefined})
  useEffect(() => {
    let active = true
    void Promise.all([api.workspace(), reportingApi.ledger(flowId,{})]).then(([workspace,ledger])=>{if(active){setTimeZone(workspace.timeZone);setRevisions(ledger.revisions)}}).catch(reason=>{if(active)setError(reason instanceof Error?reason.message:'Results metadata could not load.')})
    return ()=>{active=false}
  },[flowId,refresh])
  useEffect(() => {
    let active = true
    setError(undefined); setBusy(true)
    const all = selectedRevision === 'all'
    void api.results(flowId,all?undefined:selectedRevision,responseFilter,all)
      .then(async result=>({result,questions:await reportingApi.questions(flowId,all?undefined:result.revision.id,responseFilter)}))
      .then(report=>{if(active){setResults(report.result);setQuestions(report.questions)}})
      .catch(reason=>{if(active)setError(reason instanceof Error?reason.message:'Results could not load.')})
      .finally(()=>{if(active)setBusy(false)})
    return ()=>{active=false}
  },[flowId,refresh,selectedRevision,selectionKey])

  const filter = useMemo(() => ({ ...responseFilter, revisionId: selectedRevision === 'all' ? undefined : selectedRevision ?? results?.revision.id }),[responseFilter,selectedRevision,results?.revision.id])
  const filterKey = JSON.stringify({ ...filter, offset: undefined })
  useEffect(() => {
    if (!results) return
    let active = true; setDevices(undefined)
    void reportingApi.devices(flowId, filter).then(report => { if (active) setDevices(report) }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Device counts could not load.') })
    return () => { active = false }
  }, [flowId, filterKey, refresh, results?.revision.id])

  return (
    <section className="results" aria-labelledby="results-title" aria-busy={busy}>
      <header className="results-heading">
        <div className="results-heading__nav"><Link className="quiet-button focus-ring" to="/app"><ArrowLeft aria-hidden="true" size={16} /> All flows</Link><Link className="secondary-button focus-ring" to="/app/flows/$flowId/builder" params={{ flowId }}><PencilLine aria-hidden="true" size={15} /> Builder</Link></div>
        <Link className="secondary-button focus-ring" to="/app/flows/$flowId/inbox" params={{ flowId }}>Submission inbox</Link>
        <h1 id="results-title" className="display">{results?.flow.title ?? 'Results'}</h1>
        <div className="results-heading__tools">
          <label className="inspector-field">Published revision<select aria-label="Published revision" className="text-input" value={selectedRevision ?? ''} onChange={(event) => setSelectedRevision(event.target.value || undefined)}><option value="">Current published revision</option><option value="all">All published revisions</option>{revisions.map((revision) => <option key={revision.id} value={revision.id}>Revision {revision.number}{revision.isCurrent ? ' · current' : ''}</option>)}</select></label>
          <div className="results-heading__exports" ref={setExportSlot} />
        </div>
        {revisions.length > 1 ? <button className="quiet-button focus-ring results-compare" type="button" aria-expanded={comparing} aria-controls="revision-comparison" onClick={() => setComparing(true)}>Compare revisions</button> : null}
      </header>
      {comparing ? <RevisionComparison key={`${flowId}:${refresh}`} flowId={flowId} onClose={() => setComparing(false)} /> : null}
      {error ? <LoadProblem heading="h2" message={error} retryLabel="Retry results" onRetry={() => setRefresh((value) => value + 1)} /> : null}
      {!results && !error ? <p className="status-note">Loading results…</p> : null}
      {results && timeZone && !comparing ? <>
      {busy ? <p role="status">Updating the combined results selection…</p> : null}
      {!busy && !error ? <>
      <QuestionResults questions={questions} flowId={flowId} filter={filter} revisions={selectedRevision === 'all' ? revisions : undefined}>
        {devices ? <DeviceSplit report={devices} /> : <p role="status">Loading device split…</p>}
      </QuestionResults>
      <p><Link className="quiet-button focus-ring" to="/app/actions/new" search={{ flowId, revisionId: results.revision.id }}>Turn these results into an action</Link></p>
      <ResultMetrics results={results} />
      </> : null}
      <p className="muted">Traffic panel: revision {results.revision.number}. Its view-based rates are unfiltered by response filters.</p>
      <TrafficPanel key={`traffic:${results.revision.id}`} flowId={flowId} revisionId={results.revision.id} />
      <CollectorComparison flowId={flowId} />
      {revisions.find(revision => revision.id === results.revision.id) ? <CrosstabPanel key={`crosstab:${results.revision.id}`} flowId={flowId} revision={revisions.find(revision => revision.id === results.revision.id)!} questions={questions.filter(question=>question.revisionId===results.revision.id)} /> : null}
      <TrendsPanel key={`trends:${results.revision.id}`} flowId={flowId} questions={questions.filter(question=>question.revisionId===results.revision.id)} timeZone={timeZone} revisionId={results.revision.id} />
      <ResponseLedger key={`${results.revision.id}:${refresh}`} flowId={flowId} timeZone={timeZone} questions={questions} filter={filter} onFilterChange={setResponseFilter} onChanged={() => setRefresh((value) => value + 1)} exportSlot={exportSlot} />
      <QuarantineReview key={`quarantine:${results.revision.id}`} revisionId={results.revision.id} timeZone={timeZone} questions={questions} onChanged={() => setRefresh((value) => value + 1)} />
      <div className="results-notifications"><NotificationsPanel flowId={flowId} timeZone={timeZone} /></div>
      </> : null}
    </section>
  )
}
