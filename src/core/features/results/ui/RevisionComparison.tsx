import { StepSessionMetrics } from './StepSessionMetrics'
import { useEffect, useState } from 'react'
import { reportingApi, type RevisionComparison as Comparison } from '../../../app/api'

export function RevisionComparison({ flowId, onClose }: { flowId: string; onClose: () => void }) {
  const [report, setReport] = useState<Comparison>()
  const [error, setError] = useState<string>()
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true
    setReport(undefined); setError(undefined)
    void reportingApi.compareRevisions(flowId).then(value => { if (active) setReport(value) })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Revision comparison could not load.') })
    return () => { active = false }
  }, [flowId, retry])
  return <section id="revision-comparison" className="panel" style={{ padding: '1.25rem', marginBottom: '1.5rem' }} aria-labelledby="comparison-title">
    <header className="toggle-row"><h2 id="comparison-title" className="display">Compare revisions</h2><button className="quiet-button focus-ring" onClick={onClose} type="button">Close comparison</button></header>
    <p className="muted">Each revision keeps its own questions, labels and answer counts. Questions that were absent are never counted as unanswered.</p>
    {!report && !error ? <p className="status-note" role="status">Loading revision comparison…</p> : null}
    {error ? <div className="status-note" data-tone="error" role="alert"><p>{error}</p><button className="secondary-button focus-ring" type="button" onClick={() => setRetry(value => value + 1)}>Retry comparison</button></div> : null}
    {report?.revisions.length === 0 ? <p>No published revisions to compare.</p> : null}
    {report?.questions.map(question => <article className="quiet-panel" key={question.id} style={{ marginTop: '1rem', padding: '1rem' }} aria-label={`Question comparison: ${question.versions[0].prompt}`}>
      <h3>{question.versions[0].prompt}</h3>
      <p className="muted">{question.eligibleResponses ? Math.round(question.answered / question.eligibleResponses * 100) : 0}% answered · {question.answered} / {question.eligibleResponses} released responses from revisions containing this question</p>
      <details><summary className="muted">Question identity</summary><p className="muted">{question.id}</p></details>
      <div className="results-grid" style={{ marginTop: '.75rem' }}>{report.revisions.map(revision => {
        const version = question.versions.find(value => value.revisionId === revision.id)
        return <section key={revision.id} className="quiet-panel" style={{ padding: '1rem' }} aria-label={`Revision ${revision.number}: ${version?.prompt ?? 'question absent'}`}>
          <h4>Revision {revision.number}{revision.isCurrent ? ' · current' : ''}</h4>
          {version ? <><p>{version.prompt}</p><p className="muted">{version.answered} answered / {version.eligibleResponses} released responses in this revision</p><StepSessionMetrics reached={version.reached} dropped={version.dropped} answered={version.answered} />
            {version.distribution.length ? <><p className="muted">{version.distributionLabel}</p>{version.distribution.map(bucket => <p key={String(bucket.value)}>{bucket.label}: <strong>{version.answered ? Math.round(bucket.count / version.answered * 100) : 0}% · {bucket.count} / {version.answered} answers</strong></p>)}</> : <p className="muted">Individual answers remain in this revision's response ledger.</p>}
          </> : <p className="muted">Not in this revision</p>}
        </section>
      })}</div>
    </article>)}
  </section>
}
