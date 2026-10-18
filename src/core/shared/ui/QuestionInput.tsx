import { ChoiceQuestionInput } from './ChoiceQuestionInput'
import { contactQuestionTypes } from '../contactAnswers'
import { scoreQuestionTypes } from '../scoreQuestions'
import { ContactQuestionInput } from './ContactQuestionInput'
import { ScoreQuestionInput } from './ScoreQuestionInput'
import { TextQuestionInput } from './TextQuestionInput'
import { RatingInput } from './RatingInput'
import { ExtendedQuestionInput } from './ExtendedQuestionInput'
import type { FlowStep, ChoiceOption } from '../../app/api'

export function QuestionInput({ step, choices, value, onChange }: { step: FlowStep; choices: ChoiceOption[]; value: unknown; onChange: (value: unknown) => void }) {
  const required = step.required
  if ((contactQuestionTypes as readonly string[]).includes(step.questionType ?? '')) return <ContactQuestionInput step={step} value={value} onChange={onChange} />
  if ((scoreQuestionTypes as readonly string[]).includes(step.questionType ?? '')) return <ScoreQuestionInput step={step} value={value} onChange={onChange} />
  if (['yes_no', 'nps', 'number', 'date', 'consent'].includes(step.questionType ?? '')) return <ExtendedQuestionInput step={step} choices={choices} value={value} onChange={onChange} />
  if (step.questionType === 'rating') return <RatingInput step={step} value={value} onChange={onChange} />
  if (['single_choice', 'multiple_choice', 'dropdown'].includes(step.questionType ?? '')) return <ChoiceQuestionInput step={step} choices={choices} value={value} onChange={onChange} />
  if (step.questionType === 'priority') {
    const ordered = Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
    return <div className="answer-stack" aria-label={step.prompt} role="group">
      {choices.map((choice) => {
        const rank = ordered.indexOf(choice.id)
        return <button role="checkbox" aria-required={required} aria-checked={rank >= 0} className="choice-button focus-ring" data-selected={rank >= 0} key={choice.id} onClick={() => onChange(rank >= 0 ? ordered.filter((item) => item !== choice.id) : [...ordered, choice.id])} type="button"><span className="choice-indicator">{rank >= 0 ? rank + 1 : null}</span>{choice.label}</button>
      })}
      <p className="status-note">Select each option in priority order.</p>
    </div>
  }
  if (step.questionType === 'short_text' || step.questionType === 'long_text') return <TextQuestionInput step={step} choices={choices} value={value} onChange={onChange} />
  return <input aria-label={step.prompt} aria-required={required} className="text-input" onChange={event => onChange(event.target.value)} placeholder="Write your response…" type="email" value={typeof value === 'string' ? value : ''} />
}
