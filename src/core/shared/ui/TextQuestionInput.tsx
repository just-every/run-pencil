import { useAnswerAccessibility } from './AnswerFieldset'
import { useId } from 'react'
import type { ChoiceOption, FlowStep } from '../../app/api'
import { textAnswerIssue, textTypeLimit } from '../textValidation'

type Props = { step: FlowStep; choices: ChoiceOption[]; value: unknown; onChange: (value: unknown) => void }

export function TextQuestionInput({ step, value, onChange }: Props) {
  const accessibility = useAnswerAccessibility()
  const id = useId()
  const settings = step.questionSettings ?? {}
  const text = typeof value === 'string' ? value : ''
  const maximum = typeof settings.maxLength === 'number' ? settings.maxLength : undefined
  const mask = typeof settings.inputMask === 'string' ? settings.inputMask : undefined
  const issue = text.length ? textAnswerIssue(step.questionType, settings, text) : undefined
  const describedBy = [mask ? `${id}-format` : '', maximum !== undefined ? `${id}-count` : '', issue ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined
  const props = {
    'aria-label': step.prompt,
    'aria-required': step.required,
    ...accessibility(describedBy,Boolean(issue)),
    // Keep the field editable beyond an operator maximum so attempted values
    // receive the same explicit error as API submissions, without truncation.
    maxLength: textTypeLimit(step.questionType),
    placeholder: 'Write your response…',
    value: text,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value),
  }
  return <div className="answer-stack">
    {step.questionType === 'long_text' ? <textarea className="text-area" {...props} /> : <input className="text-input" type="text" {...props} />}
    {mask ? <p className="muted" id={`${id}-format`}>Format: {mask} (# digit, @ letter, * letter or digit).</p> : null}
    {maximum !== undefined ? <p className="muted" id={`${id}-count`} role="status" aria-live="polite" aria-atomic="true">{text.length.toLocaleString('en-US')} / {maximum.toLocaleString('en-US')} characters</p> : null}
    {issue ? <span className="sr-only" id={`${id}-error`}>{issue}</span> : null}
  </div>
}
