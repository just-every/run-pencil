import { useId, useState } from 'react'
import { Check } from 'lucide-react'
import type { ChoiceOption, FlowStep } from '../../app/api'
import { makeChoiceAnswer, otherChoiceText, otherTextSettings, selectedChoiceIds, toggleChoiceAnswer } from '../choiceAnswers'
import { moveAnswerFocus } from './answerKeyboard'
import { TextQuestionInput } from './TextQuestionInput'
import './choice-write-in.css'

export function ChoiceQuestionInput({ step, choices, value, onChange }: { step: FlowStep; choices: ChoiceOption[]; value: unknown; onChange: (value: unknown) => void }) {
  const [search, setSearch] = useState(''), searchId = useId()
  const settings = step.questionSettings ?? {}, selected = selectedChoiceIds(value)
  const multiple = step.questionType === 'multiple_choice'
  const other = choices.find(choice => choice.id === settings.otherChoiceId && selected.includes(choice.id))
  return <div className="answer-stack">
    {step.questionType === 'dropdown' ? <>
      <label htmlFor={searchId}>Search options</label>
      <input id={searchId} className="text-input" type="search" value={search} onChange={event => setSearch(event.target.value)} />
      <select aria-label={step.prompt} aria-required={step.required} className="text-input" value={selected[0] ?? ''} onChange={event => onChange(event.target.value ? toggleChoiceAnswer(step.questionType!, settings, value, event.target.value) : undefined)}>
        <option value="">Choose an option</option>
        {choices.filter(choice => selected.includes(choice.id) || choice.label.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map(choice => <option key={choice.id} value={choice.id}>{choice.label}</option>)}
      </select>
    </> : <div className="answer-stack" role={multiple ? 'listbox' : 'radiogroup'} aria-label={step.prompt} aria-required={step.required} aria-multiselectable={multiple || undefined}>
      {choices.map(choice => {
        const checked = selected.includes(choice.id)
        return <button key={choice.id} className="choice-button focus-ring" type="button" role={multiple ? 'option' : 'radio'} aria-selected={multiple ? checked : undefined} aria-checked={multiple ? undefined : checked}
          data-selected={checked} tabIndex={choice.id === (selected[0] ?? choices[0]?.id) ? 0 : -1} onKeyDown={event => moveAnswerFocus(event, !multiple)}
          onClick={() => onChange(toggleChoiceAnswer(step.questionType!, settings, value, choice.id, !multiple || !checked))}>
          <span className="choice-indicator">{checked ? <Check aria-hidden="true" size={14} /> : null}</span>{choice.label}
        </button>
      })}
    </div>}
    {other ? <div className="choice-write-in">
      <p className="choice-write-in__label">Please specify: {other.label}</p>
      <TextQuestionInput step={{ ...step, prompt: `Please specify: ${other.label}`, questionType: 'short_text', required: true, questionSettings: otherTextSettings(settings) }} choices={[]} value={otherChoiceText(value)} onChange={text => onChange(makeChoiceAnswer(step.questionType!, settings, selected, String(text)))} />
    </div> : null}
  </div>
}
