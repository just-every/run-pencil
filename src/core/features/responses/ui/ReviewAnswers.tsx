import type { PublicFlow } from '../../../app/api'
import { formattedAnswer, interpolateAnswerRecall } from '../../../shared/answerRecall'
import { isUnanswered } from '../../../shared/answers'
import { isOtherAnswer, selectedChoiceIds } from '../../../shared/otherChoices'
import { ratingScale } from '../../../shared/ratingScale'
import type { FlowStep } from '../../../app/api'
import './review-answers.css'

export function ReviewAnswers({ flow, steps, answers, disabled, onEdit }: {
  flow: PublicFlow; steps: FlowStep[]; answers: Record<string, unknown>; disabled: boolean; onEdit: (stepId: string) => void
}) {
  return <section aria-label="Your answers" className="response-review">
    <p className="respondent-helper">Check your answers before sending. You can edit any answer and follow the updated questions.</p>
    <dl>{steps.map(step => {
      const recall = (text: string) => interpolateAnswerRecall(text, flow, answers, step.id)
      const value = answers[step.id]
      let display = 'Not answered'
      if (!isUnanswered(value)) {
        display = formattedAnswer(step, flow.choices.filter(choice => choice.stepId === step.id), value, recall)
        if (isOtherAnswer(value)) {
          display = selectedChoiceIds(value).map(id => {
            const label = recall(flow.choices.find(choice => choice.id === id)!.label)
            return id === step.questionSettings?.otherChoiceId ? `${label}: ${value.otherText}` : label
          }).join(', ')
        }
        if (step.questionType === 'rating') {
          const scale = ratingScale(step.questionSettings ?? {})
          const label = [value === scale.min ? scale.lowLabel : '', typeof value === 'number' && Math.abs(value - (scale.min + scale.max) / 2) <= 0.5 ? scale.middleLabel : '', value === scale.max ? scale.highLabel : ''].filter(Boolean).join(', ')
          display = label ? `${value} — ${label}` : String(value)
        }
      }
      return <div className="response-review-row" key={step.id}>
        <dt><span>{recall(step.prompt)}</span><a className="quiet-button focus-ring" href="#respondent-title" aria-label={`Edit ${recall(step.prompt)}`} aria-disabled={disabled} onClick={event => { event.preventDefault(); if (!disabled) onEdit(step.id) }}>Edit</a></dt>
        <dd>{display}</dd>
      </div>
    })}</dl>
  </section>
}
