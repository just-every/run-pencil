import { moveAnswerFocus } from './answerKeyboard'
import { ExtendedQuestionInput } from './ExtendedQuestionInput'
import { Check, Star } from 'lucide-react'
import type { FlowStep, ChoiceOption } from '../../app/api'

export function QuestionInput({ step, choices, value, onChange }: { step: FlowStep; choices: ChoiceOption[]; value: unknown; onChange: (value: unknown) => void }) {
  const required = step.required
  if (['dropdown', 'yes_no', 'nps', 'number', 'date', 'consent'].includes(step.questionType ?? '')) return <ExtendedQuestionInput step={step} choices={choices} value={value} onChange={onChange} />
  if (step.questionType === 'rating') {
    const settings = step.questionSettings ?? {}
    const min = typeof settings.min === 'number' ? settings.min : 1
    const max = typeof settings.max === 'number' ? settings.max : 5
    return <div role="radiogroup" aria-required={required} className="rating-row" aria-label={`${step.prompt} rating`}>
      {Array.from({ length: max - min + 1 }, (_, offset) => min + offset).map((rating) => <button aria-label={`${rating} out of ${max}`} role="radio" aria-checked={value === rating} tabIndex={value === rating || (typeof value !== 'number' && rating === min) ? 0 : -1} onKeyDown={event => moveAnswerFocus(event, true)} className="rating-button focus-ring" data-selected={value === rating} key={rating} onClick={() => onChange(rating)} type="button">{min === 0 || max > 5 ? <span>{rating}</span> : <Star aria-hidden="true" fill={value === rating ? 'currentColor' : 'none'} size={24} />}</button>)}
    </div>
  }
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
  const multiline = step.questionType === 'long_text'
  const type = step.questionType === 'email' ? 'email' : 'text'
  if (multiline) return <textarea aria-label={step.prompt} aria-required={required} className="text-area" onChange={(event) => onChange(event.target.value)} placeholder="Write your response…" value={typeof value === 'string' ? value : ''} />
  return <input aria-label={step.prompt} aria-required={required} className="text-input" onChange={(event) => onChange(event.target.value)} placeholder="Write your response…" type={type} value={typeof value === 'string' ? value : ''} />
}
