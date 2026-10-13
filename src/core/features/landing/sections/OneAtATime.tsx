import { RespondentPlate } from '../plates/RespondentPlate'
import { Section } from './Section'

/** One question at a time: the respondent screen. */
export function OneAtATime() {
  return <Section id="one-at-a-time" plate={<RespondentPlate />} />
}
