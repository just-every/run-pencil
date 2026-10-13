import type { ReactNode } from 'react'
import { sectionCopy, type SectionId } from '../copy'
import { MarginNote } from '../marks/MarginNote'

/**
 * A named plate: a figure whose accessible name says what the drawing shows, and its sheets. The words on the sheets
 * are real HTML; the drawn lines are decorative and hidden from assistive technology.
 */
export function Plate({ section, children }: { readonly section: SectionId; readonly children: ReactNode }) {
  return (
    <figure className={`plate plate--${section}`} aria-label={sectionCopy[section].plate}>
      {children}
    </figure>
  )
}

/**
 * The plate's one margin note. Each plate puts it in the paper right beside the sheet edge nearest its circled
 * detail (above or below that sheet), so the arrow has a clear, short line to the circle.
 */
export function PlateNote({ section }: { readonly section: SectionId }) {
  return <MarginNote className={`plate__note plate--${section}__note`}>{sectionCopy[section].note}</MarginNote>
}
