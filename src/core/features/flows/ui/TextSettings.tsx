import { useId } from 'react'
import type { FlowStep } from '../../../app/api'
import { TEXT_MESSAGE_LIMIT, TEXT_PATTERN_LIMIT, textSettingsIssue, textTypeLimit } from '../../../shared/textValidation'

type Props = { type: FlowStep['questionType']; settings: Record<string, unknown>; onChange: (key: string, value: unknown) => void; disabled: boolean }

export function TextSettings({ type, settings, onChange, disabled }: Props) {
  const id = useId()
  if (type !== 'short_text' && type !== 'long_text') return null
  const limit = textTypeLimit(type)
  const issue = textSettingsIssue(type, settings)
  const fieldValue = (key: string) => typeof settings[key] === 'string' || typeof settings[key] === 'number' ? settings[key] as string | number : ''
  return <>
    <p className="muted" id={`${id}-limits`}>Optional character limits, up to {limit.toLocaleString('en-US')} characters for this question type.</p>
    {(['minLength', 'maxLength'] as const).map(key => <label className="inspector-field" key={key}>
      {key === 'minLength' ? 'Minimum characters' : 'Maximum characters'}
      <input className="text-input" type="number" min={0} max={limit} step={1} disabled={disabled} value={fieldValue(key)} aria-describedby={`${id}-limits${issue ? ` ${id}-error` : ''}`} onChange={event => onChange(key, event.target.value === '' ? undefined : event.target.valueAsNumber)} />
    </label>)}
    {type === 'short_text' ? <>
      <label className="inspector-field">Input mask
        <input aria-label="Input mask" className="text-input" type="text" disabled={disabled} maxLength={limit} value={fieldValue('inputMask')} placeholder="###-####" aria-describedby={`${id}-mask`} onChange={event => onChange('inputMask', event.target.value === '' ? undefined : event.target.value)} />
        <span className="muted" id={`${id}-mask`}># is a digit, @ an A–Z letter, * a letter or digit. Other characters must be entered literally.</span>
      </label>
      <label className="inspector-field">Validation pattern
        <input aria-label="Validation pattern" className="text-input" type="text" disabled={disabled} maxLength={TEXT_PATTERN_LIMIT} value={fieldValue('pattern')} placeholder="^[A-Z]{2}-[0-9]{4}$" aria-describedby={`${id}-pattern${issue ? ` ${id}-error` : ''}`} onChange={event => onChange('pattern', event.target.value === '' ? undefined : event.target.value)} />
        <span className="muted" id={`${id}-pattern`}>Matches the whole answer. Use literals, [A-Z] ranges, [^0-9] exclusions, \d, \w, \s, dot, and ?, *, +, {'{n}'}, {'{n,m}'} or {'{n,}'} repetitions. Optional ^ and $ anchors. No groups, alternatives, backreferences or lookaround. Maximum {TEXT_PATTERN_LIMIT} characters; repetition bounds up to {textTypeLimit('short_text')}.</span>
      </label>
    </> : null}
    <label className="inspector-field">Custom validation message
      <input aria-label="Custom validation message" className="text-input" type="text" disabled={disabled} maxLength={TEXT_MESSAGE_LIMIT} value={fieldValue('validationMessage')} placeholder="Explain the response you need" aria-describedby={`${id}-message`} onChange={event => onChange('validationMessage', event.target.value === '' ? undefined : event.target.value)} />
      <span className="muted" id={`${id}-message`}>Shown when an answer fails a character limit{type === 'short_text' ? ', mask or pattern' : ''}. Leave blank to use the standard message.</span>
    </label>
    {issue ? <p className="status-note" data-tone="error" role="alert" id={`${id}-error`}>{issue}</p> : null}
  </>
}
