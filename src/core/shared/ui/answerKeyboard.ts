import type { KeyboardEvent } from 'react'

/** Move focus inside a radio group or multi-select listbox. Space/Enter use the button's native activation. */
export function moveAnswerFocus(event: KeyboardEvent<HTMLButtonElement>, select: boolean) {
  const key = event.key
  if (!['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Home', 'End'].includes(key)) return
  // An icon option is wrapped in its Tooltip; the group is the wrapper's parent.
  const parent = event.currentTarget.parentElement
  const group = parent?.classList.contains('control-tooltip') ? parent.parentElement : parent
  const options = Array.from(group?.querySelectorAll<HTMLButtonElement>('[role="radio"],[role="option"]') ?? [])
  const index = options.indexOf(event.currentTarget)
  if (index < 0 || !options.length) return
  event.preventDefault()
  const nextIndex = key === 'Home' ? 0 : key === 'End' ? options.length - 1 : (index + (key === 'ArrowDown' || key === 'ArrowRight' ? 1 : -1) + options.length) % options.length
  const next = options[nextIndex]
  next.focus()
  if (select) next.click()
}
