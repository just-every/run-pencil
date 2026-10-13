import { ResultsPlate } from '../plates/ResultsPlate'
import { Section } from './Section'

/** Hear every answer, counted honestly: results and exports. */
export function Results() {
  return <Section id="results" plate={<ResultsPlate />} />
}
