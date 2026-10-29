import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import './action-menu.css'

export type ActionMenuItem = { label: string; icon?: ReactNode; onSelect: () => void }

/** One button that opens a short menu of related actions; Escape closes it and returns focus to the button. */
export function ActionMenu({ label, icon, items, disabled = false }: { label: string; icon?: ReactNode; items: ActionMenuItem[]; disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const menu = useId()
  const close = (restoreFocus: boolean) => { setOpen(false); if (restoreFocus) button.current?.focus() }
  useEffect(() => {
    if (!open) return
    root.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])
  const move = (event: React.KeyboardEvent, step: number) => {
    const entries = [...(root.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]
    const index = entries.indexOf(document.activeElement as HTMLElement)
    event.preventDefault(); entries[(index + step + entries.length) % entries.length]?.focus()
  }
  return <div className="action-menu" ref={root} onKeyDown={event => { if (event.key === 'Escape' && open) { event.stopPropagation(); close(true) } else if (open && event.key === 'ArrowDown') move(event, 1); else if (open && event.key === 'ArrowUp') move(event, -1) }}>
    <button className="secondary-button focus-ring" ref={button} type="button" disabled={disabled} aria-haspopup="menu" aria-expanded={open} aria-controls={menu} onClick={() => setOpen(value => !value)}>{icon}{label}<ChevronDown aria-hidden="true" size={15} /></button>
    {open ? <div className="action-menu__list" id={menu} role="menu" aria-label={label}>{items.map(item => <button className="focus-ring" key={item.label} role="menuitem" type="button" onClick={() => { close(true); item.onSelect() }}>{item.icon}{item.label}</button>)}</div> : null}
  </div>
}
