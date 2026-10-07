import { dayBoundary } from '../../../shared/timeZone'
import { useEffect, useRef, useState } from 'react'
import { api, reportingApi, type Ledger, type LedgerFilter, type QuestionReport } from '../../../app/api'

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a'); link.href = url; link.download = name; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
const csv = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`
export function ResponseLedger({ flowId, revisionId, timeZone, questions, onChanged }: { flowId: string; revisionId: string; timeZone: string; questions: QuestionReport[]; onChanged: () => void }) {
  const [ledger, setLedger] = useState<Ledger>()
  const [filter, setFilter] = useState<LedgerFilter>({ revisionId })
  const [error, setError] = useState<string>()
  const [exporting, setExporting] = useState(false)
  const [exportNotice, setExportNotice] = useState<string>()
  const [selected, setSelected] = useState<string>()
  const [erasing, setErasing] = useState<string>()
  const [confirmErase, setConfirmErase] = useState<string>()
  const erase = async (id: string) => {
    setErasing(id); setError(undefined)
    try { await api.eraseReleasedResponse(id); setConfirmErase(undefined); setSelected(undefined); load(); onChanged() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The response could not be erased.'); load(false) }
    finally { setErasing(undefined) }
  }
  const requestVersion = useRef(0)
  const load = (clearError = true) => {
    const version = ++requestVersion.current
    if (clearError) setError(undefined)
    setLedger(undefined)
    reportingApi.ledger(flowId, filter).then((result) => { if (requestVersion.current === version) setLedger(result) }).catch((reason: unknown) => {
      if (requestVersion.current === version) setError(reason instanceof Error ? reason.message : 'The ledger could not load.')
    })
  }
  useEffect(() => { setFilter({ revisionId }) }, [revisionId])
  useEffect(() => { load(); return () => { requestVersion.current++ } }, [flowId, filter])
  const exportResponses = async (format: 'json' | 'csv') => {
    setExporting(true); setError(undefined)
    try {
      const result = await reportingApi.export(flowId, { ...filter, offset: undefined })
      const filename = `pencil-responses-${result.cutoff.replaceAll(':', '-')}`
      if (format === 'json') download(`${filename}.json`, JSON.stringify(result, null, 2), 'application/json')
      else {
        const header = ['response_id', 'revision_id', 'revision_number', 'source', 'started_at', 'completed_at', 'released_at', 'participant_json', 'answers_json', 'cutoff', 'excluded_quarantined'].join(',')
        const rows = result.responses.map((row) => [row.id, row.revisionId, row.revisionNumber, row.source, row.startedAt, row.completedAt, row.releasedAt, row.participant ? JSON.stringify(row.participant) : '', JSON.stringify(row.answers), result.cutoff, result.excludedQuarantined].map(csv).join(','))
        download(`${filename}.csv`, [header, ...rows].join('\r\n'), 'text/csv')
      }
      setExportNotice(`${result.responses.length} released responses exported at ${result.cutoff}. ${result.excludedQuarantined} quarantined responses excluded.`)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Export failed.') } finally { setExporting(false) }
  }
  const time = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(new Date(value))
  return <section className="panel" style={{ padding: '1.25rem', marginTop: '1.5rem' }} aria-labelledby="ledger-title">
    <header className="toggle-row"><div><p className="eyebrow">Individual responses</p><h2 id="ledger-title" className="display">Response ledger</h2><p className="muted">Response-only filters below apply to the ledger and exports. They do not change the revision summary, starts or device counts above. Answers keep the question and revision that asked them.</p></div><div className="builder-actions"><button className="quiet-button" disabled={exporting} onClick={() => exportResponses('json')} type="button">Export JSON</button><button className="quiet-button" disabled={exporting} onClick={() => exportResponses('csv')} type="button">Export CSV</button><button className="quiet-button" type="button" onClick={() => { load(); onChanged() }}>Refresh</button></div></header>
    <div className="ledger-filters"><label className="inspector-field">Source<select aria-label="Source" className="text-input" value={filter.source ?? ''} onChange={(event) => setFilter((current) => ({ ...current, offset: 0, source: event.target.value as LedgerFilter['source'] || undefined }))}><option value="">All sources</option><option value="direct">Direct link</option><option value="embed">Embed</option><option value="invitation">Invitation</option><option value="unknown">Historical source unavailable</option></select></label><label className="inspector-field">Participant status<select aria-label="Participant status" className="text-input" value={filter.participantStatus ?? ''} onChange={event => setFilter(current => ({ ...current, offset: 0, participantStatus: event.target.value as LedgerFilter['participantStatus'] || undefined }))}><option value="">All participants and anonymous</option><option value="eligible">Eligible</option><option value="opted-out">Opted out</option><option value="bounced">Bounced</option></select></label><label className="inspector-field">Submitted from<input className="text-input" type="date" onChange={(event) => setFilter((current) => ({ ...current, offset: 0, from: event.target.value ? dayBoundary(event.target.value, timeZone) : undefined }))} /><span className="muted">{timeZone}</span></label><label className="inspector-field">Submitted through<input className="text-input" type="date" onChange={(event) => setFilter((current) => ({ ...current, offset: 0, to: event.target.value ? dayBoundary(event.target.value, timeZone, true) : undefined }))} /><span className="muted">{timeZone}</span></label><label className="inspector-field">Structured question<select className="text-input" value={filter.answerStepId ?? ''} onChange={(event) => setFilter((current) => ({ ...current, offset: 0, answerStepId: event.target.value || undefined, answerValue: undefined }))}><option value="">Any answer</option>{questions.filter((question) => ['email', 'single_choice', 'multiple_choice', 'rating', 'priority'].includes(question.questionType ?? '')).map((question) => <option value={question.id} key={question.id}>{question.prompt}</option>)}</select></label>{filter.answerStepId ? <label className="inspector-field">Answer contains / equals{questions.find((question) => question.id === filter.answerStepId)?.choices.length ? <select className="text-input" value={filter.answerValue ?? ''} onChange={(event) => setFilter((current) => ({ ...current, offset: 0, answerValue: event.target.value || undefined }))}><option value="">Any value</option>{questions.find((question) => question.id === filter.answerStepId)?.choices.map((choice) => <option key={choice.id} value={choice.id}>{choice.label}</option>)}</select> : <input className="text-input" value={filter.answerValue ?? ''} onChange={(event) => setFilter((current) => ({ ...current, offset: 0, answerValue: event.target.value || undefined }))} />}</label> : null}</div>
    {error ? <p className="status-note" data-tone="error" role="alert">{error}</p> : null}{exportNotice ? <p className="status-note" role="status">{exportNotice}</p> : null}
    {!ledger ? <p>Loading released responses…</p> : <><p className="muted">{ledger.total} matching completed responses · dates displayed in {timeZone}</p>{!ledger.responses.length ? <p>No released response matches this filter.</p> : <div className="ledger-list">{ledger.responses.map((response) => <article className="quiet-panel" style={{ padding: '1rem' }} key={response.id}><button className="quiet-button" aria-expanded={selected === response.id} type="button" onClick={() => setSelected(selected === response.id ? undefined : response.id)}>{time(response.completedAt)} · revision {response.revisionNumber} · {response.source} · View answers</button>{selected === response.id ? <><p className="muted">Started: {response.startedAt ? time(response.startedAt) : 'Not recorded by the earlier runtime'}. Submitted: {time(response.completedAt)}.</p><p>{response.participant ? `Invited participant: ${response.participant.name ?? 'Erased'} · ${response.participant.email ?? 'No address retained'}` : 'Anonymous response'}</p><dl>{response.answers.map((answer) => <div key={answer.stepId} className="ledger-answer"><dt><strong>{answer.label}</strong></dt><dd style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{answer.displayValue}</dd></div>)}</dl><details style={{ marginBottom: '1rem' }}><summary className="muted">Response identifiers</summary><p className="muted ledger-id">Response: {response.id}<br />Revision: {response.revisionId}</p>{response.answers.map((answer) => <p className="muted ledger-id" key={answer.stepId}>{answer.label}: {answer.stepId}</p>)}</details><button className="quiet-button" type="button" disabled={Boolean(erasing)} onClick={() => setConfirmErase(response.id)}>Erase response</button>{confirmErase === response.id ? <div className="status-note" role="alert"><p>Permanently erase this response, its answers and pending effects? Completed totals and answer reports will update. Anonymous start and device counts remain. Only an anonymous audit fact is retained.</p><div className="builder-actions"><button className="quiet-button" type="button" disabled={Boolean(erasing)} onClick={() => setConfirmErase(undefined)}>Keep response</button><button className="secondary-button" type="button" disabled={Boolean(erasing)} onClick={() => erase(response.id)}>{erasing === response.id ? 'Erasing…' : 'Confirm erasure'}</button></div></div> : null}</> : null}</article>)}</div>}<div className="builder-actions"><button className="quiet-button" disabled={(filter.offset ?? 0) === 0} type="button" onClick={() => setFilter((current) => ({ ...current, offset: Math.max(0, (current.offset ?? 0) - 50) }))}>Previous responses</button><span>{ledger.total ? (filter.offset ?? 0) + 1 : 0}–{Math.min((filter.offset ?? 0) + ledger.responses.length, ledger.total)} / {ledger.total}</span><button className="quiet-button" disabled={(filter.offset ?? 0) + ledger.responses.length >= ledger.total} type="button" onClick={() => setFilter((current) => ({ ...current, offset: (current.offset ?? 0) + 50 }))}>Next responses</button></div></>}
  </section>
}
