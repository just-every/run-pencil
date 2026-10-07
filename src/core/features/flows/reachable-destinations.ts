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
  if (step.questionType === 'single_choice') return choices.some(satisfies)
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
    // Empty selections normalize to unanswered, including when minSelections=0.
    return selectionIsPossible(choices.length, clauses, Math.max(1, settings.minSelections as number), settings.maxSelections as number)
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
