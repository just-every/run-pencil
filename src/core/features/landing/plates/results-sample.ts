import { sample } from '../sample'

/**
 * The sample numbers the results plate draws, for one revision of the sample flow. Only the counts below are chosen;
 * every figure on the plate is derived from them and formatted as ResultsPage.tsx, AnswerEvidence.tsx and
 * StepSessionMetrics.tsx format theirs, so no two numbers can disagree. Every start reaches the first question; the
 * sessions that answered it and then stopped on a follow-up end there, so completions stay under its answers.
 * The page labels these as sample numbers: they are not product data or claims.
 */
const starts = 61
const liveCompletions = 48
const firstAnswers = [
  { label: sample.great.answer, count: 27 },
  { label: sample.good.answer, count: 16 },
  { label: sample.better.answer, count: 12 },
] as const

const answered = firstAnswers.reduce((total, answer) => total + answer.count, 0)
const dropped = starts - answered
const share = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0)

/** "1 answer", "55 answers", as AnswerEvidence.tsx counts answers. */
export const answerCount = (value: number) => `${value} ${value === 1 ? 'answer' : 'answers'}`

export const resultsSample = {
  flowTitle: 'Customer feedback',
  responses: liveCompletions,
  starts,
  liveCompletions,
  completionRate: `${share(liveCompletions, starts)}%`,
  question: {
    prompt: sample.question,
    answered,
    choices: firstAnswers.map(answer => ({ ...answer, share: share(answer.count, answered), width: (answer.count / answered) * 100 })),
    reached: starts,
    dropped,
    dropOff: share(dropped, starts),
  },
} as const
