import { sample } from '../landing'

/**
 * The live note card's content: the sample flow every plate on the page also draws (landing/sample.ts), its
 * question and its three answers, each with the follow-up that answer's path leads to.
 */
export const question = sample.question

export type AnswerId = 'great' | 'good' | 'better'

export interface Answer {
  readonly id: AnswerId
  readonly label: string
  readonly followUp: string
  /** The label's advance width in em of Caveat 400, which sizes the pencil loop drawn around it. */
  readonly widthEm: number
}

const widthsEm: Record<AnswerId, number> = { great: 1.95, good: 1.58, better: 5.15 }

export const answers: readonly Answer[] = (['great', 'good', 'better'] as const).map(id => ({
  id,
  label: sample[id].answer,
  followUp: sample[id].next,
  widthEm: widthsEm[id],
}))

/** The answer circled in the server-rendered card, so the card reads as one complete path without JavaScript. */
export const firstAnswer: AnswerId = 'great'

export function answerById(id: AnswerId): Answer {
  const answer = answers.find(candidate => candidate.id === id)
  if (!answer) throw new Error(`Unknown note card answer: ${id}`)
  return answer
}
