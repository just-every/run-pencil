import type { ReactNode } from 'react'

/**
 * A short Caveat note in the margin of a plate with a small curved pencil arrow. The arrow is drawn pointing left;
 * each plate's stylesheet places the note and turns the arrow (`--note-turn`) toward the detail it explains.
 */
export function MarginNote({ children, className }: { readonly children: ReactNode; readonly className?: string }) {
  return (
    <p className={['margin-note', className ?? ''].filter(Boolean).join(' ')}>
      <svg className="margin-note__arrow" viewBox="0 0 64 44" aria-hidden="true" focusable="false">
        <path d="M 60 4 C 56 26, 38 36, 8 34" />
        <path d="M 18 25 L 7 34 L 19 41" />
      </svg>
      <span className="margin-note__text">{children}</span>
    </p>
  )
}
