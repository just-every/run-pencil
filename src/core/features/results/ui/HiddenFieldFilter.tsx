import type { HiddenField } from '../../../shared/hiddenFields'

type Field = Pick<HiddenField, 'id' | 'name' | 'type'>

export function HiddenFieldFilter({ field, value, label = 'Hidden value equals', onChange }: { field: Field; value?: string; label?: string; onChange: (value: string | undefined) => void }) {
  const displayed = value === undefined ? '' : String(JSON.parse(value))
  return <label className="inspector-field">{label}
    {field.type === 'boolean' ? <select className="text-input" value={displayed} onChange={event => onChange(event.target.value || undefined)}>
      <option value="">Any value</option><option value="true">True</option><option value="false">False</option>
    </select> : <input className="text-input" type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'email' ? 'email' : 'text'} step={field.type === 'number' ? 'any' : undefined} value={displayed} onChange={event => {
      const raw = event.target.value
      if (!raw) { onChange(undefined); return }
      const next = field.type === 'number' ? event.target.valueAsNumber : raw
      if (typeof next !== 'number' || Number.isFinite(next)) onChange(JSON.stringify(next))
    }} />}
  </label>
}
