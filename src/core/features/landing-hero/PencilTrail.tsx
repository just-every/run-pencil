import { PencilLine } from '../site'

/**
 * The pencil's line running on past the card: it leaves from under the card's lower edge and drops into the first
 * story section, ending just above that plate's margin note, "counts only their path", whose arrow carries it on to
 * the circled question count. Coordinates are tenths of the card's width (cqw), measured from the card's top-left
 * corner. It is drawn only beside two-column sections (1024px and up), where hero.css sets the card's foot on the
 * hero's foot and plates-flow.css places that note in plate units, so line and note meet at every width.
 * Drawn beneath the card art.
 */
export function PencilTrail() {
  return (
    <PencilLine
      className="note-trail"
      viewBox="150 520 300 420"
      trunk="M 440 540 C 436 640, 384 736, 304 798 C 244 844, 194 880, 202 936"
      filter="loop"
    />
  )
}
