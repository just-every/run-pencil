import { pencilFilter, type PencilFilterName } from './pencil-filters'

interface PencilLineProps {
  /** Places the line; site/styles/marks.css draws it. */
  readonly className: string
  readonly viewBox: string
  /** The line, then the paths it forks into, if any. */
  readonly trunk: string
  readonly branches?: readonly string[]
  readonly filter: PencilFilterName
  /** Stretch the drawing to its box instead of keeping its aspect ratio. */
  readonly stretch?: boolean
  /** Draw it in when its `[data-reveal]` ancestor is revealed (landing/useReveal.ts). */
  readonly draws?: boolean
}

/**
 * A free graphite line on the paper of the product page, often forking in two the way an answer picks the next
 * question: the hero card's trail, the fork halfway down the story and the fork from the resting pencil's tip.
 * Decorative.
 */
export function PencilLine({ className, viewBox, trunk, branches = [], filter, stretch = false, draws = false }: PencilLineProps) {
  return (
    <svg
      className={`pencil-line${draws ? ' pencil-line--draws' : ''} ${className}`}
      viewBox={viewBox}
      preserveAspectRatio={stretch ? 'none' : undefined}
      aria-hidden="true"
      focusable="false"
    >
      <g filter={pencilFilter(filter)}>
        <path d={trunk} />
        {branches.map(d => <path key={d} className="pencil-line__branch" d={d} />)}
      </g>
    </svg>
  )
}
