import { useEffect, useState, type FormEvent } from 'react'
import { reportingApi, type Ledger, type QuestionReport } from '../../../app/api'
import type { Crosstab } from '../../reporting'
import './crosstab.css'

type CollectorOption = { id: string; name: string }
const crossable = ['single_choice', 'dropdown', 'multiple_choice', 'priority', 'yes_no', 'consent', 'thumbs_rating', 'rating', 'nps', 'csat', 'ces', 'emoji_rating', 'number', 'date']
const percent = (value: number) => `${value.toFixed(1)}%`

/** RSLT-006: two dimensions of one revision, with stated shares, ANLY-005 suppression and a chi-square. */
export function CrosstabPanel({ flowId, revision, questions }: { flowId: string; revision: Ledger['revisions'][number]; questions: QuestionReport[] }) {
  const dimensions = [
    ...questions.filter(question => crossable.includes(question.questionType ?? '')).map(question => ({ key: `question:${question.id}`, label: question.prompt })),
    ...revision.hiddenFields.map(field => ({ key: `hidden:${field.id}`, label: `Hidden field ${field.name}` })),
    ...revision.calculations.map(calculation => ({ key: `variable:${calculation.id}`, label: `Calculated ${calculation.name}` })),
    { key: 'collector', label: 'Collector' },
  ]
  const [rows, setRows] = useState(dimensions[0]?.key ?? ''), [columns, setColumns] = useState(dimensions[1]?.key ?? '')
  const [collectorId, setCollectorId] = useState(''), [collectors, setCollectors] = useState<CollectorOption[]>([])
  const [table, setTable] = useState<Crosstab>(), [error, setError] = useState<string>(), [busy, setBusy] = useState(false)
  useEffect(() => { void fetch(`/api/app/flows/${flowId}/collectors`).then(response => response.ok ? response.json() as Promise<CollectorOption[]> : []).then(setCollectors) }, [flowId])
  const load = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(undefined); setTable(undefined)
    try { setTable(await reportingApi.crosstab(flowId, { revisionId: revision.id, rows, columns, ...(collectorId ? { collectorId } : {}) })) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The crosstab could not load.') } finally { setBusy(false) }
  }
  const select = (label: string, value: string, change: (value: string) => void) => <label className="inspector-field">{label}<select className="text-input" value={value} onChange={event => change(event.target.value)}>{dimensions.map(dimension => <option key={dimension.key} value={dimension.key}>{dimension.label}</option>)}</select></label>
  const total = (value: Crosstab['total']) => value.withheld ? <span className="crosstab-withheld">withheld</span> : value.count
  return <section className="panel results-card crosstab" aria-labelledby="crosstab-title">
    <p className="eyebrow">Crosstab</p>
    <h2 id="crosstab-title" className="display">Cross two answers</h2>
    <p className="muted">Released responses of revision {revision.number} only. Each count is responses; a share names its numerator and denominator.</p>
    <form className="crosstab-form" onSubmit={load}>
      {select('Rows', rows, setRows)}{select('Columns', columns, setColumns)}
      <label className="inspector-field">Filter by collector<select className="text-input" value={collectorId} onChange={event => setCollectorId(event.target.value)}><option value="">All collectors</option>{collectors.map(collector => <option key={collector.id} value={collector.id}>{collector.name}</option>)}</select></label>
      <button className="primary-button focus-ring" type="submit" disabled={busy || !rows || !columns}>Cross</button>
    </form>
    {error ? <p className="status-note" data-tone="error" role="alert">{error}</p> : null}
    {table ? <>
      {table.rowDimension.multipleSelect || table.columnDimension.multipleSelect ? <p className="crosstab-label">Multiple select</p> : null}
      <p className="crosstab-cutoff">Evidence cutoff {table.cutoff}</p>
      <div className="crosstab-scroll" role="region" aria-label="Crosstab table" tabIndex={0}>
        <table className="crosstab-table">
          <caption>{table.rowDimension.label} by {table.columnDimension.label}</caption>
          <thead><tr><th scope="col">{table.rowDimension.label}</th>{table.columns.map(column => <th scope="col" key={column.key}>{column.label}</th>)}<th scope="col">Row total</th></tr></thead>
          <tbody>
            {table.rows.map((row, i) => <tr key={row.key}><th scope="row">{row.label}</th>{table.cells[i].map((cell, j) => <td key={table.columns[j].key}>{cell.suppressed ? <span className="crosstab-withheld">suppressed</span> : <>
              <strong>{cell.count}</strong>
              <span className="crosstab-share">Row {cell.rowShare ? `${cell.rowShare.numerator} / ${cell.rowShare.denominator} · ${percent(cell.rowShare.percentage)}` : 'withheld'}</span>
              <span className="crosstab-share">Column {cell.columnShare ? `${cell.columnShare.numerator} / ${cell.columnShare.denominator} · ${percent(cell.columnShare.percentage)}` : 'withheld'}</span>
            </>}</td>)}<td>{total(table.rowTotals[i])}</td></tr>)}
          </tbody>
          <tfoot><tr><th scope="row">Column total</th>{table.columnTotals.map((value, j) => <td key={table.columns[j].key}>{total(value)}</td>)}<td>{total(table.total)}</td></tr></tfoot>
        </table>
      </div>
      <p className="crosstab-test">{table.chiSquare.offered && !table.chiSquare.withheld ? <>Chi-square {table.chiSquare.statistic.toFixed(3)}, {table.chiSquare.degreesOfFreedom} degrees of freedom, p = {table.chiSquare.pValue.toFixed(4)}. {table.chiSquare.flagged ? 'Flagged: ' : ''}{table.chiSquare.reason}</> : table.chiSquare.reason}</p>
      <ul className="crosstab-notes">{table.notes.map(note => <li key={note}>{note}</li>)}<li>Cells with fewer than {table.threshold} responses are suppressed under {table.policy}.</li></ul>
    </> : null}
  </section>
}
