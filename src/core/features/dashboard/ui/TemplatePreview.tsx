import { useMemo, useState } from 'react'
import { templatePreview, type FlowTemplateId } from '../../flows'
import { answerIssue, isUnanswered } from '../../../shared/answers'
import { visiblePath } from '../../../shared/flowPath'
import { AnswerFieldset } from '../../../shared/ui/AnswerFieldset'
import { PaymentSummary, paymentQuoteFor } from '../../payments/ui'
import { QuestionInput } from '../../../shared/ui/QuestionInput'

/** Respondent controls and traversal without draft creation or collection activity. */
export function TemplatePreview({ template }: { readonly template: FlowTemplateId }) {
  const graph = useMemo(() => templatePreview(template), [template])
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [index, setIndex] = useState(0)
  const [error, setError] = useState<string>()
  const path = visiblePath(graph, answers)
  const step = path[Math.min(index, path.length - 1)]
  const choices = graph.choices.filter(choice => choice.stepId === step.id)
  const next = () => {
    const issue = step.kind === 'question' ? answerIssue(step, choices.map(choice => choice.id), answers[step.id]) : undefined
    setError(issue)
    if (!issue) setIndex(current => Math.min(current + 1, path.length - 1))
  }
  return <section aria-label="Template preview">
    <p className="eyebrow">Respondent preview</p>
    <p className="muted">Try every question. Preview answers are not collected.</p>
    {graph.branchRules.length ? <p>Positive → What to keep · Needs attention → What to improve</p> : null}
    <form className="note-sheet template-preview" noValidate onSubmit={event => { event.preventDefault(); if (step.kind !== 'completion') next() }}>
      <h2 className="display template-preview__prompt" id="template-preview-title">{step.prompt}</h2>
      {step.helperText ? <p>{step.helperText}</p> : null}
      {step.kind === 'payment' ? <><PaymentSummary quote={paymentQuoteFor(graph, step, answers)} /><p>Preview never opens Stripe or charges anyone.</p></> : null}
      {step.kind === 'question' ? <AnswerFieldset id={`template-${step.id}`} labelledBy="template-preview-title" disabled={false} error={error}>
        <QuestionInput key={step.id} step={step} choices={choices} value={answers[step.id]} onChange={value => {
          const nextAnswers = { ...answers, [step.id]: value }
          const reachable = new Set(visiblePath(graph, nextAnswers).map(entry => entry.id))
          setAnswers(Object.fromEntries(Object.entries(nextAnswers).filter(([id, answer]) => reachable.has(id) && !isUnanswered(answer))))
          setError(undefined)
        }} />
      </AnswerFieldset> : step.kind === 'completion' ? <strong role="status">Preview complete</strong> : null}
      <div className="builder-actions draft-preview-actions">
        <button className="quiet-button focus-ring" type="button" disabled={index === 0} onClick={() => { setIndex(current => current - 1); setError(undefined) }}>Back in preview</button>
        {step.kind !== 'completion' ? <button className="primary-button focus-ring" type="submit">Continue preview</button> : null}
        <button className="quiet-button focus-ring" type="button" onClick={() => { setAnswers({}); setIndex(0); setError(undefined) }}>Restart preview</button>
      </div>
    </form>
  </section>
}
