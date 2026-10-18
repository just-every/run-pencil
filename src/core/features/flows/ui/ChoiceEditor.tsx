import { Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ulid } from 'ulid'
import { choiceValue, type EditableChoice } from '../authoring'
import { ChoiceBulkEditor } from './ChoiceBulkEditor'

export function ChoiceEditor({ choices, onChange, disabled }: { choices: EditableChoice[]; onChange: (update: (current: EditableChoice[]) => EditableChoice[]) => void; disabled: boolean }) {
  const [page, setPage] = useState(0)
  const lastPage = Math.max(0, Math.ceil(choices.length / 25) - 1)
  const currentPage = Math.min(page, lastPage)
  const start = currentPage * 25
  useEffect(() => { setPage(current => Math.min(current, lastPage)) }, [lastPage])
  const rename = (index: number, label: string) => onChange(current => {
    const choice = current[index]
    const taken = current.filter((_, position) => position !== index).map(item => item.value)
    const generated = !choice.id && (!choice.value || choice.value === choiceValue(choice.label, taken))
    return current.map((entry, position) => position === index ? { ...entry, label, value: generated ? choiceValue(label, taken) : entry.value } : entry)
  })
  return <div className="choice-editor">
    <div className="toggle-row"><strong>Choices</strong><button disabled={disabled} className="secondary-button focus-ring" onClick={() => onChange(current => [...current, { newId: ulid(), value: '', label: '' }])} type="button"><Plus aria-hidden="true" size={14} /> Choice</button></div>
    <ChoiceBulkEditor choices={choices} onChange={onChange} disabled={disabled} />
    {choices.length > 25 ? <nav aria-label="Choice pages" className="answer-stack">
      <p role="status">Choices {start + 1}–{Math.min(start + 25, choices.length)} of {choices.length}</p>
      <div className="toggle-row">
        <button disabled={disabled || currentPage === 0} className="quiet-button focus-ring" type="button" onClick={() => setPage(currentPage - 1)}>Previous choices</button>
        <button disabled={disabled || currentPage === lastPage} className="quiet-button focus-ring" type="button" onClick={() => setPage(currentPage + 1)}>Next choices</button>
      </div>
    </nav> : null}
    {choices.slice(start, start + 25).map((choice, offset) => {
      const index = start + offset
      return <div className="choice-editor-row" key={choice.id ?? choice.newId}>
      <label className="inspector-field">Choice {index + 1}<input disabled={disabled} aria-label={`Choice ${index + 1} label`} className="text-input" onChange={event => rename(index, event.target.value)} placeholder="Choice label" value={choice.label} /></label>
      <button disabled={disabled} className="quiet-button focus-ring" onClick={() => onChange(current => current.filter((_, position) => position !== index))} type="button">Remove</button>
      <details><summary className="focus-ring">Advanced</summary><label className="inspector-field">Answer value<input disabled={disabled} aria-label={`Choice ${index + 1} value`} className="text-input" onChange={event => onChange(current => current.map((entry, position) => position === index ? { ...entry, value: event.target.value } : entry))} value={choice.value} /></label><p className="muted">Used in exports. Keep it unchanged when renaming a saved choice.</p></details>
    </div>})}
  </div>
}
