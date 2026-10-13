import { PencilCircle } from '../marks/PencilCircle'
import { SketchFrame } from '../marks/SketchFrame'
import { Plate, PlateNote } from './Plate'
import { shareFields } from '../sample'

/** A small sketched envelope: the invitation email. Decorative. */
function Envelope() {
  return (
    <svg className="envelope" viewBox="0 0 34 24" aria-hidden="true" focusable="false">
      <rect x="1.5" y="2" width="31" height="20" rx="2.5" />
      <path d="M 2.5 3.4 C 9 9, 13 12.6, 17 13.4 C 21 12.6, 25 9, 31.6 3.2" />
    </svg>
  )
}

/** The invitation on day 0 and its one reminder on day 2, pencilled on the paper beside the email. Decorative. */
function ReminderTimeline() {
  return (
    <p className="share-days" aria-hidden="true">
      <span>Day 0</span>
      <svg className="share-days__line" viewBox="0 0 120 12" preserveAspectRatio="none" focusable="false">
        <circle cx="5" cy="6" r="3.2" />
        <path d="M 12 6.4 C 40 5.6, 76 6.8, 106 6" />
        <circle cx="114" cy="6" r="3.2" />
      </svg>
      <span>Day 2</span>
    </p>
  )
}

/**
 * #share: FlowSharePanel.tsx's three copy fields, each one line, and the invitation email (distribution/message.ts)
 * reduced to its opt-out link; the same message goes again as the one reminder two days later. The note beneath
 * points up at that circled link.
 */
export function SharePlate() {
  return (
    <Plate section="share">
      <SketchFrame tone="sheet" radius={12} className="plate-sheet share-sheet">
        <p className="plate-title">Share this flow</p>
        <dl className="share-sheet__fields">
          {shareFields.map(field => (
            <div key={field.label}>
              <dt className="plate-label">{field.label}</dt>
              <dd><SketchFrame as="span" radius={6} className="share-sheet__value"><span className="drawn-mono">{field.value}</span></SketchFrame></dd>
            </div>
          ))}
        </dl>
      </SketchFrame>
      <div className="share-mail">
        <ReminderTimeline />
        <SketchFrame tone="sheet" radius={10} className="plate-sheet mail-sheet">
          <Envelope />
          <p className="mail-sheet__link"><PencilCircle>Stop future flow mail</PencilCircle></p>
        </SketchFrame>
      </div>
      <PlateNote section="share" />
    </Plate>
  )
}
