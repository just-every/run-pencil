import { Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { importsApi, type Job } from './api'
import type { ColumnMapping, ImportReview, ImportSource, GoogleSettings } from '../model'
import { useImportProgress } from './useImportProgress'
import { ReviewReport } from './ReviewReport'
import { GoogleOptions, GoogleQuestions } from './GoogleOptions'
import { ImportFileHelp } from './ImportFileHelp'
import { TypeformConnection } from './TypeformConnection'
const preparation = (job: Job) => job.state === 'preparing' || job.state === 'preparation-interrupted'
const progressLabel = (job: Job) => job.state === 'preparing' ? 'Ready to verify' : job.state === 'preparation-interrupted' ? 'Preparation needs attention' : job.state === 'cancelled' ? 'Preparation cancelled' : job.state
export function ImportPage() {
  const [source, setSource] = useState<ImportSource>('typeform'), [google, setGoogle] = useState<GoogleSettings>({})
  const settingsChanged = (next: GoogleSettings) => { setGoogle(next); setDirty(true); setAcknowledged(false) }
  const [definition, setDefinition] = useState(''), [csv, setCsv] = useState(''), [responses, setResponses] = useState(''), [columns, setColumns] = useState<ColumnMapping[]>([])
  const [responseFormat, setResponseFormat] = useState<'csv' | 'json'>('csv')
  const [review, setReview] = useState<ImportReview>(), [acknowledged, setAcknowledged] = useState(false), [dirty, setDirty] = useState(false)
  const [fileVersion, setFileVersion] = useState(0)
  const [loadedTitle, setLoadedTitle] = useState('')
  const [pendingCustody, setPendingCustody] = useState<string>()
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [jobs, setJobs] = useState<Job[]>([])
  const progress = useImportProgress(job => { setJobs(current => current.some(j => j.id === job.id) ? current.map(j => j.id === job.id ? job : j) : [...current, job]); setReview(current => current?.jobId === job.id ? { ...current, jobState: job.state, alreadyImported: job.state === 'completed' } : current) })
  const refresh = async () => { const next = await importsApi.list(); setJobs(next); setReview(current => current?.jobId ? { ...current, alreadyImported: next.some(job => job.id === current.jobId && job.state === 'completed'), jobState: next.find(job => job.id === current.jobId)?.state } : current) }
  useEffect(() => { void refresh().catch(e => setError(e.message)) }, [])
  const run = async (action: () => Promise<void>) => { setBusy(true); setError(''); try { await action() } catch (e) { setError((e as Error).message) } finally { setBusy(false) } }
  const reset = () => { setDefinition(''); setLoadedTitle(''); setCsv(''); setResponses(''); setResponseFormat('csv'); setColumns([]); setReview(undefined); setAcknowledged(false); setDirty(false); setError(''); setFileVersion(v => v + 1) }
  const showPublication = (job: Job, previousId = review?.jobId) => {
    if (previousId && previousId !== job.id) setJobs(current => current.filter(item => item.id !== previousId))
    progress.pause(); progress.show(job)
    setReview(current => current ? { ...current, jobId: job.id, jobState: job.state, alreadyImported: job.state === 'completed' } : current)
    setError('Preparation was verified before cancellation. Inspect its progress and use Undo import to remove imported records.')
  }
  const cancelPending = async () => {
    if (!pendingCustody) return true
    const result = await importsApi.cancelStaging(pendingCustody)
    setPendingCustody(undefined)
    if (!result.cancelled) { showPublication(result.job); return false }
    return true
  }
  const cancel = () => run(async () => { if (await cancelPending()) reset() })
  const read = async (input: HTMLInputElement, kind: 'definition' | 'csv' | 'responses') => {
    const file = input.files?.[0]
    if (!file) return
    if (!await cancelPending()) {
      input.value = ''
      setError(current => `${current} The new file was not accepted; the current report still describes your previous files.`)
      return
    }
    if (file.size > 8 * 1024 * 1024) throw new Error('File exceeds the 8 MiB upload limit.')
    const value = await file.text()
    if (kind === 'definition') { setDefinition(value); setLoadedTitle('') } else if (kind === 'csv') { setCsv(value); setResponses('') } else { setResponses(value); setCsv('') }
    setColumns([]); setReview(undefined); setAcknowledged(false)
  }
  const loadTypeform = async (form: string, token: string) => {
    setBusy(true); setError('')
    try {
      if (!await cancelPending()) throw new Error('Inspect the existing import’s progress before replacing its definition.')
      const result = await importsApi.typeformDefinition(form, token)
      setDefinition(result.definition); setLoadedTitle(result.title)
      setColumns([]); setReview(undefined); setAcknowledged(false); setDirty(false)
    } finally { setBusy(false) }
  }
  const plan = () => run(async () => { if (!await cancelPending()) return; const next = await importsApi.review({ definition, csv, ...(responses ? { responses } : {}), source, ...(source === 'google-forms' ? { google } : {}), ...(columns.length ? { columns } : {}) }); setReview(next); setPendingCustody(next.pendingCustody); setColumns(next.columns); setDirty(false); setAcknowledged(false) })
  const commit = () => run(async () => {
    if (!review || !acknowledged || dirty) return
    setPendingCustody(review.fingerprint)
    const job = await importsApi.commit({ definition, csv, ...(responses ? { responses } : {}), source, ...(source === 'google-forms' ? { google } : {}), columns, plannedAt: review.plannedAt }, review.fingerprint)
    setPendingCustody(undefined)
    setReview({ ...review, jobId: job.id, jobState: job.state, alreadyImported: job.state === 'completed' })
    if (preparation(job)) { progress.pause(); progress.show(job) }
    else await progress.follow(job)
  })
  return <section className="import-page" aria-labelledby="import-heading">
    <Link className="quiet-button focus-ring" to="/app">← Your flows</Link>
    <h1 className="display" id="import-heading">Import a form</h1>
    <p>Bring an existing form into Pencil as an editable draft. Add historical answers in CSV, or upload response JSON with its form definition to preserve Other write-ins.</p>
    <p className="muted">For Typeform, get the definition directly below or upload a saved JSON file. Google Forms uses files you download yourself. Checked with documented examples only; no real account export has been checked. <a href="/docs/moving-in">Read the moving-in guide</a>.</p>
    {error ? <p className="status-note" role="alert" data-tone="error">{error}</p> : null}
    {pendingCustody && !busy ? <p role="status">An interrupted commit may have private import data awaiting completion. Retry the reviewed import, or Cancel to remove that private data.</p> : null}
    <form className="panel import-form" onSubmit={e => { e.preventDefault(); void plan() }}>
      <label className="inspector-field">Source<select className="text-input" value={source} disabled={busy} onChange={e => { const next = e.target.value as ImportSource; void run(async () => { if (await cancelPending()) { reset(); setSource(next); setGoogle({}) } }) }}><option value="typeform">Typeform</option><option value="google-forms">Google Forms</option></select></label>
      <ImportFileHelp source={source} />
      {source === 'typeform' ? <TypeformConnection key={fileVersion} busy={busy} loadedTitle={loadedTitle} load={loadTypeform} /> : null}
      {source === 'google-forms' ? <GoogleOptions value={google} change={settingsChanged} busy={busy} /> : null}
      <label className="inspector-field">Form definition JSON{source === 'google-forms' ? (responseFormat === 'json' ? ' (required with response JSON)' : ' (optional forms.get JSON)') : ''}<input key={`definition-${fileVersion}`} style={{ maxWidth: '100%' }} type="file" accept=".json,application/json" disabled={busy} onChange={e => void run(() => read(e.target, 'definition'))} /></label>
      <label className="inspector-field">Response file format<select className="text-input" value={responseFormat} disabled={busy} onChange={event => { const next = event.target.value as 'csv' | 'json'; void run(async () => { if (await cancelPending()) { setResponseFormat(next); setCsv(''); setResponses(''); setReview(undefined); setColumns([]); setAcknowledged(false); setFileVersion(current => current + 1) } }) }}><option value="csv">CSV</option><option value="json">Responses API JSON (preserves Other)</option></select></label>
      {responseFormat === 'csv' ? <label className="inspector-field">Response CSV (optional)<input key={`csv-${fileVersion}`} style={{ maxWidth: '100%' }} type="file" accept=".csv,text/csv" disabled={busy} onChange={e => void run(() => read(e.target, 'csv'))} /></label> : <label className="inspector-field">Response JSON (optional; requires definition)<input key={`responses-${fileVersion}`} style={{ maxWidth: '100%' }} type="file" accept=".json,application/json" disabled={busy} onChange={e => void run(() => read(e.target, 'responses'))} /></label>}
      <p className="muted">Use a complete Responses API JSON resource for Other write-ins. Google checkbox CSV with Other and comma-separated values is ambiguous and is refused. Response JSON needs the matching definition; CSV and JSON cannot be combined.</p>
      <div className="builder-actions"><button className="primary-button focus-ring" disabled={busy || (!definition && (source !== 'google-forms' || !csv))} type="submit">{busy ? 'Working…' : review ? 'Refresh mapping report' : 'Review import'}</button><button className="quiet-button focus-ring" disabled={busy} type="button" onClick={() => void cancel()}>Cancel</button></div>
      <p className="muted">Review creates no stored import, flow or response. Cancellation removes private preparation; if verification finishes first, inspect its progress and use Undo import. Original file bytes are never retained; keep your copies privately.</p>
    </form>
    {review ? <>{source === 'google-forms' ? <GoogleQuestions review={review} value={google} change={next => { settingsChanged(next); setColumns([]) }} busy={busy} /> : null}<ReviewReport review={review} columns={columns} busy={busy} change={next => { setColumns(next); setDirty(true); setAcknowledged(false) }} />
      {review.alreadyImported ? <p role="status">These exact files were already imported. Existing history keeps its recorded interpretation and mapping; no answers or timestamps change. No new records will be created.</p> : review.heldByOtherOperator ? <p role="status">These exact files already have an import by another operator. The creating operator can resume or undo it; nothing new will be created.</p> : review.jobId && review.jobState !== 'preparation-interrupted' ? <p role="status">These files already have an import. Use its durable progress in Import history.</p> : <div className="panel" style={{ padding: '1.25rem', marginTop: '1rem' }}>
        {dirty ? <p role="status">Refresh the report to review your changed mappings.</p> : null}
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '.65rem' }}><input type="checkbox" disabled={busy || dirty} checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)} /><span>I have reviewed every changed or unsupported field, logic jump and column, and accept the reported loss and original-file omission.</span></label>
        <button className="primary-button focus-ring" style={{ marginTop: '1rem' }} type="button" disabled={busy || dirty || !acknowledged || review.rowErrors.length > 0} onClick={() => void commit()}>Import reviewed form</button>
      </div>}
      {review.alreadyImported || jobs.some(j => j.id === review.jobId && j.state === 'completed') ? <p><Link to="/app/flows/$flowId/builder" params={{ flowId: review.flowId }}>Open the imported draft</Link></p> : null}
    </> : null}
    <section className="import-history" aria-labelledby="import-history"><h2 id="import-history" className="display">Import history</h2><p>After acknowledgment, the import stores private preparation data and waits. Choose Continue import to verify it against your report before creating a form or response. Imports then continue in batches while this page stays open. Pause after the current batch, or return later to continue from stored progress. Undo removes imported responses and the flow in bounded batches. A later edit is preserved and stops undo with a visible conflict; any earlier reversed batches stay reversed.</p>
      <button className="quiet-button focus-ring" type="button" disabled={busy} onClick={() => void run(refresh)}>Refresh history</button>
      {progress.active ? <button className="secondary-button focus-ring" type="button" onClick={progress.pause}>Pause after this batch</button> : null}
      {jobs.map(job => <article className="quiet-panel" style={{ padding: '1rem', marginTop: '.75rem', overflowWrap: 'anywhere' }} key={job.id}><h3>{progressLabel(job)} · {job.checkpoint} / {job.total}</h3><small>{job.id}</small>{preparation(job) ? <p>No form or responses have been created. {job.state === 'preparing' ? 'Continue to verify the stored preparation and begin importing.' : 'Retry the reviewed files to prepare again, or cancel to remove the private data.'}</p> : null}{job.erasedRecords ? <p>{job.erasedRecords} response {job.erasedRecords === 1 ? 'record was' : 'records were'} already erased. Import and undo cannot restore those answers.</p> : null}{job.error ? <p role="alert">{job.error}</p> : null}<div className="builder-actions">
        {!['completed', 'undone', 'rolled_back', 'cancelled', 'preparation-interrupted'].includes(job.state) ? <button className="secondary-button focus-ring" disabled={busy} onClick={() => void run(async () => { await progress.follow(job) })}>Continue {job.state === 'undoing' || job.state === 'rolling_back' ? 'undo' : 'import'}</button> : null}
        {preparation(job) ? <button className="quiet-button focus-ring" disabled={busy} onClick={() => void run(async () => { const result = await importsApi.undo(job.id); if (result.state === 'cancelled') progress.show(result); else showPublication(result, job.id) })}>Cancel preparation</button> : !['undone', 'rolled_back', 'undoing', 'rolling_back', 'cancelled'].includes(job.state) ? <button className="quiet-button focus-ring" disabled={busy} onClick={() => { if (window.confirm('Undo this import? Unedited imported rows will be removed. Later edits are preserved and stop reversal.')) void run(async () => { await progress.follow(await importsApi.undo(job.id)) }) }}>Undo import</button> : null}
      </div></article>)}
    </section>
  </section>
}
