import { PencilLine } from '../../site'

/**
 * One short graphite line that forks into two paths, the way an answer chooses the next question: a breath between
 * the asking and the reaching halves of the story. Decorative; it draws itself in when it scrolls into view.
 */
export function ForkLine() {
  return (
    <div className="site-wrap fork-line" data-reveal="" aria-hidden="true">
      <PencilLine
        className="fork-line__drawing"
        viewBox="0 0 1200 110"
        stretch
        draws
        filter="grain"
        trunk="M 120 62 C 260 56, 420 66, 560 58 C 610 55, 650 55, 680 55"
        branches={[
          'M 680 55 C 750 52, 800 28, 900 26 C 960 25, 1010 19, 1060 15',
          'M 680 55 C 754 59, 812 86, 908 85 C 970 84, 1020 92, 1066 98',
        ]}
      />
    </div>
  )
}
