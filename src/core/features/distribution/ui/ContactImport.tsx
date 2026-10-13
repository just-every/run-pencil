import { csvRows } from '../../importing'
import { useMemo, useState } from 'react'
import { audienceRequest, contactsPath, type ImportReport } from './audienceApi'
export function ContactImport({ changed }: { changed: () => Promise<void> }) {
  const [csv, setCsv] = useState(''), [updateMatches, setUpdateMatches] = useState(false)
  const [report, setReport] = useState<ImportReport>(), [busy, setBusy] = useState(false), [error, setError] = useState<string>()
  const uploadedRows = useMemo(() => new Map([...csvRows(csv)].map(row => [row.row, row.cells])), [csv])
  const run = async (commit: boolean) => {
    setBusy(true); setError(undefined)
    try { setReport(await audienceRequest<ImportReport>(`${contactsPath}/import`, { csv, updateMatches, commit })); if (commit) await changed() }
    catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  return <section className="panel" style={{ padding: '1.25rem', minWidth: 0 }} aria-labelledby="contact-import-title">
    <h2 id="contact-import-title">Import contacts</h2><p>CSV headers: name, email, then custom field keys. Up to 5,000 rows and 2 MiB. Preview changes before importing. The file is not retained.</p>
    {error ? <p role="alert" className="status-note" data-tone="error">{error}</p> : null}
    <label className="inspector-field">Contact CSV file<input className="text-input" type="file" accept=".csv,text/csv" disabled={busy} onChange={e => { const file = e.target.files?.[0]; if (!file) return; setError(undefined); setReport(undefined); if (file.size > 2 * 1024 * 1024) { setError('Choose a CSV no larger than 2 MiB.'); return } void file.text().then(setCsv).catch(() => setError('The selected file could not be read.')) }} /></label>
    <label className="inspector-field">Uploaded CSV<textarea className="text-area" value={csv} disabled={busy} onChange={e => { setCsv(e.target.value); setReport(undefined) }} /></label>
    <label><input type="checkbox" disabled={busy} checked={updateMatches} onChange={e => { setUpdateMatches(e.target.checked); setReport(undefined) }} /> Update matching contacts' name and fields</label>
    <p><button className="secondary-button focus-ring" type="button" disabled={busy || !csv} onClick={() => void run(false)}>Preview contact import</button>{' '}
    <button className="primary-button focus-ring" type="button" disabled={busy || !report || report.committed} onClick={() => void run(true)}>Import reviewed contacts</button></p>
    {report ? <div><p role="status" className="status-note">{report.committed ? 'Import complete' : 'Import preview'}: {report.counts.added} added · {report.counts.matched} matched · {report.counts.updated} updated · {report.counts.invalid} invalid · {report.counts.overLimit} over limits</p>
      <p>Rows refer to the uploaded CSV above. Matches show only the match kind; saved contact values are never included in this report.</p>
      <ol aria-label="Contact import row report">{report.rows.map(row => <li key={row.row} style={{ overflowWrap: 'anywhere' }}>Row {row.row}: {row.status}{row.match ? ` (${row.match})` : ''}{row.message ? ` — ${row.message}` : ''}<p>Uploaded values: {uploadedRows.get(row.row)?.join(' · ')}</p></li>)}</ol>
    </div> : null}
  </section>
}
