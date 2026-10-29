import { ulid } from 'ulid'
import type { EditableChoice } from '../authoring'
import { TextSettings } from './TextSettings'

export function SpecialChoicesEditor({ type, choices, settings, disabled, onChoices, onSettings }: { type: string | null; choices: EditableChoice[]; settings: Record<string, unknown>; disabled: boolean; onChoices: (value: EditableChoice[]) => void; onSettings: (value: Record<string, unknown>) => void }) {
  if (!['single_choice', 'multiple_choice', 'dropdown'].includes(type ?? '')) return null
  const toggle = (key: string, label: string) => {
    const next = { ...settings }
    if (next[key]) { onChoices(choices.filter(choice => (choice.id ?? choice.newId) !== next[key])); delete next[key] }
    else { const id = ulid(); next[key] = id; onChoices([...choices, { newId: id, value: id, label }]) }
    onSettings(next)
  }
  return <div className="answer-stack">
    <label className="toggle-row"><span>Allow Other write-in</span><input type="checkbox" disabled={disabled} checked={Boolean(settings.otherChoiceId)} onChange={() => toggle('otherChoiceId', 'Other')} /></label>
    {type === 'multiple_choice' ? <label className="toggle-row"><span>Allow None of the above</span><input type="checkbox" disabled={disabled} checked={Boolean(settings.noneChoiceId)} onChange={() => toggle('noneChoiceId', 'None of the above')} /></label> : null}
    {settings.otherChoiceId ? <details><summary className="focus-ring">Other answer validation</summary><TextSettings folded={false} type="short_text" settings={settings.otherValidation as Record<string, unknown> ?? {}} disabled={disabled} onChange={(key, value) => { const validation = { ...(settings.otherValidation as Record<string, unknown> ?? {}) }; if (value === undefined) delete validation[key]; else validation[key] = value; onSettings({ ...settings, otherValidation: validation }) }} /></details> : null}
  </div>
}
