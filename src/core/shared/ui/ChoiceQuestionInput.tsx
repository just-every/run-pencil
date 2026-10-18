import { useId, useState } from 'react'
import { Check } from 'lucide-react'
import type { FlowStep, ChoiceOption } from '../../app/api'
import { isOtherAnswer, selectedChoiceIds } from '../otherChoices'
import { moveAnswerFocus } from './answerKeyboard'
import { TextQuestionInput } from './TextQuestionInput'

export function ChoiceQuestionInput({ step, choices, value, onChange }: { step: FlowStep; choices: ChoiceOption[]; value: unknown; onChange: (value: unknown) => void }) {
  const [search, setSearch] = useState('')
  const controlId = useId()
  const settings = step.questionSettings ?? {}
  const multiple = step.questionType === 'multiple_choice'
  const selected = selectedChoiceIds(value)
  const choose = (id: string) => {
    let next = multiple ? selected.includes(id) ? selected.filter(item => item !== id) : [...selected.filter(item => item !== settings.noneChoiceId), id] : id ? [id] : []
    if (id === settings.noneChoiceId) next = selected.includes(id) ? [] : [id]
    onChange(next.includes(String(settings.otherChoiceId)) ? { choiceIds: next, otherText: isOtherAnswer(value) ? value.otherText : '' } : multiple ? next : next[0])
  }
  const other = choices.find(choice => choice.id === settings.otherChoiceId)
  return <div className="answer-stack">
    {step.questionType === 'dropdown' ? <><label htmlFor={controlId}>Search options</label><input id={controlId} className="text-input" type="search" value={search} onChange={event => setSearch(event.target.value)} /><select className="text-input" aria-label={step.prompt} aria-required={step.required} value={selected[0] ?? ''} onChange={event => choose(event.target.value)}><option value="">Choose an option…</option>{choices.filter(choice => selected.includes(choice.id) || choice.label.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map(choice => <option key={choice.id} value={choice.id}>{choice.label}</option>)}</select></> :
      <div className="answer-stack" role={multiple ? 'listbox' : 'radiogroup'} aria-label={step.prompt} aria-required={step.required} aria-multiselectable={multiple || undefined}>
        {choices.map(choice => {
          const checked = selected.includes(choice.id)
          return <button key={choice.id} className="choice-button focus-ring" type="button" role={multiple ? 'option' : 'radio'} aria-checked={multiple ? undefined : checked} aria-selected={multiple ? checked : undefined} data-selected={checked} tabIndex={choice.id === (selected[0] ?? choices[0]?.id) ? 0 : -1} onKeyDown={event => moveAnswerFocus(event, !multiple)} onClick={() => choose(choice.id)}><span className="choice-indicator">{checked ? <Check aria-hidden="true" size={14} /> : null}</span>{choice.label}</button>
        })}
      </div>}
    {other && selected.includes(other.id) ? <label className="inspector-field">Please specify: {other.label}<TextQuestionInput step={{ ...step, prompt: `Please specify: ${other.label}`, questionType: 'short_text', required: true, questionSettings: settings.otherValidation as Record<string, unknown> ?? {} }} choices={[]} value={isOtherAnswer(value) ? value.otherText : ''} onChange={otherText => onChange({ choiceIds: selected, otherText })} /></label> : null}
  </div>
}
