import type { MatrixRowSummary } from '../../reporting/matrixReport'
export const answerCount = (value: number) => `${value} ${value === 1 ? 'answer' : 'answers'}`

export function MatrixEvidence({ rows }: { rows: MatrixRowSummary[] }) {
  return rows.map(row => <section key={row.id} aria-label={row.label}>
    <h4>{row.label}</h4>
    <p className="muted answer-scope">{answerCount(row.answered)} to this row. {row.multipleSelect ? 'Multiple select; shares may total more than 100%.' : 'One answer per response.'}</p>
    {row.distribution.map(bucket => <div className="answer-bucket" key={bucket.value}>
      <div className="answer-bucket__label"><span className="answer-chip">{bucket.label}</span><strong>{bucket.count} of {answerCount(row.answered)} · {row.answered ? `${Math.round(bucket.count / row.answered * 100)}%` : 'No rate'}</strong></div>
      <div className="device-bar" style={{ width: '100%' }}><span style={{ width: `${row.answered ? bucket.count / row.answered * 100 : 0}%` }} /></div>
    </div>)}
  </section>)
}
