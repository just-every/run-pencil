import { useId, useState } from 'react'
import type { FlowStep } from '../../app/api'
import { calendarDate } from '../questionTypes'
import { dateFormat } from '../dateFormat'

export function CalendarDateInput({ step, value, onChange }: { step: FlowStep; value: unknown; onChange: (value: unknown) => void }) {
  const id = useId()
  const [parts, setParts] = useState(() => {
    const [year = '', month = '', day = ''] = typeof value === 'string' ? value.split('-') : []
    return { year, month, day } as Record<string, string>
  })
  const format = dateFormat(step.questionSettings ?? {})
  const change = (part: string, text: string) => {
    const next = { ...parts, [part]: text }
    setParts(next)
    onChange(Object.values(next).every(value => !value) ? undefined : `${next.year}-${next.month.padStart(2, '0')}-${next.day.padStart(2, '0')}`)
  }
  return <div className="answer-stack" role="group" aria-label={step.prompt} aria-describedby={`${id}-format`}>
    <p id={`${id}-format`} className="muted">Date format: {format.label}</p>
    <div style={{ display: 'flex', alignItems: 'end', gap: '.5rem', minWidth: 0 }}>
      {format.order.map((part, index) => <div key={part} style={{ display: 'contents' }}>
        {index ? <span aria-hidden="true" style={{ paddingBottom: '.7rem' }}>{format.separator}</span> : null}
        <label style={{ flex: part === 'year' ? 1.3 : 1, minWidth: 0 }}>{part[0].toUpperCase() + part.slice(1)}
          <input className="text-input" style={{ width: '100%', minWidth: 0 }} aria-required={step.required} aria-invalid={value !== undefined && !calendarDate(value)} inputMode="numeric" autoComplete="off" maxLength={part === 'year' ? 4 : 2} value={parts[part]} onChange={event => change(part, event.target.value)} aria-describedby={`${id}-format`} />
        </label>
      </div>)}
    </div>
  </div>
}
