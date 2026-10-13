import { useEffect, useId, useState } from 'react'
import { pencilFilterVars } from '../site'
import { AnswerButton } from './AnswerButton'
import { answers, question } from './answers'
import { FollowUp } from './FollowUp'
import { Hint } from './Hint'
import { answerBoxVars } from './loop-path'
import { NoteArt } from './NoteArt'
import { PencilTrail } from './PencilTrail'
import { useAnswerPath } from './useAnswerPath'

/**
 * The live note card (SITE-002): a handwritten question, three answers as toggle buttons, and the follow-up the
 * chosen answer leads to. The handwriting sits on a plane rotated with the card art and sized in container units,
 * so every word stays on the card at every width. The server renders "Great" circled with its follow-up.
 * `data-hydrated` turns true once the answers respond, as on the product's own pages; only then does the pencilled
 * "Try another answer" hint appear, so it never invites a tap the card cannot answer yet. Its pencil filters are
 * the page's (PencilFilters, rendered by the route).
 */
export function NoteCard() {
  const questionId = useId()
  const { chosen, erased, turn, choose } = useAnswerPath()
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])
  return (
    <div className="note-card" data-hydrated={hydrated} style={pencilFilterVars}>
      <PencilTrail />
      <NoteArt />
      <div className="note-card__plane">
        <p id={questionId} className="note-card__question">{question}</p>
        <div className="note-card__answers" role="group" aria-labelledby={questionId} style={answerBoxVars}>
          {answers.map(answer => (
            <AnswerButton
              key={answer.id}
              answer={answer}
              chosen={answer.id === chosen}
              erasing={answer.id === erased}
              turn={turn}
              onChoose={choose}
            />
          ))}
        </div>
        <FollowUp chosen={chosen} erased={erased} turn={turn} />
      </div>
      {hydrated && <Hint />}
    </div>
  )
}
