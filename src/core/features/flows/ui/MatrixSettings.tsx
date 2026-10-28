import { matrixRows, matrixModes } from '../../../shared/matrix'
import type { EditableChoice } from '../authoring'

type Props = { settings: Record<string, unknown>; disabled: boolean; onSettings: (settings: Record<string, unknown>) => void; choices: EditableChoice[]; onChoices: (choices: EditableChoice[]) => void }
export function MatrixSettings({ settings, disabled, onSettings, onChoices }: Props) {
  const rows = matrixRows(settings)
  const names = { single: 'Single choice per row', multiple: 'Multiple choices per row', likert5: '5-point Likert', likert7: '7-point Likert' }
  return <fieldset className="plain-fieldset answer-stack" disabled={disabled}><legend>Matrix settings</legend>
    <label className="inspector-field">Shared scale<select className="text-input" value={String(settings.matrixMode ?? 'single')} onChange={event => {
      const mode = event.target.value
      onSettings({ ...settings, matrixMode: mode })
      if (mode === 'likert5' || mode === 'likert7') {
        const labels = mode === 'likert5' ? ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'] : ['Strongly disagree', 'Disagree', 'Somewhat disagree', 'Neutral', 'Somewhat agree', 'Agree', 'Strongly agree']
        onChoices(labels.map((label, index) => ({ newId: crypto.randomUUID(), value: String(index + 1), label })))
      }
    }}>{matrixModes.map(mode => <option key={mode} value={mode}>{names[mode]}</option>)}</select></label>
    {rows.map((row, index) => <div className="answer-stack" key={row.id}>
      <label className="inspector-field">Row {index + 1}<input className="text-input" maxLength={300} value={row.label} onChange={event => onSettings({ ...settings, matrixRows: rows.map(item => item.id === row.id ? { ...item, label: event.target.value } : item) })} /></label>
      <div className="builder-actions"><button className="quiet-button" type="button" disabled={index === 0} onClick={() => { const next = [...rows]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; onSettings({ ...settings, matrixRows: next }) }}>Move row {index + 1} up</button><button className="quiet-button" type="button" disabled={rows.length === 1} onClick={() => onSettings({ ...settings, matrixRows: rows.filter(item => item.id !== row.id) })}>Remove row {index + 1}</button></div>
    </div>)}
    <button className="secondary-button" type="button" disabled={rows.length >= 50} onClick={() => onSettings({ ...settings, matrixRows: [...rows, { id: crypto.randomUUID(), label: `Row ${rows.length + 1}` }] })}>Add matrix row</button>
  </fieldset>
}
