import type { ChoiceOption, FlowStep, PublicFlow } from '../app/api'
import { answerIssue, isUnanswered } from './answers'
import { contactQuestionTypes, displayContactAnswer } from './contactAnswers'
import { isChoiceQuestion, isOtherChoiceAnswer, selectedChoiceIds } from './choiceAnswers'
import { displayCalendarDate } from './dateFormat'
import { visiblePath } from './flowPath'
import { ratingScale } from './ratingScale'
import { recallKey, replaceRecall } from './recallSyntax'
import { scoreOptions, scoreQuestionTypes } from './scoreQuestions'

function runtimeValue(step: FlowStep, value: unknown): unknown {
  if (step.questionType !== 'consent' || !value || typeof value !== 'object' || Array.isArray(value)) return value
  if ('accepted' in value && typeof value.accepted === 'boolean' && 'statement' in value && value.statement === step.questionSettings?.statement && Object.keys(value).length === 2) return value.accepted
  return value
}

/** A question counts as answered only when its value passes shared validation. */
export function formatRecallAnswer(step: FlowStep, choices: ChoiceOption[], answer: unknown): string {
  if (step.kind !== 'question') return ''
  const value = runtimeValue(step, answer)
  const options = choices.filter(choice => choice.stepId === step.id)
  if (isUnanswered(value) || answerIssue(step, options.map(choice => choice.id), value)) return ''
  const type = step.questionType, settings = step.questionSettings ?? {}
  if (isChoiceQuestion(type) || type === 'priority') {
    return selectedChoiceIds(value).map((id, index) => {
      const label = isOtherChoiceAnswer(value) && id === value.other.choiceId ? value.other.text : options.find(choice => choice.id === id)!.label
      return type === 'priority' ? `${index + 1}. ${label}` : label
    }).join(', ')
  }
  if ((contactQuestionTypes as readonly string[]).includes(type ?? '')) return displayContactAnswer(type!, value)
  if (type === 'date') return displayCalendarDate(value as string, settings)
  if (type === 'consent') return value ? 'Accepted' : 'Declined'
  if (type === 'yes_no') return value ? 'Yes' : 'No'
  if ((scoreQuestionTypes as readonly string[]).includes(type ?? '')) {
    const label = scoreOptions(type!).find(option => option.value === value)!.label
    return typeof value === 'boolean' ? label : `${value} (${label})`
  }
  if (type === 'rating') {
    const scale = ratingScale(settings)
    const label = value === scale.min ? scale.lowLabel : value === scale.max ? scale.highLabel : value === (scale.min + scale.max) / 2 ? scale.middleLabel : ''
    return label ? `${value} (${label})` : String(value)
  }
  return typeof value === 'string' || typeof value === 'number' ? String(value) : ''
}

/** Resolve only answers before this screen on the respondent's current path.
 * Earlier choice labels are rendered against their own earlier context, keeping
 * the dependency order acyclic. All returned strings are plain display text.
 */
export function renderRecallScreen(flow: PublicFlow, answers: Record<string, unknown>, step: FlowStep): { step: FlowStep; choices: ChoiceOption[] } {
  const path = visiblePath(flow, answers)
  const before = path.findIndex(candidate => candidate.id === step.id)
  const values = new Map<string, string>()
  const keyCounts = new Map<string, number>()
  for (const question of flow.steps.filter(candidate => candidate.kind === 'question')) {
    const key = recallKey(question.questionSettings)
    if (key) keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1)
  }
  const resolve = (key: string) => values.get(key) ?? ''
  const optionsFor = (question: FlowStep) => flow.choices.filter(choice => choice.stepId === question.id).sort((left, right) => left.position - right.position)
    .map(choice => ({ ...choice, label: replaceRecall(choice.label, resolve) }))
  for (const earlier of path.slice(0, Math.max(0, before))) {
    const key = recallKey(earlier.questionSettings)
    if (earlier.kind !== 'question' || !key || keyCounts.get(key) !== 1) continue
    const renderedChoices = optionsFor(earlier)
    const value = formatRecallAnswer(earlier, renderedChoices, answers[earlier.id])
    if (value !== '') values.set(key, value)
  }
  return {
    step: { ...step, prompt: replaceRecall(step.prompt, resolve), helperText: step.helperText === null ? null : replaceRecall(step.helperText, resolve) },
    choices: optionsFor(step),
  }
}
