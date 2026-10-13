import type { CSSProperties, ReactNode } from 'react'
import { pencilFilter } from '../../site'

/** Paper sheet, plain outline, graphite-filled button, or a coloured-pencil wash (answer paths only). */
export type SketchTone = 'sheet' | 'plain' | 'ink' | 'sage' | 'yellow' | 'eraser'

interface SketchFrameProps {
  readonly as?: 'div' | 'span' | 'li' | 'p'
  readonly tone?: SketchTone
  /** Corner radius in CSS pixels. */
  readonly radius?: number
  /** A second sheet peeks out behind this one. */
  readonly stacked?: boolean
  readonly className?: string
  readonly style?: CSSProperties
  readonly children?: ReactNode
}

/**
 * The one drawing technique every plate uses: an HTML box whose outline is drawn twice in graphite by an SVG sized in
 * CSS pixels (so lines stay crisp at any width and density), the second pass slightly offset and broken where the
 * pencil lifted, both run through the shared pencil grain. A sheet sits on cream paper with soft graphite shading
 * rubbed in beneath it (and beneath the sheet behind, when stacked). Text inside stays real HTML.
 */
export function SketchFrame({ as: Tag = 'div', tone = 'plain', radius = 8, stacked = false, className, style, children }: SketchFrameProps) {
  const sheet = tone === 'sheet'
  const classes = ['sketch', `sketch--${tone}`, className ?? ''].filter(Boolean).join(' ')
  return (
    <Tag className={classes} style={style}>
      <svg className="sketch__frame" aria-hidden="true" focusable="false">
        {sheet && (
          <g className="sketch__smudge" filter={pencilFilter('smudge')}>
            <rect width="100%" height="100%" rx={radius} />
            {stacked && <rect className="sketch__behind" width="100%" height="100%" rx={radius} />}
          </g>
        )}
        {sheet && stacked && <rect className="sketch__behind sketch__back" width="100%" height="100%" rx={radius} />}
        <rect className="sketch__fill" width="100%" height="100%" rx={radius} />
        <g filter={pencilFilter('grain')}>
          <rect className="sketch__line" width="100%" height="100%" rx={radius} />
          <rect className="sketch__line sketch__line--again" width="100%" height="100%" rx={radius + 1} />
        </g>
      </svg>
      {children}
    </Tag>
  )
}
