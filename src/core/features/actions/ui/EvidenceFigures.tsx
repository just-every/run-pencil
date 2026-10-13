import type { EvidenceFigures as Figures } from '../model'

const share = (count: number, of: number) => of ? `${Math.round(count / of * 100)}%` : '0%'

/** Counts with the numerator and denominator they came from (RSLT-003), as they were when the action was saved. */
export function EvidenceFigures({ figures }: { figures: Figures }) {
  return <div>
    <p><strong>{figures.flowTitle}</strong> · revision {figures.revisionNumber}</p>
    <p className="muted">{figures.completedResponses} completed responses · {figures.starts} recorded starts</p>
    {figures.question ? <>
      <p style={{ marginBottom: '.35rem' }}><strong>{figures.question.prompt}</strong></p>
      <p className="muted">{figures.question.answered} answers from {figures.question.reached} sessions that reached this question. {figures.question.countLabel}</p>
      {figures.question.counts.length ? <ul>{figures.question.counts.map(item => <li key={item.label}>{item.label}: {item.count} of {item.of} answers · {share(item.count, item.of)}</li>)}</ul> : <p className="muted">This question type has no counts to copy; the answer total is kept.</p>}
    </> : null}
  </div>
}
