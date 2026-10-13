import { PencilCircle } from '../marks/PencilCircle'
import { SketchFrame } from '../marks/SketchFrame'
import { Plate, PlateNote } from './Plate'

/** A small sketched padlock, standing in for the product's lock icon on the privacy card. */
function Padlock() {
  return (
    <svg className="padlock" viewBox="0 0 28 32" aria-hidden="true" focusable="false">
      <path d="M 8.5 14 L 8.5 9.5 C 8.6 3.6, 19.4 3.4, 19.6 9.6 L 19.5 14" />
      <rect x="4.5" y="13.5" width="19" height="15" rx="3" />
      <path d="M 14 19.5 L 14 23" />
    </svg>
  )
}

/**
 * #kind: the "Before you share" card that RespondentFlowPage.tsx shows with the first question when a flow has no
 * welcome screen, as here, with its whole text for an anonymous link and no supporting line. The business name the
 * card inserts is drawn as a pencilled blank, "your business", so no sample name reads as a customer.
 */
export function KindPlate() {
  return (
    <Plate section="kind">
      <PlateNote section="kind" />
      <SketchFrame tone="sheet" radius={12} stacked className="plate-sheet kind-sheet">
        <Padlock />
        <p>
          <PencilCircle className="kind-sheet__title">Before you share</PencilCircle>
          <span className="kind-sheet__text">
            Your response is anonymous. At <span className="fill-in">your business</span>, operators can see the answers you
            submit. Identifying details you choose to type, such as an email address, identify you to those operators. Your
            answers are received and stored by this feedback service.
          </span>
        </p>
      </SketchFrame>
    </Plate>
  )
}
