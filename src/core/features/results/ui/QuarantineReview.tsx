import { useEffect, useState } from 'react'
import { api, type QuestionReport } from '../../../app/api'
function displayAnswer(questions: QuestionReport[], stepId: string, value: unknown) {
  const question = questions.find((entry) => entry.id === stepId)
  const label = (id: unknown) => question?.choices.find((choice) => choice.id === id)?.label ?? String(id)
  if (['single_choice', 'multiple_choice', 'priority'].includes(question?.questionType ?? '')) return Array.isArray(value) ? value.map((id, index) => `${question?.questionType === 'priority' ? `${index + 1}. ` : ''}${label(id)}`).join('\n') : label(value)
  return typeof value === 'string' ? value : JSON.stringify(value)
}
export function QuarantineReview({ revisionId, questions, onChanged }: { revisionId: string; questions: QuestionReport[]; onChanged: () => void }) {
  const [responses, setResponses] = useState<Awaited<ReturnType<typeof api.quarantinedResponses>>>()
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState<string>()
  const [deleting, setDeleting] = useState<string>()
  const load = () => { api.quarantinedResponses(revisionId).then(setResponses).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Quarantine could not load.')) }
  useEffect(load, [revisionId])
  const act = async (id: string, action: 'release' | 'delete') => {
    setBusy(id); setError(undefined)
    try { if (action === 'release') await api.releaseQuarantinedResponse(id); else await api.deleteQuarantinedResponse(id); load(); setDeleting(undefined); onChanged() } catch (reason) { setError(reason instanceof Error ? reason.message : 'Review could not be saved.'); load() } finally { setBusy(undefined) }
  }
  return <section className="panel" style={{ marginTop: '1.5rem', padding: '1.25rem' }} aria-labelledby="quarantine-title"><p className="eyebrow">Human review</p><h2 id="quarantine-title" className="display">Quarantined responses</h2><p className="muted">These complete answers arrived faster than the minimum fill time. They remain excluded from reports and response exports until an operator releases them. Release remains available after closure.</p>{error ? <p className="status-note" data-tone="error" role="alert">{error}</p> : null}{!responses ? <p>Loading review queue…</p> : !responses.length ? <p>No quarantined responses for this revision.</p> : responses.map((response) => <article key={response.id} className="quiet-panel" style={{ marginTop: '.75rem', padding: '1rem' }}><p className="ledger-id">{response.id}</p><p>Defence: {response.quarantineReason}</p><dl>{response.answers.map((answer) => <div className="ledger-answer" key={answer.stepId}><dt><strong>{questions.find((question) => question.id === answer.stepId)?.prompt ?? answer.stepId}</strong></dt><dd style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{displayAnswer(questions, answer.stepId, answer.value)}</dd></div>)}</dl><div className="builder-actions"><button className="secondary-button" disabled={busy === response.id} onClick={() => act(response.id, 'release')} type="button">Release into results</button><button className="quiet-button" disabled={busy === response.id} onClick={() => setDeleting(response.id)} type="button">Delete quarantined response</button></div>{deleting === response.id ? <div className="status-note" role="alert"><p>Delete this response and all its answers permanently? The audit retains an anonymous deletion fact.</p><div className="builder-actions"><button className="quiet-button" onClick={() => setDeleting(undefined)} type="button">Keep response</button><button className="secondary-button" disabled={busy === response.id} onClick={() => act(response.id, 'delete')} type="button">Confirm deletion</button></div></div> : null}</article>)}</section>
}
