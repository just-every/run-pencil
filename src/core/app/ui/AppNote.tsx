import type { ReactNode } from 'react'
import { MarginNote } from '../../features/landing/marks/MarginNote'

/**
 * The landing's pencilled margin note, placed by `className`. At most one per screen. Hidden from assistive technology:
 * it only repeats what the screen already says. `wideOnly` drops it on phones.
 */
export function AppNote({ children, className, wideOnly = false }: { readonly children: ReactNode; readonly className: string; readonly wideOnly?: boolean }) {
  return <div aria-hidden="true" className={`app-note-anchor ${className}`} data-wide-only={wideOnly ? '' : undefined}>
    <MarginNote className="app-note">{children}</MarginNote>
  </div>
}
