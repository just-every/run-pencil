import { scoreQuestionTypes, scoreOptions } from '../../shared/scoreQuestions'
import { numericCandidates, dateCandidates } from './ordered-answer-domain'
import { answerIssue } from '../../shared/answers'
import { matchesBranch } from '../../shared/branching'
import type { BranchSelection } from '../../shared/flowPolicies'
import type { StoredBranchRule, StoredStep } from './repository'
import { priorityIsPossible } from './priority-constraints'
import { selectionIsPossible } from './selection-constraints'

type Predicate = Parameters<typeof matchesBranch>[0]
type Requirement = { predicate: Predicate; matched: boolean }

function answerExists(step: StoredStep, choices: string[], settings: Record<string, unknown>, requirements: Requirement[]) {
  const satisfies = (answer: unknown) => requirements.every(({ predicate, matched }) => matchesBranch(predicate, answer) === matched)
  // The respondent normalizes every skipped optional answer to undefined.
  if (!step.required && satisfies(undefined)) return true
  if (['single_choice', 'dropdown'].includes(step.questionType ?? '')) return choices.some(satisfies)
  if (step.questionType === 'yes_no') return [true, false].some(satisfies)
  if (step.questionType === 'consent') return (step.required ? [true] : [true, false]).some(satisfies)
  if ((scoreQuestionTypes as readonly string[]).includes(step.questionType ?? '')) return scoreOptions(step.questionType!).some(option => satisfies(option.value))
  if (step.questionType === 'nps') return Array.from({ length: 11 }, (_, i) => i).some(satisfies)
  if (step.questionType === 'number' || step.questionType === 'date') {
    const valid = (value: unknown) => !answerIssue({ ...step, questionSettings: settings }, choices, value)
    if (step.questionType === 'number') {
      const boundaries = [settings.min, settings.max, ...requirements.map(item => item.predicate.expectedValue)].filter((value): value is number => typeof value === 'number' && Number.isFinite(value)).sort((a, b) => a - b)
      const candidates = numericCandidates(boundaries, settings.decimalPlaces as number | undefined)
      return candidates.some(value => valid(value) && satisfies(value))
    }
    const boundaries = ['0001-01-01', '9999-12-31', settings.earliest, settings.latest, ...requirements.map(item => item.predicate.expectedValue)].filter((value): value is string => typeof value === 'string')
    const candidates = dateCandidates(boundaries)
    return candidates.some(value => valid(value) && satisfies(value))
  }
  if (step.questionType === 'rating') {
    const min = settings.min as number, max = settings.max as number
    return Array.from({ length: max - min + 1 }, (_, index) => min + index).some(satisfies)
  }
  if (step.questionType === 'multiple_choice') {
    const clauses = requirements.flatMap(({ predicate, matched }) => {
      const indexes = (predicate.expectedValue as string[]).map((choice) => choices.indexOf(choice) + 1)
      const positive = matched
      const literals = indexes.map((index) => positive ? index : -index)
      return (predicate.predicateKind === 'all_of') === matched ? literals.map((literal) => [literal]) : [literals]
    })
    const noneIndex = choices.indexOf(String(settings.noneChoiceId)) + 1
    if (noneIndex && satisfies([settings.noneChoiceId])) return true
    if (noneIndex) clauses.push([-noneIndex])
    // Empty selections normalize to unanswered, including when minSelections=0.
    return selectionIsPossible(choices.length, clauses, Math.max(1, settings.minSelections as number ?? 1), settings.maxSelections as number ?? choices.length)
  }
  if (step.questionType === 'priority') {
    const equality = requirements.find(({ predicate, matched }) => matched && predicate.predicateKind === 'equals')
    if (equality) return satisfies(equality.predicate.expectedValue)
    const allowed = choices.map((choice) => Array.from({ length: choices.length }, (_, index) => index + 1).filter((rank) => requirements.every(({ predicate, matched }) => {
      if (predicate.predicateKind === 'equals') return true
      const expected = predicate.expectedValue as { choiceId: string }
      if (expected.choiceId !== choice) return true
      const answer = Array.from({ length: choices.length }, () => undefined as string | undefined)
      answer[rank - 1] = choice
      return matchesBranch(predicate, answer) === matched
    })))
    return priorityIsPossible(choices, allowed, requirements.filter(({ predicate }) => predicate.predicateKind === 'equals').map(({ predicate }) => predicate.expectedValue as string[]))
  }
  // Text questions and welcome screens cannot have valid branch predicates.
  return requirements.length === 0
}

/** Each rule sees only its own question's answer. Thus feasible local edges
 * compose into feasible simple paths (and cycles), without cross-step state.
 * A selected rule must match while every higher-precedence rule must not.
 */
export function reachableDestinations(step: StoredStep, choices: string[], settings: Record<string, unknown>, rules: StoredBranchRule[], selection: BranchSelection): string[] {
  if (step.kind === 'completion') return []
  const ordered = rules.slice().sort((left, right) => left.position - right.position)
  if (selection === 'last-matching-rule') ordered.reverse()
  const requirements: Requirement[] = []
  const destinations = new Set<string>()
  for (const rule of ordered) {
    const predicate = { predicateKind: rule.predicateKind, expectedValue: JSON.parse(rule.expectedValueJson) }
    if (answerExists(step, choices, settings, [...requirements, { predicate, matched: true }])) destinations.add(rule.destinationStepStableId)
    requirements.push({ predicate, matched: false })
  }
  if (step.nextStepStableId && answerExists(step, choices, settings, requirements)) destinations.add(step.nextStepStableId)
  return [...destinations]
}
