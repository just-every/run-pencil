import { PencilCircle } from '../marks/PencilCircle'
import { SketchFrame } from '../marks/SketchFrame'
import { Plate, PlateNote } from './Plate'

/** A drawn file picker with its label (importing/ui/ImportPage.tsx) and the file chosen in it. */
function FileField({ label, file }: { readonly label: string; readonly file: string }) {
  return (
    <span className="import-sheet__field">
      <span className="plate-label">{label}</span>
      <SketchFrame as="span" radius={6} className="import-sheet__file"><span className="drawn-mono">{file}</span></SketchFrame>
    </span>
  )
}

/**
 * #moving-in: the dashboard's "Import a form" page with both files chosen, before review, cut to its primary button.
 * The response CSV is circled; the note beneath reaches it past that button.
 */
export function ImportPlate() {
  return (
    <Plate section="moving-in">
      <SketchFrame tone="sheet" radius={12} stacked className="plate-sheet import-sheet">
        <p className="plate-title">Import a form</p>
        <p className="import-sheet__lede">Bring a Typeform form definition JSON and an optional response CSV into Pencil as an editable draft.</p>
        <p className="import-sheet__files">
          <FileField label="Form definition JSON" file="visit-feedback.json" />
          <PencilCircle block><FileField label="Response CSV (optional)" file="visit-feedback-responses.csv" /></PencilCircle>
        </p>
        <p className="import-sheet__actions">
          <SketchFrame as="span" tone="ink" radius={8} className="drawn-button">Review import</SketchFrame>
        </p>
      </SketchFrame>
      <PlateNote section="moving-in" />
    </Plate>
  )
}
