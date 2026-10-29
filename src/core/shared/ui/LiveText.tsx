import { useEffect, useRef, useState } from 'react'

/** A text field that applies as the owner types: it commits after a short pause, on blur and on Enter. */
export function LiveText({ label, value, maxLength, placeholder, type = 'text', onCommit }: { label: string; value: string; maxLength?: number; placeholder?: string; type?: 'text' | 'search'; onCommit: (value: string) => void }) {
  const [text, setText] = useState(value)
  const committed = useRef(value)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => { committed.current = value; setText(value) }, [value])
  useEffect(() => () => clearTimeout(timer.current), [])
  const commit = (next: string) => { clearTimeout(timer.current); if (next !== committed.current) { committed.current = next; onCommit(next) } }
  return <label className="inspector-field">{label}<input className="text-input" type={type} maxLength={maxLength} placeholder={placeholder} value={text} onChange={event => { setText(event.target.value); clearTimeout(timer.current); const next = event.target.value; timer.current = setTimeout(() => commit(next), 350) }} onBlur={() => commit(text)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); commit(text) } }} /></label>
}
