import { useId, useState, type ReactNode } from 'react'
import { ListFilter, X } from 'lucide-react'
import { Tooltip } from './Tooltip'
import './filter-bar.css'

export type FilterChip = { key: string; label: string; onRemove: () => void }

/** One Filter control over a list: its fields fold behind it and act at once; what is applied shows as removable chips. */
export function FilterBar({ chips, onClear, clearLabel = 'Clear filters', children }: { chips: FilterChip[]; onClear: () => void; clearLabel?: string; children: ReactNode }) {
  const [open, setOpen] = useState(chips.length > 0)
  const panel = useId()
  return <div className="filter-bar">
    <div className="filter-bar__row">
      <button className="secondary-button focus-ring" type="button" aria-expanded={open} aria-controls={panel} onClick={() => setOpen(value => !value)}><ListFilter aria-hidden="true" size={16} /> Filter</button>
      {chips.length ? <ul className="filter-bar__chips" aria-label="Applied filters">{chips.map(chip => <li className="filter-bar__chip" key={chip.key}>{chip.label}<Tooltip label={`Remove ${chip.key} filter`}><button className="focus-ring" type="button" aria-label={`Remove ${chip.key} filter`} onClick={chip.onRemove}><X aria-hidden="true" size={14} /></button></Tooltip></li>)}</ul> : null}
      {chips.length ? <button className="quiet-button focus-ring" type="button" onClick={onClear}>{clearLabel}</button> : null}
    </div>
    <div className="filter-bar__panel" id={panel} hidden={!open}>{children}</div>
  </div>
}
