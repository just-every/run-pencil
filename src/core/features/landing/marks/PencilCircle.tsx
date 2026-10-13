import type { ReactNode } from 'react'
import { pencilFilter } from '../../site'

/** A loose oval for a word or two inside a line. */
const ovalPath = 'M 44 14 C 100 3, 192 3, 222 18 C 246 32, 236 84, 200 93 C 150 101, 66 100, 26 89 C 2 80, 4 26, 36 13 C 74 4, 126 5, 164 9'
/** A rounded oblong for a whole line or list, so the loop clears the corners of the block as well as its sides. */
const oblongPath = 'M 48 11 C 104 3, 184 3, 214 11 C 242 20, 240 78, 210 90 C 162 100, 76 99, 30 91 C 2 85, 2 22, 34 12 C 70 4, 128 5, 166 9'

interface PencilCircleProps {
  /** `div` when the circled detail holds block content (a list), `span` otherwise. */
  readonly as?: 'span' | 'div'
  /** Circle a whole line or list across the sheet's width rather than a word inside a line. */
  readonly block?: boolean
  readonly className?: string
  readonly children: ReactNode
}

/**
 * A loose, overshooting pencil loop drawn around one key detail of a plate, like someone listening marked it up.
 * The loop stretches to whatever it surrounds (non-scaling stroke) and draws itself when its plate scrolls into view.
 */
export function PencilCircle({ as: Tag = 'span', block = false, className, children }: PencilCircleProps) {
  const classes = ['pencil-circle', block ? 'pencil-circle--block' : '', className ?? ''].filter(Boolean).join(' ')
  return (
    <Tag className={classes}>
      {children}
      <svg className="pencil-circle__ring" viewBox="0 0 240 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <path filter={pencilFilter('grain')} d={block ? oblongPath : ovalPath} />
      </svg>
    </Tag>
  )
}
