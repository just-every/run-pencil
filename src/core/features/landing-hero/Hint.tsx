/**
 * A pencilled margin note by the card with a curved arrow to the answers. Beside the card (wider screens) the short
 * arrow reaches in from the right; above the card (phones) the long one sweeps over the end of the question and
 * down. note-card.css shows the arrow that fits.
 */
export function Hint() {
  return (
    <p className="note-hint">
      <svg className="note-hint__arrow note-hint__arrow--beside" viewBox="0 0 84 52" aria-hidden="true" focusable="false">
        <path d="M80 9C62 4 34 10 10 40" />
        <path d="M8.5 25.5C9 31 9.5 36 10 41.5C15 39.5 20 38.5 25.5 38" />
      </svg>
      <svg className="note-hint__arrow note-hint__arrow--above" viewBox="0 0 98 96" aria-hidden="true" focusable="false">
        <path d="M2 8C30 1 62 2 80 14C91 22 93 60 91 92" />
        <path d="M83.5 82.5 91 93 97.5 82" />
      </svg>
      <span>Try another answer</span>
    </p>
  )
}
