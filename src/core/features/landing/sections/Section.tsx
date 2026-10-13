import type { ReactNode } from 'react'
import { sectionCopy, type SectionId } from '../copy'
import { DocsMore } from './DocsMore'

/** Renders `**…**` spans of a sentence in bold. */
function emphasize(sentence: string) {
  return sentence.split('**').map((part, index) => (index % 2 === 1 ? <strong key={part}>{part}</strong> : part))
}

interface SectionProps {
  readonly id: SectionId
  /** Plate on the left and copy on the right at desktop widths; sections alternate. */
  readonly flip?: boolean
  readonly plate: ReactNode
}

/** One story section: an h2, its sentence and its guide link beside a pencil plate (copy first in reading order). */
export function Section({ id, flip = false, plate }: SectionProps) {
  const { title, sentence, docs } = sectionCopy[id]
  return (
    <section id={id} className={flip ? 'landing-section landing-section--flip' : 'landing-section'} aria-labelledby={`${id}-title`}>
      <div className="site-wrap landing-section__grid">
        <div className="landing-copy" data-reveal="">
          <h2 id={`${id}-title`}>{title}</h2>
          <p className="landing-sentence">{emphasize(sentence)}</p>
          <DocsMore target={docs} />
        </div>
        <div className="landing-plate-slot" data-reveal="">{plate}</div>
      </div>
    </section>
  )
}
