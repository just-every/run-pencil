import { makeChoiceAnswer } from '../../shared/choiceAnswers'
import type { ImportStep } from './model'

/** Google represents each checkbox selection separately in response JSON.
 * Only the declared Other option may receive a value outside the fixed labels. */
export function googleChoiceAnswer(values: string[], step: ImportStep): unknown {
  const ids: string[] = [], otherId = step.settings.otherChoiceId
  let text: string | undefined
  for (const value of values) {
    const matches = step.choices.filter(c => c.label === value && c.id !== otherId)
    if (matches.length === 1) ids.push(matches[0].id)
    else if (!matches.length && typeof otherId === 'string' && text === undefined) { ids.push(otherId); text = value }
    else throw new Error('Choice values must match distinct known options and at most one Other write-in. Use response JSON when checkbox CSV is ambiguous.')
  }
  if (step.questionType !== 'multiple_choice' && ids.length !== 1) throw new Error('A single-choice answer requires exactly one value.')
  return makeChoiceAnswer(step.questionType!, step.settings, ids, text)
}

export type ChoiceResolver = (kind: 'id' | 'ref' | 'label', value: string) => string
export function typeformChoiceAnswer(raw: Record<string, any>, step: ImportStep, resolve: ChoiceResolver): unknown {
  const multi = step.questionType === 'multiple_choice' || step.questionType === 'priority'
  const source = multi ? raw.choices : raw.choice
  if (!source || typeof source !== 'object' || Array.isArray(source)) throw new Error('Typeform choices require the documented choice or choices object.')
  const candidates: string[][] = []
  for (const kind of ['id', 'ref', 'label'] as const) {
    const value = source[multi ? `${kind}s` : kind]
    if (value === undefined) continue
    const values = multi ? value : [value]
    if (!Array.isArray(values) || values.some(v => typeof v !== 'string')) throw new Error('Typeform choice references and labels must be strings.')
    candidates.push(values.map(v => resolve(kind, v)))
  }
  if (candidates.some(ids => JSON.stringify(ids) !== JSON.stringify(candidates[0]))) throw new Error('Typeform choice IDs, references and labels disagree; no option was guessed.')
  const ids = candidates[0] ?? []
  const hasOther = Object.hasOwn(source, 'other')
  if (hasOther) {
    if (typeof source.other !== 'string' || typeof step.settings.otherChoiceId !== 'string') throw new Error('Other text requires an enabled source Other option and a string write-in.')
    if (!multi && ids.length) throw new Error('A single-choice answer cannot select both a fixed option and Other.')
    ids.push(step.settings.otherChoiceId)
  }
  if (!multi && ids.length !== 1) throw new Error('A single-choice answer requires exactly one selection.')
  if (!ids.length) throw new Error('Typeform choice answer has no selections.')
  return step.questionType === 'priority' ? ids : makeChoiceAnswer(step.questionType!, step.settings, ids, hasOther ? source.other : undefined)
}
