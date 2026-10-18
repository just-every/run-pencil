import { useAnswerAccessibility } from './AnswerFieldset'
import { CalendarDateInput } from './CalendarDateInput'
import { useId } from 'react'
import type { FlowStep, ChoiceOption } from '../../app/api'

type Props = { step: FlowStep; choices: ChoiceOption[]; value: unknown; onChange: (value: unknown) => void }
export function ExtendedQuestionInput({ step, value, onChange }: Props) {
  const accessibility = useAnswerAccessibility()
  const controlId = useId()
  const required = step.required
  const settings = step.questionSettings ?? {}
  if (step.questionType === 'yes_no') return <div className="answer-stack" role="radiogroup" {...accessibility()} aria-label={step.prompt} aria-required={required}>
    {[true, false].map(answer => <label className="choice-button" key={String(answer)}>
      <input type="radio" name={controlId} checked={value === answer} onChange={() => onChange(answer)} />{answer ? 'Yes' : 'No'}
    </label>)}
  </div>
  if (step.questionType === 'consent') return <label className="choice-button">
    <input aria-label={step.prompt} aria-required={required} {...accessibility(`${controlId}-statement`)} type="checkbox" checked={value === true} onChange={event => onChange(event.target.checked)} />
    <span id={`${controlId}-statement`}>{String(settings.statement ?? '')}</span>
  </label>
  if (step.questionType === 'date') return <CalendarDateInput step={step} value={value} onChange={onChange} />
  if (step.questionType === 'number') {
    // Keep the native editing buffer while a minus sign, fraction or date segment
    // is incomplete. Only complete numeric/calendar values enter answer state.
    return <input {...accessibility()} key={`${step.id}-${step.questionType}`} aria-label={step.prompt} aria-required={required} className="text-input" type="number"
      min={settings.min as number | undefined}
      max={settings.max as number | undefined}
      step={settings.decimalPlaces === undefined ? 'any' : 10 ** -Number(settings.decimalPlaces)}
      defaultValue={typeof value === 'number' || typeof value === 'string' ? value : ''}
      onInput={event => onChange(event.currentTarget.value === '' ? undefined : event.currentTarget.valueAsNumber)} />
  }
  if (step.questionType === 'nps') return <div className="answer-stack">
    <div role="radiogroup" aria-label={step.prompt} aria-required={required} {...accessibility(`${controlId}-low ${controlId}-high`)} className="nps-row">
      {Array.from({ length: 11 }, (_, score) => <label className="choice-button" key={score}>
        <input type="radio" name={controlId} checked={value === score} onChange={() => onChange(score)} />{score}
      </label>)}
    </div>
    <div className="respondent-top"><span id={`${controlId}-low`}>{String(settings.lowLabel ?? 'Not at all likely')}</span><span id={`${controlId}-high`}>{String(settings.highLabel ?? 'Extremely likely')}</span></div>
  </div>
  return null
}
