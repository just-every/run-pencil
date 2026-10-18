import { RowErrors } from './RowErrors'
import { type ColumnMapping, type ImportReview } from '../model'
import { reportText, typeLabel } from './report-labels'
import { ImportStructure } from './ImportStructure'
export function ReviewReport({ review, columns, change, busy }: { review: ImportReview; columns: ColumnMapping[]; change: (value: ColumnMapping[]) => void; busy: boolean }) {
  return <section aria-labelledby="mapping-heading">
    <h2 id="mapping-heading">Review the mapping</h2>
    <p>{review.title} · {review.questions.length} questions · {review.responseCount} valid response rows</p>
    <ImportStructure questions={review.questions} />
    {review.google ? <div className="quiet-panel" style={{padding:'1rem'}}><p>{review.google.mode === 'csv-only' ? 'CSV-only reconstruction' : 'Google Forms definition'} · {review.google.dateOrder ?? 'Choose date order'} · {review.google.timeZone ?? 'Choose Sheet time zone'}</p>{review.google.firstTimestamp ? <p>First: {review.google.firstTimestamp.local} → {review.google.firstTimestamp.utc}</p> : null}{review.google.lastTimestamp ? <p>Last: {review.google.lastTimestamp.local} → {review.google.lastTimestamp.utc}</p> : null}</div> : null}
    <p className="muted">Every field and logic jump is listed below. Historical responses stay anonymous on an immutable imported revision. Editing the new draft does not change those answers.</p>
    {review.headers.length ? <fieldset disabled={busy} style={{ minWidth: 0, margin: 0, padding: 0, border: 0 }}><legend>CSV columns</legend><p>{review.source === 'google-forms' ? 'Choose a question, the submission timestamp, a separate Other text column, or Skip. Fixed selections use one question column. Changed mappings need a fresh report.' : 'Choose a question, a timestamp, a separate multiple-choice option, an Other text column, or Skip. Changed mappings need a fresh report. Accepted selection encodings are shown in the moving guide.'}</p>
      {review.headers.map((header, column) => {
        const mapping = columns.find(c => c.column === column) ?? { column, target: 'skip' }
        return <label className="inspector-field" key={column}>{column + 1}. {header || '(empty heading)'}
          <select className="text-input" disabled={review.forbiddenColumns.includes(column)} value={mapping.choice ? `${mapping.target}::${mapping.choice}` : mapping.target} onChange={e => { const [target, choice] = e.target.value.split('::'); change(columns.map(c => c.column === column ? { column, target, ...(choice ? { choice } : {}) } : c)) }}>
            <option value="skip">Skip{review.forbiddenColumns.includes(column) ? ' — private metadata, uploads or quiz data is never imported' : ''}</option><option value="submittedAt">Submission timestamp</option>{review.source !== 'google-forms' ? <option value="startedAt">Start timestamp</option> : null}
            {review.questions.map(q => <option key={q.id} value={q.id}>{q.prompt} ({typeLabel(q.questionType ?? 'question')}){review.source === 'google-forms' ? ` — source ${q.sourceId}` : ''}</option>)}
            {review.questions.flatMap(q => q.choices.filter(c => c.id === q.settings.otherChoiceId || review.source !== 'google-forms' && q.questionType === 'multiple_choice').map(c => <option key={`${q.id}:${c.id}`} value={`${q.id}::${c.id}`}>{q.prompt} — {c.label} {c.id === q.settings.otherChoiceId ? 'write-in text' : 'selected'}</option>))}
          </select>
        </label>
      })}</fieldset> : null}
    <div role="list" aria-label="Field and logic mapping report">{review.report.map((item, index) => <div role="listitem" className="quiet-panel" style={{ padding: '1rem', marginTop: '.65rem', overflowWrap: 'anywhere' }} key={index}>
      <strong>{reportText(item.label, review)} · {typeLabel(item.sourceType)}</strong><p><span className="badge">{item.state === 'unsupported' ? 'Left out' : item.state === 'changed' ? 'Changed' : 'Imported'}</span> {reportText(item.change, review)}</p><p>{reportText(item.reason, review)}</p><details><summary className="focus-ring">Source details</summary><small className="muted">{item.location}</small></details>
    </div>)}</div>
    <RowErrors key={review.fingerprint} errors={review.rowErrors} />
  </section>
}
