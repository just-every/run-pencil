import { answerById } from './answers'
import { Crumbs } from './Crumbs'
import type { AnswerPath } from './useAnswerPath'

/**
 * The follow-up question the chosen answer leads to, written by the pencil and announced politely. The previous
 * follow-up is rubbed out beside it, hidden from assistive technology so only the new question is read.
 */
export function FollowUp({ chosen, erased, turn }: AnswerPath) {
  return (
    <>
      {erased && (
        <span key={`erased-${turn}`} className="note-card__followup" aria-hidden="true">
          <span className="note-erasing">{answerById(erased).followUp}</span>
          <Crumbs set="line" />
        </span>
      )}
      <p className="note-card__followup" aria-live="polite" aria-atomic="true">
        <span key={turn} className={turn === 0 ? 'note-written' : 'note-written note-writing'}>
          {answerById(chosen).followUp}
        </span>
      </p>
    </>
  )
}
