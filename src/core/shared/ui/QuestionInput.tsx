import { contactQuestionTypes } from '../contactAnswers'
import { scoreQuestionTypes } from '../scoreQuestions'
import { ContactQuestionInput } from './ContactQuestionInput'
import { ScoreQuestionInput } from './ScoreQuestionInput'
import { TextQuestionInput } from './TextQuestionInput'
import { RatingInput } from './RatingInput'
import { moveAnswerFocus } from './answerKeyboard'
import { ExtendedQuestionInput } from './ExtendedQuestionInput'
import { Check } from 'lucide-react'
import type { FlowStep, ChoiceOption } from '../../app/api'

export function QuestionInput({ step, choices, value, onChange }: { step: FlowStep; choices: ChoiceOption[]; value: unknown; onChange: (value: unknown) => void }) {
  const required = step.required
  if ((contactQuestionTypes as readonly string[]).includes(step.questionType ?? '')) return <ContactQuestionInput step={step} value={value} onChange={onChange} />
  if ((scoreQuestionTypes as readonly string[]).includes(step.questionType ?? '')) return <ScoreQuestionInput step={step} value={value} onChange={onChange} />
  if (['dropdown', 'yes_no', 'nps', 'number', 'date', 'consent'].includes(step.questionType ?? '')) return <ExtendedQuestionInput step={step} choices={choices} value={value} onChange={onChange} />
  if (step.questionType === 'rating') return <RatingInput step={step} value={value} onChange={onChange} />
  if (step.questionType === 'single_choice') {
    return <div className="answer-stack" role="radiogroup" aria-label={step.prompt} aria-required={required}>
      {choices.map((choice) => <button aria-checked={value === choice.id} tabIndex={value === choice.id || (!choices.some(option => option.id === value) && choice === choices[0]) ? 0 : -1} onKeyDown={event => moveAnswerFocus(event, true)} className="choice-button focus-ring" data-selected={value === choice.id} key={choice.id} onClick={() => onChange(choice.id)} role="radio" type="button"><span className="choice-indicator">{value === choice.id ? <Check aria-hidden="true" size={14} /> : null}</span>{choice.label}</button>)}
    </div>
  }
  if (step.questionType === 'multiple_choice') {
    const selected = Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
    return <div className="answer-stack" aria-label={step.prompt} role="listbox" aria-required={required} aria-multiselectable="true">
      {choices.map((choice) => {
        const checked = selected.includes(choice.id)
        return <button aria-selected={checked} tabIndex={choice.id === (selected[0] ?? choices[0]?.id) ? 0 : -1} onKeyDown={event => moveAnswerFocus(event, false)} className="choice-button focus-ring" data-selected={checked} key={choice.id} onClick={() => onChange(checked ? selected.filter((item) => item !== choice.id) : [...selected, choice.id])} role="option" type="button"><span className="choice-indicator">{checked ? <Check aria-hidden="true" size={14} /> : null}</span>{choice.label}</button>
      })}
    </div>
  }
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
