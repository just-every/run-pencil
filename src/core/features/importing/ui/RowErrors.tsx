import { useState } from 'react'
import { errorPageForRow } from '../row-error-search'
import type { RowError } from '../model'

export function RowErrors({ errors }: { errors: RowError[] }) {
  const [page, setPage] = useState(0), pageSize = 100
  const [row, setRow] = useState(''), [searchMessage, setSearchMessage] = useState('')
  if (!errors.length) return null
  const start = Math.min(page, Math.ceil(errors.length / pageSize) - 1) * pageSize, end = Math.min(start + pageSize, errors.length)
  return <section aria-labelledby="row-errors" style={{ overflowWrap: 'anywhere' }}>
    <h3 id="row-errors">Every row error ({errors.length})</h3>
    <p>Correct these values or column mappings before importing. No rows are silently skipped.</p>
    <p role="status">Showing errors {start + 1}–{end} of {errors.length}</p>
    <div className="builder-actions">
      <label htmlFor="find-error-row">Find row <input id="find-error-row" type="number" min="1" step="1" value={row} onChange={event => { setRow(event.target.value); setSearchMessage('') }} style={{ width: '8rem', maxWidth: '100%' }} /></label>
      <button className="quiet-button focus-ring" type="button" onClick={() => {
        const next = errorPageForRow(errors, Number(row))
        if (next === undefined) setSearchMessage('No errors for that row. Enter an original CSV row number.')
        else { setPage(next); setSearchMessage(`Showing the page containing row ${row}.`) }
      }}>Find errors</button>
    </div>
    <p role="status">{searchMessage}</p>
    <ul>{errors.slice(start, end).map((error, index) => <li key={start + index}>Row {error.row}, {error.column}: {error.message}</li>)}</ul>
    {errors.length > pageSize ? <div className="builder-actions">
      <button className="quiet-button focus-ring" type="button" disabled={start === 0} onClick={() => setPage(0)}>First errors</button>
      <button className="quiet-button focus-ring" type="button" disabled={start === 0} onClick={() => setPage(page => Math.max(0, page - 1))}>Previous errors</button>
      <button className="quiet-button focus-ring" type="button" disabled={end === errors.length} onClick={() => setPage(page => page + 1)}>Next errors</button>
      <button className="quiet-button focus-ring" type="button" disabled={end === errors.length} onClick={() => setPage(Math.ceil(errors.length / pageSize) - 1)}>Last errors</button>
    </div> : null}
  </section>
}
