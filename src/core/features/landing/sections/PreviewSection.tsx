import { PreviewPlate } from '../plates/PreviewPlate'
import { Section } from './Section'

/** Walk the path before anyone else does: draft preview. */
export function PreviewSection() {
  return <Section id="preview" plate={<PreviewPlate />} />
}
