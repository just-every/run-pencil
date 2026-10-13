import { RevisionsPlate } from '../plates/RevisionsPlate'
import { Section } from './Section'

/** Change your questions, keep your answers: numbered revisions. */
export function Revisions() {
  return <Section id="revisions" flip plate={<RevisionsPlate />} />
}
