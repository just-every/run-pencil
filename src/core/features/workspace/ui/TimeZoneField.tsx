import { useId, useState } from 'react'

const zones = ['UTC', ...Intl.supportedValuesOf('timeZone')]
export function canonicalTimeZone(input: string) {
  const match = zones.find(zone => zone.toLowerCase() === input.trim().toLowerCase())
  if (match) return match
  return undefined
}
export function TimeZoneField({ value, disabled, onChange, error }: { value: string; disabled: boolean; onChange: (value: string) => void; error?: string }) {
  const id = useId()
  const [focused, setFocused] = useState(false)
  const matches = zones.filter(zone => zone.toLowerCase().includes(value.toLowerCase())).slice(0, 12)
  return <div className="time-zone-field" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setFocused(false) }}>
    <label className="inspector-field" htmlFor={id}>Time zone</label>
    <input id={id} disabled={disabled} autoComplete="off" className="text-input" required value={value}
      onFocus={() => setFocused(true)} onChange={event => onChange(event.target.value)}
      aria-invalid={!!error} aria-describedby={`${id}-help${error ? ` ${id}-error` : ''}`} />
    {focused && value && matches.length > 0 && !matches.includes(value) ? <ul aria-label="Matching time zones" className="time-zone-matches">{matches.map(zone => <li key={zone}><button className="quiet-button focus-ring" type="button" onMouseDown={event => event.preventDefault()} onClick={() => { onChange(zone); setFocused(false) }}>{zone}</button></li>)}</ul> : null}
    {error ? <p id={`${id}-error`} className="status-note" data-tone="error" role="alert">{error}</p> : null}
    <p id={`${id}-help`} className="muted settings-help">Search a city or choose UTC. Published deadlines keep their original zone.</p>
  </div>
}
