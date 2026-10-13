import type { CSSProperties } from 'react'

interface Crumb {
  /** Start, in % of the erased element's box. */
  readonly x: number
  readonly y: number
  /** Size, drift and spin, in em of the card's handwriting. */
  readonly size: number
  readonly dx: number
  readonly dy: number
  readonly spin: number
  readonly delay: number
  readonly tone: 'eraser' | 'graphite'
}

const sets: Record<'line' | 'loop', readonly Crumb[]> = {
  line: [
    { x: 8, y: 82, size: 0.13, dx: -0.12, dy: 0.55, spin: 70, delay: 0.02, tone: 'eraser' },
    { x: 24, y: 90, size: 0.08, dx: 0.05, dy: 0.7, spin: -40, delay: 0.08, tone: 'graphite' },
    { x: 41, y: 84, size: 0.11, dx: -0.06, dy: 0.5, spin: 120, delay: 0.05, tone: 'eraser' },
    { x: 57, y: 94, size: 0.07, dx: 0.1, dy: 0.65, spin: -90, delay: 0.12, tone: 'graphite' },
    { x: 73, y: 86, size: 0.12, dx: 0.14, dy: 0.45, spin: 60, delay: 0.03, tone: 'eraser' },
    { x: 90, y: 92, size: 0.08, dx: 0.04, dy: 0.6, spin: -30, delay: 0.1, tone: 'graphite' },
  ],
  loop: [
    { x: 18, y: 96, size: 0.1, dx: -0.1, dy: 0.45, spin: 80, delay: 0.04, tone: 'eraser' },
    { x: 52, y: 104, size: 0.07, dx: 0.03, dy: 0.55, spin: -60, delay: 0.09, tone: 'graphite' },
    { x: 80, y: 98, size: 0.09, dx: 0.12, dy: 0.4, spin: 45, delay: 0.06, tone: 'eraser' },
  ],
}

/** A few eraser and graphite crumbs that fall from a rubbed-out mark. Decorative and hidden under reduced motion. */
export function Crumbs({ set }: { readonly set: keyof typeof sets }) {
  return (
    <span className="note-crumbs" aria-hidden="true">
      {sets[set].map((crumb, index) => (
        <i
          key={index}
          className={`note-crumb note-crumb--${crumb.tone}`}
          style={{
            '--x': `${crumb.x}%`, '--y': `${crumb.y}%`, '--size': `${crumb.size}em`, '--dx': `${crumb.dx}em`,
            '--dy': `${crumb.dy}em`, '--spin': `${crumb.spin}deg`, '--delay': `${crumb.delay}s`,
          } as CSSProperties}
        />
      ))}
    </span>
  )
}
