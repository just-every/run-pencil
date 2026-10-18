import { useId, useState } from 'react'
import { ulid } from 'ulid'
import { choiceLists, type ListChoice } from '../../../shared/choiceLists'
import { choiceValue, type EditableChoice } from '../authoring'

type Props = { choices: EditableChoice[]; onChange: (update: (current: EditableChoice[]) => EditableChoice[]) => void; disabled: boolean }
type Source = 'paste' | keyof typeof choiceLists

function review(entries: ListChoice[], choices: EditableChoice[]) {
  const labels = new Map(choices.map((choice, index) => [choice.label.trim().toLocaleLowerCase(), `existing choice ${index + 1}`]))
  const values = new Map(choices.map((choice, index) => [choice.value, `existing choice ${index + 1}`]))
  const issues: string[] = []
  entries.forEach((entry, index) => {
    const line = `Line ${index + 1}`, label = entry.label.toLocaleLowerCase()
    if (!entry.label) issues.push(`${line} is blank.`)
    else if (labels.has(label)) issues.push(`${line}: duplicate “${entry.label}” (${labels.get(label)}).`)
    else labels.set(label, `line ${index + 1}`)
    if (entry.label.length > 300) issues.push(`${line}: “${entry.label}” exceeds 300 characters.`)
    if (entry.value && values.has(entry.value)) issues.push(`${line}: answer value “${entry.value}” is already used by ${values.get(entry.value)}.`)
    else if (entry.value) values.set(entry.value, `line ${index + 1}`)
  })
  return issues
}

export function ChoiceBulkEditor({ choices, onChange, disabled }: Props) {
  const id = useId()
  const [source, setSource] = useState<Source>('paste')
  const [text, setText] = useState('')
  const [notice, setNotice] = useState('')
  const entries: ListChoice[] = source === 'paste'
    ? text ? text.split(/\r\n|\r|\n/).map(label => ({ label: label.trim(), value: '' })) : []
    : choiceLists[source].choices
  const issues = review(entries, choices)
  const add = () => {
    if (disabled || !entries.length || issues.length) return
    onChange(current => {
      const taken = current.map(choice => choice.value)
      const additions = entries.map(entry => {
        const value = entry.value || choiceValue(entry.label, taken)
        taken.push(value)
        return { newId: ulid(), label: entry.label, value }
      })
      return [...current, ...additions]
    })
    setNotice(`${entries.length} choices added. You can edit their labels and answer values below.`)
    setText('')
    setSource('paste')
  }
  return <details>
    <summary className="focus-ring">Paste choices or insert a built-in list</summary>
    <div className="answer-stack">
      <label className="inspector-field">Choice source<select disabled={disabled} className="text-input" value={source} onChange={event => { setSource(event.target.value as Source); setNotice('') }}>
        <option value="paste">Paste one choice per line</option>
        {Object.entries(choiceLists).map(([value, list]) => <option key={value} value={value}>{list.label}</option>)}
      </select></label>
      {source === 'paste' ? <label className="inspector-field">Choices to add<textarea disabled={disabled} className="text-input" rows={8} value={text} aria-invalid={issues.length > 0} aria-describedby={`${id}-review`} onChange={event => { setText(event.target.value); setNotice('') }} /></label> : <>
        <p className="muted">{source === 'countries' ? 'Country answer values use ISO 3166-1 alpha-2 codes.' : 'State and territory answer values use USPS codes.'}</p>
        <details><summary className="focus-ring">Preview {entries.length} choices</summary><ul>{entries.map(entry => <li key={entry.value}>{entry.label} ({entry.value})</li>)}</ul></details>
      </>}
      <div id={`${id}-review`} aria-live="polite">
        {issues.length ? <ul>{issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul> : entries.length ? <p>{entries.length} choices ready to add.</p> : null}
      </div>
      <button disabled={disabled || !entries.length || issues.length > 0} className="secondary-button focus-ring" type="button" onClick={add}>Add choices</button>
      {notice ? <p role="status">{notice}</p> : null}
    </div>
  </details>
}
