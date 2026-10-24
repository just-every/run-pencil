import { AnswerEvidence } from './AnswerEvidence'
import { useEffect, useRef, useState } from 'react'
import { reportingApi, type RevisionComparison as Comparison } from '../../../app/api'

export function RevisionComparison({ flowId, onClose }: { flowId: string; onClose: () => void }) {
  const [report, setReport] = useState<Comparison>()
  const [error, setError] = useState<string>()
  const [retry, setRetry] = useState(0)
  const [offset,setOffset] = useState(0)
  const previous = useRef<number[]>([])
  useEffect(() => {
    let active = true
    setReport(undefined); setError(undefined)
    void (offset ? reportingApi.compareRevisions(flowId,offset) : reportingApi.compareRevisions(flowId)).then(value => { if (active) setReport(value) })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Revision comparison could not load.') })
    return () => { active = false }
  }, [flowId, retry, offset])
  return <section id="revision-comparison" className="panel results-card" aria-labelledby="comparison-title">
    <header className="toggle-row"><h2 id="comparison-title" className="display">Compare revisions</h2><button className="quiet-button focus-ring" onClick={onClose} type="button">Back to results</button></header>
    <p className="muted">Each revision keeps its own questions, labels and answer counts. Questions that were absent are never counted as unanswered.</p>
    {!report && !error ? <p className="status-note" aria-busy="true">Loading revision comparison…</p> : null}
    {error ? <div className="status-note" data-tone="error" role="alert"><p>{error}</p><button className="secondary-button focus-ring" type="button" onClick={() => setRetry(value => value + 1)}>Retry comparison</button></div> : null}
    {report && (report.nextOffset !== undefined || offset > 0) ? <div className="builder-actions"><p className="muted">Comparing revisions {offset+1}–{offset+report.revisions.length} of {report.revisionCount}, latest first. Counts below use the revisions shown.</p><button className="quiet-button focus-ring" type="button" style={{minHeight:44}} disabled={!previous.current.length} onClick={()=>setOffset(previous.current.pop() ?? 0)}>Previous revisions</button><button className="quiet-button focus-ring" type="button" style={{minHeight:44}} disabled={report.nextOffset === undefined} onClick={()=>{previous.current.push(offset);setOffset(report.nextOffset!)}}>Next revisions</button></div> : null}
    {report?.revisions.length === 0 ? <p>No published revisions to compare.</p> : null}
    {report?.questions.map(question => <article className="quiet-panel" key={question.id} style={{ marginTop: '1rem', padding: '1rem' }} aria-label={`Question comparison: ${question.versions[0].prompt}`}>
      <h3>{question.versions[0].prompt}</h3>
      <p className="muted">{question.eligibleResponses ? `${Math.round(question.answered / question.eligibleResponses * 100)}%` : 'No rate'} answered · {question.answered} / {question.eligibleResponses} released responses from revisions containing this question</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 20rem), 1fr))', gap: '1rem', marginTop: '.75rem' }}>{report.revisions.map(revision => {
        const version = question.versions.find(value => value.revisionId === revision.id)
        return <section key={revision.id} className="quiet-panel" style={{ padding: '1rem' }} aria-label={`Revision ${revision.number}: ${version?.prompt ?? 'question absent'}`}>
          <h4>Revision {revision.number}{revision.isCurrent ? ' · current' : ''}</h4>
          {version ? <><p>{version.prompt}</p><p className="muted">{version.answered} answered / {version.eligibleResponses} released responses in this revision</p><AnswerEvidence question={version} flowId={flowId} />
          </> : <p className="muted">Not in this revision</p>}
        </section>
      })}</div>
    </article>)}
  </section>
}
