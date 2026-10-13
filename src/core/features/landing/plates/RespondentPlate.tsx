import { PencilCircle } from '../marks/PencilCircle'
import { SketchFrame } from '../marks/SketchFrame'
import { StrokeArrow } from '../marks/StrokeArrow'
import { Ticks } from '../marks/Ticks'
import { Plate, PlateNote } from './Plate'
import { sample } from '../sample'

/** The screen drawn: the "Could be better" path's follow-up, with every question before it answered. */
const questions = sample.betterPath
const position = questions.indexOf(sample.better.next)
const answered = position

/**
 * #one-at-a-time: the respondent screen (RespondentFlowPage.tsx) on the "Could be better" path, at its follow-up with
 * nothing typed yet. The top row and the progress bar count as that page counts them, over the path's questions
 * only (so "Question 2 of 2", "1 remaining", half full), and the next screen is the completion, so the button reads
 * "Submit response".
 */
export function RespondentPlate() {
  return (
    <Plate section="one-at-a-time">
      <PlateNote section="one-at-a-time" />
      <SketchFrame tone="sheet" radius={12} stacked className="plate-sheet respondent-sheet">
        <Ticks className="respondent-sheet__ticks" />
        <p className="respondent-sheet__top">
          <PencilCircle className="respondent-sheet__circled">
            <span className="respondent-sheet__count">
              <span>{`Question ${position + 1} of ${questions.length}`}</span>
              <span>{`${questions.length - answered} remaining`}</span>
            </span>
          </PencilCircle>
        </p>
        <span className="respondent-sheet__progress" aria-hidden="true"><span style={{ width: `${(answered / questions.length) * 100}%` }} /></span>
        <p className="respondent-sheet__question">{sample.better.next}</p>
        <SketchFrame as="p" radius={9} className="respondent-sheet__answer">Write your response…</SketchFrame>
        <p className="respondent-sheet__actions">
          <SketchFrame as="span" radius={8} className="drawn-button"><StrokeArrow back /> Back</SketchFrame>
          <SketchFrame as="span" tone="ink" radius={8} className="drawn-button">Submit response <StrokeArrow /></SketchFrame>
        </p>
      </SketchFrame>
    </Plate>
  )
}
