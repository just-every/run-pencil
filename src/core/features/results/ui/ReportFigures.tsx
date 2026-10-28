import type { SharedReport } from '../../reporting/savedModel'
import type { Crosstab } from '../../reporting'
import './saved-reports.css'

function CrossFigures({ table }: { table: Crosstab }) {
  const total = (value: Crosstab['total']) => value.withheld ? 'withheld' : value.count
  return <><div className="crosstab-scroll" role="region" aria-label="Saved crosstab table" tabIndex={0}><table className="crosstab-table">
    <caption>{table.rowDimension.label} by {table.columnDimension.label}</caption>
    <thead><tr><th scope="col">{table.rowDimension.label}</th>{table.columns.map(column => <th key={column.key} scope="col">{column.label}</th>)}<th scope="col">Row total</th></tr></thead>
    <tbody>{table.rows.map((row, i) => <tr key={row.key}><th scope="row">{row.label}</th>{table.cells[i].map((cell, j) => <td key={j}>{cell.suppressed ? 'suppressed' : <><strong>{cell.count}</strong><span className="crosstab-share">Row {cell.rowShare ? `${cell.rowShare.numerator} of ${cell.rowShare.denominator}` : 'withheld'}</span><span className="crosstab-share">Column {cell.columnShare ? `${cell.columnShare.numerator} of ${cell.columnShare.denominator}` : 'withheld'}</span></>}</td>)}<td>{total(table.rowTotals[i])}</td></tr>)}</tbody>
    <tfoot><tr><th scope="row">Column total</th>{table.columnTotals.map((value, j) => <td key={j}>{total(value)}</td>)}<td>{total(table.total)}</td></tr></tfoot>
  </table></div><p>{table.chiSquare.offered && !table.chiSquare.withheld ? `Chi-square ${table.chiSquare.statistic.toFixed(3)}. ${table.chiSquare.reason}` : table.chiSquare.reason}</p>{table.notes.map(note => <p className="muted" key={note}>{note}</p>)}</>
}
export function ReportFigures({ report }: { report: SharedReport }) {
  return <article className="saved-report" aria-label={`Report: ${report.name}`}>
    <h2 className="display">{report.name}</h2>
    <p className="report-provenance">Evidence cutoff <time>{report.cutoff}</time> · Disclosure threshold {report.threshold}</p>
    {report.cohorts.map(cohort => <section className="report-cohort" key={cohort.id} aria-label={cohort.name}>
      <h3>{cohort.name}</h3><p className="report-response-count">Responses <strong>{cohort.responseCount}</strong></p>
      {cohort.breakdownWithheld ? <p role="note">{cohort.reason}</p> : <>
        <div className="report-charts">{cohort.questions.filter(question => !report.charts.length || report.charts.includes(question.id)).map(question => <section className="report-question" key={question.id} aria-label={question.prompt}>
          <h4>{question.prompt}</h4><p>{question.answered} answers · {question.unanswered} unanswered</p>
          {question.multipleSelect ? <p>Multiple select; shares may total more than 100%.</p> : null}
          {question.distribution.map((bucket, index) => <div className="report-bucket" key={index}><span>{bucket.label}</span><strong>{bucket.count} of {question.answered} answers</strong><div className="device-bar"><span style={{ width: `${question.answered ? bucket.count / question.answered * 100 : 0}%` }} /></div></div>)}
          {question.note ? <p>{question.note}</p> : null}
        </section>)}</div>
        {cohort.crosstabs.map(cross => <section className="report-cross" key={cross.id} aria-label="Saved crosstab">{cross.withheld ? <p role="note">{cross.reason}</p> : <CrossFigures table={cross.table} />}</section>)}
      </>}
    </section>)}
    <details className="report-boundary"><summary>About this report’s protection</summary><p>{report.protectionNotice}</p></details>
  </article>
}
