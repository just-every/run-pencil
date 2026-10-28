import { useEffect, useState } from 'react'
import { reportRequest } from './savedReportApi'
import type { SavedViewDefinition } from '../../reporting'

export function ReportCodeCrossing({ onAdd }: { onAdd: (cross: SavedViewDefinition['crosstabs'][number]) => void }) {
  const [codes, setCodes] = useState<Array<{ id: string; label: string }>>([]), [row, setRow] = useState(''), [column, setColumn] = useState(''), [error, setError] = useState('')
  useEffect(() => {
    let active = true
    void (async () => {
      const entries: Array<{ id: string; label: string }> = []
      let after: string | null = null
      do { const result: { codes: Array<{ id: string; label: string }>; nextAfter: string | null } = await reportRequest('/api/app/codes' + (after ? `?after=${after}` : '')); entries.push(...result.codes); after = result.nextAfter } while (after)
      if (active) setCodes(entries)
    })().catch(reason => { if (active) setError(reason.message) })
    return () => { active = false }
  }, [])
  if (!codes.length && !error) return null
  const select = (label: string, value: string, change: (value: string) => void) => <label className="inspector-field">{label}<select className="text-input" value={value} onChange={event => change(event.target.value)}><option value="">Choose a code</option>{codes.map(code => <option key={code.id} value={code.id}>{code.label}</option>)}</select></label>
  return <details><summary>Add a code crosstab</summary><div className="report-form">{select('Row code', row, setRow)}{select('Column code', column, setColumn)}<button type="button" className="quiet-button focus-ring" disabled={!row || !column || row === column} onClick={() => onAdd({ id: crypto.randomUUID(), rows: `code:${row}`, columns: `code:${column}` })}>Include code crosstab</button></div>{error ? <p role="alert">{error}</p> : null}</details>
}
