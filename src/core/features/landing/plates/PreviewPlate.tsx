import { PencilCircle } from '../marks/PencilCircle'
import { SketchFrame } from '../marks/SketchFrame'
import { Plate, PlateNote } from './Plate'
import { sample } from '../sample'

const choices = [sample.great.answer, sample.good.answer, sample.better.answer]

/**
 * #preview: DraftPreview.tsx with "Could be better" chosen, beside the evaluated path it reports for the first screen.
 * The rule lines use the preview's own format, "Rule N: matches|does not match → <screen>" with " · chosen" on the
 * rule that was taken: Rule 1 ("Great") does not match, Rule 2 ("Could be better") matches and is chosen.
 */
export function PreviewPlate() {
  return (
    <Plate section="preview">
      <SketchFrame tone="sheet" radius={12} stacked className="plate-sheet preview-sheet">
        <div className="preview-sheet__draft">
          <p className="plate-eyebrow">Preview</p>
          <p className="preview-sheet__question">{sample.question}</p>
          <ul className="preview-sheet__choices">
            {choices.map(choice => (
              <li key={choice} data-chosen={choice === sample.better.answer ? 'true' : undefined}><span className="drawn-radio" aria-hidden="true" />{choice}</li>
            ))}
          </ul>
          <p><SketchFrame as="span" tone="ink" radius={8} className="drawn-button">Continue preview</SketchFrame></p>
        </div>
        <div className="preview-sheet__trace">
          <p className="plate-eyebrow">Evaluated path</p>
          <ul className="preview-sheet__rules">
            <li>Rule 1: does not match → {sample.great.next}</li>
            <li><PencilCircle block>Rule 2: matches → {sample.better.next} <span className="nowrap">· chosen</span></PencilCircle></li>
          </ul>
        </div>
      </SketchFrame>
      <PlateNote section="preview" />
    </Plate>
  )
}
