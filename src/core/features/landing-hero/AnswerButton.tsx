import { answers, type Answer, type AnswerId } from './answers'
import { Crumbs } from './Crumbs'
import { pencilLoop } from './loop-path'
import { PencilLoop } from './PencilLoop'

const loops = Object.fromEntries(answers.map((answer, index) => [answer.id, pencilLoop(answer.widthEm, 0.6 + index * 1.7)]))

interface AnswerButtonProps {
  readonly answer: Answer
  readonly chosen: boolean
  readonly erasing: boolean
  /** The choice count; 0 renders the still, server-side card. */
  readonly turn: number
  readonly onChoose: (id: AnswerId) => void
}

/** One handwritten answer on the card: a real toggle button that the pencil circles when it is chosen. */
export function AnswerButton({ answer, chosen, erasing, turn, onChoose }: AnswerButtonProps) {
  const shape = loops[answer.id]
  return (
    <button type="button" className="note-answer" aria-pressed={chosen} onClick={() => onChoose(answer.id)}>
      <span className="note-answer__label">{answer.label}</span>
      {chosen && <PencilLoop key={`drawn-${turn}`} shape={shape} mode={turn === 0 ? 'still' : 'draw'} />}
      {erasing && <PencilLoop key={`erased-${turn}`} shape={shape} mode="erase" />}
      {erasing && <Crumbs key={`crumbs-${turn}`} set="loop" />}
    </button>
  )
}
