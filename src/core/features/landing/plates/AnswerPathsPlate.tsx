import { PathMap } from './PathMap'
import { Plate, PlateNote } from './Plate'
import { RulesSheet } from './RulesSheet'

/** #answer-paths: the map of where each answer leads, over the rules that draw it; the note stands below the rules sheet. */
export function AnswerPathsPlate() {
  return (
    <Plate section="answer-paths">
      <PathMap />
      <RulesSheet />
      <PlateNote section="answer-paths" />
    </Plate>
  )
}
