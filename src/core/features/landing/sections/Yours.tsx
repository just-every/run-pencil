import { TerminalPlate } from '../plates/TerminalPlate'
import { Section } from './Section'

/** Yours, down to the last answer: setup, deploy and export. */
export function Yours() {
  return <Section id="yours" plate={<TerminalPlate />} />
}
