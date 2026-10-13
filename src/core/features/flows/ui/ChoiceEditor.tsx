import { Plus } from 'lucide-react'
import { ulid } from 'ulid'
import { choiceValue, type EditableChoice } from '../authoring'

export function ChoiceEditor({ choices, onChange, disabled }: { choices: EditableChoice[]; onChange: (update: (current: EditableChoice[]) => EditableChoice[]) => void; disabled: boolean }) {
  const rename = (index: number, label: string) => onChange(current => {
    const choice = current[index]
    const taken = current.filter((_, position) => position !== index).map(item => item.value)
    const generated = !choice.id && (!choice.value || choice.value === choiceValue(choice.label, taken))
    return current.map((entry, position) => position === index ? { ...entry, label, value: generated ? choiceValue(label, taken) : entry.value } : entry)
  })
  return <div className="choice-editor">
    <div className="toggle-row"><strong>Choices</strong><button disabled={disabled} className="secondary-button focus-ring" onClick={() => onChange(current => [...current, { newId: ulid(), value: '', label: '' }])} type="button"><Plus aria-hidden="true" size={14} /> Choice</button></div>
    {choices.map((choice, index) => <div className="choice-editor-row" key={choice.id ?? choice.newId}>
      <label className="inspector-field">Choice {index + 1}<input disabled={disabled} aria-label={`Choice ${index + 1} label`} className="text-input" onChange={event => rename(index, event.target.value)} placeholder="Choice label" value={choice.label} /></label>
      <button disabled={disabled} className="quiet-button focus-ring" onClick={() => onChange(current => current.filter((_, position) => position !== index))} type="button">Remove</button>
      <details><summary className="focus-ring">Advanced</summary><label className="inspector-field">Answer value<input disabled={disabled} aria-label={`Choice ${index + 1} value`} className="text-input" onChange={event => onChange(current => current.map((entry, position) => position === index ? { ...entry, value: event.target.value } : entry))} value={choice.value} /></label><p className="muted">Used in exports. Keep it unchanged when renaming a saved choice.</p></details>
    </div>)}
  </div>
}
