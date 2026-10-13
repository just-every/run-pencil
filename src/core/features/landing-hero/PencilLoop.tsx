import type { LoopShape } from './loop-path'

interface PencilLoopProps {
  readonly shape: LoopShape
  /** `still`: drawn (server render); `draw`: the pencil draws it now; `erase`: it is being rubbed out. */
  readonly mode: 'still' | 'draw' | 'erase'
}

/** The hand-drawn pencil loop around an answer. Decorative: the button's `aria-pressed` carries the choice. */
export function PencilLoop({ shape, mode }: PencilLoopProps) {
  return (
    <svg
      className={`pencil-loop pencil-loop--${mode}`}
      viewBox={`0 0 ${shape.width} ${shape.height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <path d={shape.d} pathLength={1} />
    </svg>
  )
}
