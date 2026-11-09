import { useId } from 'react'
import { questionVideoFromUrl, questionVideoUrl, questionVideoValid } from '../../../shared/questionVideo'

export function QuestionVideoSettings({ value, disabled, onChange }: { value: unknown; disabled: boolean; onChange: (value: unknown) => void }) {
  const id = useId()
  const url = questionVideoValid(value) ? questionVideoUrl(value) : typeof value === 'string' ? value : ''
  const invalid = value !== undefined && !questionVideoValid(value)
  return <details><summary className="focus-ring">Video</summary>
    <label className="inspector-field">Video URL<input className="text-input" type="url" value={url} disabled={disabled} maxLength={300}
      aria-invalid={invalid || undefined} aria-describedby={id} placeholder="Optional YouTube or Vimeo link"
      onChange={event => { const text = event.target.value; onChange(text.trim() ? questionVideoFromUrl(text) ?? text : undefined) }} /></label>
    <p id={id} className="status-note" role={invalid ? 'alert' : undefined}>{invalid ? 'Use an HTTPS YouTube watch link, a youtu.be link or a public Vimeo video link.' : 'Optional. The video provider connects only after Play.'}</p>
  </details>
}
