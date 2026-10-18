import { useAnswerAccessibility } from './AnswerFieldset'
import type { CSSProperties } from 'react'
import { Star } from 'lucide-react'
import type { FlowStep } from '../../app/api'
import { ratingScale, ratingSettingsValid } from '../ratingScale'
import { moveAnswerFocus } from './answerKeyboard'
import './rating-scale.css'

type Props = { step: FlowStep; value: unknown; onChange: (value: unknown) => void }

export function RatingInput({ step, value, onChange }: Props) {
  const accessibility = useAnswerAccessibility()
  const settings = step.questionSettings ?? {}
  if (!ratingSettingsValid(settings)) return <p role="status">Choose a scale starting at 0 or 1, with 2 to 11 steps and labels up to 100 characters.</p>
  const { min, max, steps, lowLabel, middleLabel, highLabel } = ratingScale(settings)
  const labelled = Boolean(lowLabel || middleLabel || highLabel)
  const numeric = labelled || min !== 1 || max > 5
  const selected = typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
  const middle = (min + max) / 2
  const style = { '--rating-steps': steps } as CSSProperties

  return <div className="rating-scale" data-numeric={numeric} style={style}>
    {labelled ? <div className="rating-scale__labels" aria-hidden="true">
      <span className="rating-scale__low">{lowLabel}</span>
      <span className="rating-scale__middle">{middleLabel}</span>
      <span className="rating-scale__high">{highLabel}</span>
    </div> : null}
    <div {...accessibility()} role="radiogroup" aria-required={step.required} className="rating-row rating-scale__options" aria-label={`${step.prompt} rating`}>
      {Array.from({ length: steps }, (_, offset) => min + offset).map(rating => {
        // With an even count the middle label belongs to the two adjacent steps.
        const labels = [rating === min ? lowLabel : '', Math.abs(rating - middle) <= 0.5 ? middleLabel : '', rating === max ? highLabel : ''].filter(Boolean)
        return <button
          aria-label={`${rating} out of ${max}${labels.length ? `, ${labels.join(', ')}` : ''}`}
          role="radio"
          aria-checked={value === rating}
          tabIndex={value === rating || (!selected && rating === min) ? 0 : -1}
          onKeyDown={event => moveAnswerFocus(event, true)}
          className="rating-button focus-ring"
          data-selected={value === rating}
          key={rating}
          onClick={() => onChange(rating)}
          type="button"
        >{numeric ? <span>{rating}</span> : <Star aria-hidden="true" fill={value === rating ? 'currentColor' : 'none'} size={24} />}</button>
      })}
    </div>
  </div>
}
