import { ulid } from 'ulid'
import type { EditableChoice } from '../authoring'
import { otherTextSettings } from '../../../shared/choiceAnswers'
import { TextSettings } from './TextSettings'
import './choice-settings.css'

export function ChoiceSettings({ multiple, choices, settings, disabled, onChange }: { multiple: boolean; choices: EditableChoice[]; settings: Record<string, unknown>; disabled: boolean; onChange: (settings: Record<string, unknown>, choices: EditableChoice[]) => void }) {
  const toggle = (key: 'otherChoiceId' | 'noneChoiceId', enabled: boolean) => {
    const next = { ...settings }, previous = next[key]
    let options = choices
    if (enabled) {
      const id = ulid(), other = key === 'otherChoiceId'
      next[key] = id; options = [...choices, { newId: id, value: other ? 'other' : 'none', label: other ? 'Other' : 'None of these' }]
    } else {
      delete next[key]; if (key === 'otherChoiceId') delete next.otherText
      options = choices.filter(choice => (choice.id ?? choice.newId) !== previous)
    }
    onChange(next, options)
  }
  return <details className="choice-settings">
    <summary className="focus-ring">Other and None options</summary>
    <label className="choice-settings__check"><input type="checkbox" disabled={disabled} checked={typeof settings.otherChoiceId === 'string'} onChange={event => toggle('otherChoiceId', event.target.checked)} /> Enable Other (write-in)</label>
    {multiple ? <label className="choice-settings__check"><input type="checkbox" disabled={disabled} checked={typeof settings.noneChoiceId === 'string'} onChange={event => toggle('noneChoiceId', event.target.checked)} /> Enable None of these (exclusive)</label> : null}
    <p className="muted">Edit these labels in Choices. None clears the other selections. Other requires a written answer while selected.</p>
    {settings.otherChoiceId ? <details className="choice-settings__limits"><summary className="focus-ring">Write-in text limits</summary><TextSettings type="short_text" disabled={disabled} settings={otherTextSettings(settings)} onChange={(key, value) => {
      const text = { ...otherTextSettings(settings) }; if (value === undefined) delete text[key]; else text[key] = value
      const next = { ...settings }; if (Object.keys(text).length) next.otherText = text; else delete next.otherText
      onChange(next, choices)
    }} /></details> : null}
  </details>
}
