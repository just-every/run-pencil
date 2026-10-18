import { useAnswerAccessibility } from './AnswerFieldset'
import { ThumbsDown, ThumbsUp } from 'lucide-react'
import type { FlowStep } from '../../app/api'
import { scoreOptions } from '../scoreQuestions'
import { moveAnswerFocus } from './answerKeyboard'
import './score-questions.css'

const faces = ['😞', '🙁', '😐', '🙂', '😃']

export function ScoreQuestionInput({ step, value, onChange }: { step: FlowStep; value: unknown; onChange: (value: unknown) => void }) {
  const accessibility = useAnswerAccessibility()
  const options = scoreOptions(step.questionType ?? '')
  const thumbs = step.questionType === 'thumbs_rating'
  const selected = options.some(option => option.value === value)
  return <div className="answer-stack">
    {!thumbs ? <div className="score-end-labels" aria-hidden="true"><span>{options[0].label}</span><span>{options.at(-1)!.label}</span></div> : null}
    <div className="score-options" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }} role="radiogroup" {...accessibility()} aria-label={step.prompt} aria-required={step.required}>
      {options.map((option, index) => <button
        key={String(option.value)} type="button" role="radio"
        aria-label={typeof option.value === 'number' ? `${option.value}, ${option.label}` : option.label}
        aria-checked={value === option.value}
        tabIndex={value === option.value || (!selected && index === 0) ? 0 : -1}
        onKeyDown={event => moveAnswerFocus(event, true)}
        onClick={() => onChange(option.value)}
        className="score-option focus-ring" data-selected={value === option.value}
      >{thumbs ? <>{option.value ? <ThumbsUp aria-hidden="true" size={22} /> : <ThumbsDown aria-hidden="true" size={22} />}<span>{option.label}</span></> : step.questionType === 'emoji_rating' ? <><span className="score-face" aria-hidden="true">{faces[index]}</span><span>{option.value}</span></> : option.value}</button>)}
    </div>
  </div>
}
