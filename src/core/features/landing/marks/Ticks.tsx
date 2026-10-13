import { pencilFilter } from '../../site'

/** Three quick pencil strokes beside a sheet's corner, the sketcher's "look here". Decorative. */
export function Ticks({ className }: { readonly className?: string }) {
  return (
    <svg className={['ticks', className ?? ''].filter(Boolean).join(' ')} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <g filter={pencilFilter('grain')}>
        <path d="M 9 17 L 16 3" />
        <path d="M 19 24 L 35 15" />
        <path d="M 20 34 L 36 37" />
      </g>
    </svg>
  )
}
