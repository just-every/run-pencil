import { KindPlate } from '../plates/KindPlate'
import { Section } from './Section'

/** Kind to the people you ask: privacy on paper, no dark band. */
export function Kind() {
  return <Section id="kind" flip plate={<KindPlate />} />
}
