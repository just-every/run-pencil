import { useEffect, useState } from 'react'
import { api, type QuestionReport } from '../../../app/api'
import { isOtherAnswer } from '../../../shared/otherChoices'
function displayAnswer(questions: QuestionReport[], stepId: string, value: unknown) {
  const question = questions.find((entry) => entry.id === stepId)
  const label = (id: unknown) => {
    const choice = question?.choices.find(choice => choice.id === id)
    if (!choice) throw new Error('A retained answer is missing its published choice label')
    return choice.label
  }
  if (isOtherAnswer(value)) return [...value.choiceIds.map(label), value.otherText].join('\n')
  if (['single_choice', 'multiple_choice', 'priority', 'dropdown'].includes(question?.questionType ?? '')) return Array.isArray(value) ? value.map((id, index) => `${question?.questionType === 'priority' ? `${index + 1}. ` : ''}${label(id)}`).join('\n') : label(value)
  if (question?.questionType === 'yes_no') {
    if (typeof value !== 'boolean') throw new Error('Invalid stored yes/no answer')
    return value ? 'Yes' : 'No'
  }
  if (question?.questionType === 'consent') {
    if (!value || typeof value !== 'object' || !('accepted' in value) || typeof value.accepted !== 'boolean' || !('statement' in value) || typeof value.statement !== 'string') throw new Error('Stored consent statement is missing')
    return `${value.accepted ? 'Accepted' : 'Declined'}\n${value.statement}`
  }
  return typeof value === 'string' ? value : JSON.stringify(value)
}
// Plain-language reasons for the stored quarantine ids; an id this build does not know reads generically, never as a raw id.
function quarantineReason(reason: string | null) {
  return reason === 'honeypot' ? 'Held for review: the hidden bot-check field was filled.' : reason === 'minimum-fill-time' ? 'Held for review: submitted faster than the minimum time from form load.' : 'Held for review.'
}
export function QuarantineReview({ revisionId, timeZone, questions, onChanged }: { revisionId: string; timeZone: string; questions: QuestionReport[]; onChanged: () => void }) {
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
  return <section className="panel results-card" aria-labelledby="quarantine-title"><p className="eyebrow">Human review</p><h2 id="quarantine-title" className="display">Quarantined responses</h2><p className="muted">These complete answers triggered a bot check or arrived before the minimum time from form load. They remain excluded from reports and response exports until an operator releases them. Release remains available after closure.</p>{error ? <p className="status-note" data-tone="error" role="alert">{error}</p> : null}{!responses ? <p>Loading review queue…</p> : !responses.length ? <p>No quarantined responses for this revision.</p> : responses.map((response) => <article key={response.id} className="quiet-panel" style={{ marginTop: '.75rem', padding: '1rem' }}><p>Submitted {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(new Date(response.completedAt))}</p><p>{quarantineReason(response.quarantineReason)}</p><dl>{response.answers.map((answer) => <div className="ledger-answer" key={answer.stepId}><dt><strong>{questions.find((question) => question.id === answer.stepId)?.prompt ?? 'Question metadata unavailable'}</strong></dt><dd style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{displayAnswer(questions, answer.stepId, answer.value)}</dd></div>)}</dl><div className="builder-actions"><button className="secondary-button" disabled={busy === response.id} onClick={() => act(response.id, 'release')} type="button">Release into results</button><button className="quiet-button danger-quiet" disabled={busy === response.id} onClick={() => setDeleting(response.id)} type="button">Delete quarantined response</button></div>{deleting === response.id ? <div className="status-note" role="alert"><p>Delete this response and all its answers permanently? The audit retains an anonymous deletion fact.</p><div className="builder-actions"><button className="quiet-button" onClick={() => setDeleting(undefined)} type="button">Keep response</button><button className="danger-button" disabled={busy === response.id} onClick={() => act(response.id, 'delete')} type="button">Confirm deletion</button></div></div> : null}</article>)}</section>
}
