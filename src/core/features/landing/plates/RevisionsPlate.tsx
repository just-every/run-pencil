import type { ReactNode } from 'react'
import { PencilCircle } from '../marks/PencilCircle'
import { SketchFrame } from '../marks/SketchFrame'
import { Ticks } from '../marks/Ticks'
import { Plate, PlateNote } from './Plate'
import { sample } from '../sample'

/** One drawn revision: its label as the results revision picker writes it, and its screens in order. */
function Revision({ label, steps, className }: { readonly label: ReactNode; readonly steps: readonly string[]; readonly className: string }) {
  return (
    <SketchFrame tone="sheet" radius={10} className={`plate-sheet revision-sheet ${className}`}>
      <p className="revision-sheet__label">{label}</p>
      <ol className="revision-sheet__steps">
        {steps.map(step => <li key={step}>{step}</li>)}
      </ol>
    </SketchFrame>
  )
}

/**
 * #revisions: revision 1 (the template as created) behind the current revision 2, which added the follow-ups for
 * "Great" and "Good", with the builder's publish notice under it. The note above names revision 1, the one people
 * already answering finish.
 */
export function RevisionsPlate() {
  return (
    <Plate section="revisions">
      <PlateNote section="revisions" />
      <Revision className="revision-sheet--earlier" label={<PencilCircle>Revision 1</PencilCircle>} steps={sample.firstRevisionSteps} />
      <div className="revision-sheet--current">
        <Ticks className="revision-sheet__ticks" />
        <Revision className="revision-sheet--front" label="Revision 2 · current" steps={sample.steps} />
        <SketchFrame as="p" radius={7} className="revision-notice">Published. New visitors see this version.</SketchFrame>
      </div>
    </Plate>
  )
}
