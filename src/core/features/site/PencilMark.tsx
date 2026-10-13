import { markParts, markTransform, markViewBox } from './brand/mark'

interface PencilMarkProps {
  /** Rendered width and height in CSS pixels. Legible from 16px; the header uses 38px. */
  readonly size?: number
  readonly className?: string
}

/** Pencil's mark as inline SVG. Decorative: the text beside it names the product. */
export function PencilMark({ size = 32, className }: PencilMarkProps) {
  return (
    <svg className={className} width={size} height={size} viewBox={markViewBox} aria-hidden="true" focusable="false">
      <g transform={markTransform} strokeLinejoin="round" strokeLinecap="round">
        {markParts.map(part => (
          <path key={part.d} d={part.d} fill={part.fill ?? 'none'} stroke={part.stroke} strokeWidth={part.strokeWidth} />
        ))}
      </g>
    </svg>
  )
}
