import { CollectorComparison } from '../../collectors'
import { TrendsPanel } from './TrendsPanel'
import { NotificationsPanel } from '../../notifications'
import { ArrowLeft, PencilLine } from 'lucide-react'
import { Link, useParams } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { QuestionResults } from './QuestionResults'
import { RevisionComparison } from './RevisionComparison'
import { ResponseLedger } from './ResponseLedger'
import { QuarantineReview } from './QuarantineReview'
import { api, reportingApi, type QuestionReport, type FlowResults } from '../../../app/api'
import { LoadProblem } from '../../../app/ui/LoadProblem'

function percent(value: number) {
  return `${Math.round(value * 100)}%`
}

function duration(milliseconds: number) {
  if (milliseconds < 60000) return `${Math.round(milliseconds / 1000)}s`
  const minutes = Math.round(milliseconds / 60000)
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`
}

export function ResultsPage() {
  const { flowId } = useParams({ from: '/app/flows/$flowId/results' })
  const [results, setResults] = useState<FlowResults>()
  const [comparing, setComparing] = useState(false)
  const [questions, setQuestions] = useState<QuestionReport[]>([])
  const [selectedRevision, setSelectedRevision] = useState<string>()
  const [revisions, setRevisions] = useState<Array<{ id: string; number: number; isCurrent: number }>>([])
  const [timeZone, setTimeZone] = useState<string>()
  const [refresh, setRefresh] = useState(0)
  const [error, setError] = useState<string>()
  const [exportSlot, setExportSlot] = useState<HTMLDivElement | null>(null)

  useEffect(() => {
    let active = true
    setError(undefined)
    setResults(undefined); setQuestions([])
    const metadata = Promise.all([api.workspace(), reportingApi.ledger(flowId, {})])
      .then(([workspace, ledger]) => { if (active) { setTimeZone(workspace.timeZone); setRevisions(ledger.revisions) } })
    const report = api.results(flowId, selectedRevision)
      .then(async (result) => ({ result, questions: await reportingApi.questions(flowId, result.revision.id) }))
      .then((report) => { if (active) { setResults(report.result); setQuestions(report.questions) } })
    Promise.all([metadata, report]).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Results could not load.') })
    return () => { active = false }
  }, [flowId, refresh, selectedRevision])

  const deviceTotal = results ? results.deviceStarts.mobile + results.deviceStarts.tablet + results.deviceStarts.desktop : 0

  return (
    <section className="results" aria-labelledby="results-title">
      <header className="results-heading">
        <div className="results-heading__nav"><Link className="quiet-button focus-ring" to="/app"><ArrowLeft aria-hidden="true" size={16} /> All flows</Link><Link className="secondary-button focus-ring" to="/app/flows/$flowId/builder" params={{ flowId }}><PencilLine aria-hidden="true" size={15} /> Builder</Link></div>
        <Link className="secondary-button focus-ring" to="/app/flows/$flowId/inbox" params={{ flowId }}>Submission inbox</Link>
        <h1 id="results-title" className="display">{results?.flow.title ?? 'Results'}</h1>
        <div className="results-heading__tools">
          <label className="inspector-field">Published revision<select aria-label="Published revision" className="text-input" value={selectedRevision ?? ''} onChange={(event) => setSelectedRevision(event.target.value || undefined)}><option value="">Current published revision</option>{revisions.map((revision) => <option key={revision.id} value={revision.id}>Revision {revision.number}{revision.isCurrent ? ' · current' : ''}</option>)}</select></label>
          <div className="results-heading__exports" ref={setExportSlot} />
        </div>
        {revisions.length > 1 ? <button className="quiet-button focus-ring results-compare" type="button" aria-expanded={comparing} aria-controls="revision-comparison" onClick={() => setComparing(true)}>Compare revisions</button> : null}
      </header>
      {comparing ? <RevisionComparison key={`${flowId}:${refresh}`} flowId={flowId} onClose={() => setComparing(false)} /> : null}
      {error ? <LoadProblem heading="h2" message={error} retryLabel="Retry results" onRetry={() => setRefresh((value) => value + 1)} /> : null}
      {!results && !error ? <p className="status-note">Loading results…</p> : null}
      {results && timeZone && !error && !comparing ? <>
      <QuestionResults questions={questions} flowId={flowId}>
        <article className="panel results-card device-card">
          <p className="eyebrow">Device split</p>
          <h2 className="display">Starts by device class</h2>
          <p className="muted">{deviceTotal} recorded starts</p>
          <div className="device-list">
            {(['mobile', 'tablet', 'desktop'] as const).map((device) => {
              const value = results.deviceStarts[device]
              return <div className="device-row" key={device}><span className="device-name">{device}</span><strong>{value} / {deviceTotal}</strong><span className="device-bar"><span style={{ width: `${deviceTotal === 0 ? 0 : value / deviceTotal * 100}%` }} /></span></div>
            })}
          </div>
        </article>
      </QuestionResults>
      <p><Link className="quiet-button focus-ring" to="/app/actions/new" search={{ flowId, revisionId: results.revision.id }}>Turn these results into an action</Link></p>
      <p className="eyebrow results-metrics-label">Session metrics</p>
      <div className="results-grid">
        <article className="panel metric-card"><span className="muted">Responses</span><strong>{results.completedResponses}</strong><span className="muted">{results.liveCompletedResponses} live · {results.importedResponses} imported</span></article>
        <article className="panel metric-card"><span className="muted">Starts</span><strong>{results.starts}</strong><span className="muted">recorded starts</span></article>
        <article className="panel metric-card"><span className="muted">Completion rate</span><strong>{percent(results.completionRate)}</strong><span className="muted">{results.liveCompletedResponses} live completions / {results.starts} starts</span></article>
        <article className="panel metric-card"><span className="muted">Average time</span><strong>{duration(results.averageCompletionMilliseconds)}</strong><span className="muted">{results.liveCompletedResponses} live completed responses</span></article>
      </div>
      <details className="results-scope"><summary>How we count</summary><p className="muted">Summary scope: revision {results.revision.number}, all its recorded starts and released responses. Imported responses contribute to answers and the ledger; they do not count toward starts, completion rate, average time or devices. Response-only ledger filters below do not change this summary or device split.</p></details>
      <CollectorComparison flowId={flowId} />
      <TrendsPanel key={results.revision.id} flowId={flowId} questions={questions} timeZone={timeZone} revisionId={results.revision.id} />
      <ResponseLedger key={`${results.revision.id}:${refresh}`} flowId={flowId} revisionId={results.revision.id} timeZone={timeZone} questions={questions} onChanged={() => setRefresh((value) => value + 1)} exportSlot={exportSlot} />
      <QuarantineReview key={results.revision.id} revisionId={results.revision.id} timeZone={timeZone} questions={questions} onChanged={() => setRefresh((value) => value + 1)} />
      <div className="results-notifications"><NotificationsPanel flowId={flowId} timeZone={timeZone} /></div>
      </> : null}
    </section>
  )
}
