import { ImportPlate } from '../plates/ImportPlate'
import { Section } from './Section'

/** Bring your Typeform forms: the form and response import. */
export function MovingIn() {
  return <Section id="moving-in" flip plate={<ImportPlate />} />
}
