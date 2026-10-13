import avif1200 from './art/note-card-1200.avif'
import avif720 from './art/note-card-720.avif'
import webp1200 from './art/note-card-1200.webp'
import webp720 from './art/note-card-720.webp'

/**
 * Rendered width of the note card art, mirroring hero.css: 106% of the art column beside the copy, the content
 * width when stacked, and a 132% bleed on phones.
 */
const sizes = '(min-width: 1600px) 786px, (min-width: 901px) 49vw, (min-width: 601px) 90vw, calc(132vw - 53px)'

/** The blank note card, its shadow and the yellow pencil (12ui art, cleaned). Decorative: every word is HTML. */
export function NoteArt() {
  return (
    <picture className="note-card__art">
      <source type="image/avif" srcSet={`${avif720} 720w, ${avif1200} 1200w`} sizes={sizes} />
      <img
        src={webp1200}
        srcSet={`${webp720} 720w, ${webp1200} 1200w`}
        sizes={sizes}
        width={1200}
        height={847}
        alt=""
        loading="eager"
        fetchPriority="high"
      />
    </picture>
  )
}
