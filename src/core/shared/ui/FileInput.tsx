import { useState, type InputHTMLAttributes } from 'react'
import './file-input.css'

/** The app's file field: a field-style box that shows the chosen file's name, with the native input laid over it. */
export function FileInput({ onChange, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'className'>) {
  const [name, setName] = useState<string>()
  return <span className="file-field">
    <input {...props} type="file" className="file-field__input" onChange={event => { setName(event.target.files?.[0]?.name); onChange?.(event) }} />
    {/* The box is drawn, not read: the input keeps its own name and state for assistive technology, and the label's text stays the label. */}
    <span className="file-field__box text-input" aria-hidden="true" data-name={name ?? 'No file chosen'} data-empty={!name || undefined} />
  </span>
}
