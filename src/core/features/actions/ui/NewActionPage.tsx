import { useEffect, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { api, reportingApi, type DashboardFlow, type Operator, type QuestionReport } from '../../../app/api'
import { ActionForm } from './ActionForm'
import { EvidenceFigures } from './EvidenceFigures'
import { actionsApi } from './actionsApi'

export type EvidenceSearch = { flowId?: string; revisionId?: string; questionId?: string }

function inDays(days: number) {
  const date = new Date(Date.now() + days * 86_400_000)
  return date.toISOString().slice(0, 10)
}

export function NewActionPage({ search, operatorId }: { search: EvidenceSearch; operatorId: string }) {
  const navigate = useNavigate()
  const [operators, setOperators] = useState<Operator[]>(), [timeZone, setTimeZone] = useState<string>()
  const [flows, setFlows] = useState<DashboardFlow[]>([]), [revisions, setRevisions] = useState<Array<{ id: string; number: number; isCurrent: number }>>([])
  const [questions, setQuestions] = useState<QuestionReport[]>([]), [results, setResults] = useState<{ completedResponses: number; starts: number; number: number; title: string }>()
  const [evidence, setEvidence] = useState<EvidenceSearch>(search)
  const [busy, setBusy] = useState(false), [error, setError] = useState<string>()
  useEffect(() => {
    Promise.all([api.operators(), api.workspace(), api.dashboard()]).then(([people, workspace, all]) => { setOperators(people); setTimeZone(workspace.timeZone); setFlows(all.filter(flow => flow.status !== 'draft')) })
      .catch(reason => setError(reason instanceof Error ? reason.message : 'This page could not load.'))
  }, [])
  useEffect(() => {
    setRevisions([]); if (!evidence.flowId) return
    reportingApi.ledger(evidence.flowId, {}).then(ledger => { setRevisions(ledger.revisions); if (!evidence.revisionId && ledger.revisions.length) setEvidence(current => ({ ...current, revisionId: (ledger.revisions.find(item => item.isCurrent) ?? ledger.revisions[0]).id })) })
      .catch(reason => setError(reason instanceof Error ? reason.message : 'Revisions could not load.'))
  }, [evidence.flowId])
  useEffect(() => {
    setQuestions([]); setResults(undefined); if (!evidence.flowId || !evidence.revisionId) return
    Promise.all([api.results(evidence.flowId, evidence.revisionId), reportingApi.questions(evidence.flowId, evidence.revisionId)])
      .then(([summary, items]) => { setResults({ completedResponses: summary.completedResponses, starts: summary.starts, number: summary.revision.number, title: summary.flow.title }); setQuestions(items.filter(item => item.questionType)) })
      .catch(reason => setError(reason instanceof Error ? reason.message : 'Results could not load.'))
  }, [evidence.flowId, evidence.revisionId])
  const question = questions.find(item => item.id === evidence.questionId)
  // The form prefills from the selected evidence, so it waits for those results rather than racing them.
  const ready = operators && timeZone && (!evidence.revisionId || results)
  return <section aria-labelledby="new-action-title">
    <header className="page-heading">
      <div className="builder-actions"><Link className="quiet-button focus-ring" to="/app/actions"><ArrowLeft aria-hidden="true" size={15} /> All actions</Link></div>
      <p className="eyebrow">Recommendation written by an operator</p><h1 className="display" id="new-action-title">New action</h1>
      <p className="muted">Turn what the results show into an owned action with a metric and a review date. Saving an action contacts no one.</p>
    </header>
    {error ? <p className="status-note" data-tone="error" role="alert">{error}</p> : null}
    <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 24rem), 1fr))', alignItems: 'start' }}>
      <section className="panel" style={{ padding: '1.25rem', minWidth: 0 }} aria-labelledby="evidence-title">
        <h2 id="evidence-title">Evidence</h2>
        <label className="inspector-field">Flow<select className="text-input" value={evidence.flowId ?? ''} onChange={event => setEvidence({ flowId: event.target.value || undefined })}><option value="">Choose a flow</option>{flows.map(flow => <option key={flow.id} value={flow.id}>{flow.title}</option>)}</select></label>
        <label className="inspector-field">Published revision<select className="text-input" value={evidence.revisionId ?? ''} disabled={!revisions.length} onChange={event => setEvidence({ flowId: evidence.flowId, revisionId: event.target.value || undefined })}>{revisions.map(revision => <option key={revision.id} value={revision.id}>Revision {revision.number}{revision.isCurrent ? ' · current' : ''}</option>)}</select></label>
        <label className="inspector-field">Question<select className="text-input" value={evidence.questionId ?? ''} disabled={!questions.length} onChange={event => setEvidence({ ...evidence, questionId: event.target.value || undefined })}><option value="">The whole revision</option>{questions.map(item => <option key={item.id} value={item.id}>{item.prompt}</option>)}</select></label>
        {results ? <EvidenceFigures figures={{ flowTitle: results.title, revisionNumber: results.number, completedResponses: results.completedResponses, starts: results.starts, ...(question ? { question: { prompt: question.prompt, questionType: question.questionType ?? '', reached: question.reached, answered: question.answered, countLabel: question.distributionLabel, counts: (question.summary.promoters !== undefined ? [{ label: 'Promoters (9–10)', count: question.summary.promoters }, { label: 'Passives (7–8)', count: question.summary.passives ?? 0 }, { label: 'Detractors (0–6)', count: question.summary.detractors ?? 0 }] : question.distribution).map(bucket => ({ label: bucket.label, count: bucket.count, of: question.answered })) } } : {}) }} /> : <p className="muted">Choose a flow with a published revision.</p>}
        <p className="muted">These counts are copied into the action when you save it, so it keeps its evidence when results change. No answers or respondents are stored with it.</p>
      </section>
      {ready ? <ActionForm operators={operators} timeZone={timeZone} busy={busy} submitLabel="Save action"
        initial={{ title: '', rationale: '', ownerOperatorId: operatorId, reviewDate: inDays(30), metric: { name: question?.prompt ?? '', unit: 'percent', direction: 'increase', baselineValue: Number.NaN, baselineSource: results ? `Revision ${results.number} results` : '', baselineObservedAt: new Date().toISOString() } }}
        key={`${evidence.revisionId}:${evidence.questionId}`}
        onSubmit={fields => {
          if (!evidence.flowId || !evidence.revisionId) { setError('Choose the flow and revision this action rests on.'); return }
          setBusy(true); setError(undefined)
          actionsApi.create({ ...fields, evidence: { flowId: evidence.flowId, revisionId: evidence.revisionId, ...(evidence.questionId ? { questionId: evidence.questionId } : {}) } })
            .then(action => navigate({ to: '/app/actions/$actionId', params: { actionId: action.id } }))
            .catch(reason => { setError(reason instanceof Error ? reason.message : 'The action could not be saved.'); setBusy(false) })
        }} /> : <p className="status-note" role="status">Loading…</p>}
    </div>
  </section>
}
