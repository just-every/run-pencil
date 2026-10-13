import { AnswerPathsPlate } from '../plates/AnswerPathsPlate'
import { Section } from './Section'

/** Every answer picks the next question: answer paths. */
export function AnswerPaths() {
  return <Section id="answer-paths" flip plate={<AnswerPathsPlate />} />
}
