import { SketchFrame, type SketchTone } from '../marks/SketchFrame'
import { sample } from '../sample'

const paths: ReadonlyArray<{ readonly key: string; readonly tone: SketchTone; readonly answer: string; readonly next: string; readonly curve: string }> = [
  { key: 'great', tone: 'sage', answer: sample.great.answer, next: sample.great.next, curve: 'M 3 27 C 26 27, 34 13, 60 12' },
  { key: 'good', tone: 'yellow', answer: sample.good.answer, next: sample.good.next, curve: 'M 3 26 C 24 25, 38 27, 60 26' },
  { key: 'better', tone: 'eraser', answer: sample.better.answer, next: sample.better.next, curve: 'M 3 25 C 26 25, 34 40, 60 41' },
]

/**
 * The answer-path map: the template question with its three answers in coloured-pencil washes, each with an arrow to
 * the question that answer leads to. The only coloured pencil on the page lives here.
 */
export function PathMap() {
  return (
    <div className="path-map">
      <SketchFrame tone="sheet" radius={10} className="path-map__card" />
      <p className="path-map__prompt">{sample.question}</p>
      {paths.map((path, index) => (
        <div className="path-map__row" key={path.key} style={{ gridRow: index + 2 }}>
          <SketchFrame as="span" tone={path.tone} radius={7} className="path-map__answer">{path.answer}</SketchFrame>
          <svg className={`path-map__arrow path-map__arrow--${path.key}`} viewBox="0 0 68 52" aria-hidden="true" focusable="false">
            <path d={path.curve} />
            <path d={arrowHead(path.curve)} />
          </svg>
          <SketchFrame as="span" tone="sheet" radius={8} className={`path-map__next path-map__next--${path.key}`}>{path.next}</SketchFrame>
        </div>
      ))}
    </div>
  )
}

/** A small open arrowhead at the end point of a curve drawn toward the right. */
function arrowHead(curve: string) {
  const [x, y] = curve.trim().split(/[\s,]+/).slice(-2).map(Number)
  return `M ${x - 7} ${y - 5} L ${x + 1} ${y} L ${x - 7} ${y + 5}`
}
