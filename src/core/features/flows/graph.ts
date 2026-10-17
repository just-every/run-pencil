import { calendarDate, typeSettingsValid } from '../../shared/questionTypes'
import { matchesBranch } from '../../shared/branching'
import type { BranchSelection } from '../../shared/flowPolicies'
import { reachableDestinations } from './reachable-destinations'
import type { StoredBranchRule, StoredChoice, StoredStep } from './repository'

export type BranchPredicateKind = 'equals' | 'greater_than' | 'greater_than_or_equal' | 'less_than' | 'less_than_or_equal' | 'any_of' | 'all_of'
export type GraphIssue = { stepId: string; reason: string }

function parsed(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return undefined
  }
}

function sameStringSet(actual: string[], expected: string[]) {
  return actual.length === expected.length && new Set(actual).size === expected.length && actual.every((item) => expected.includes(item))
}

export function branchMatches(rule: StoredBranchRule, answer: unknown) {
  return matchesBranch({ predicateKind: rule.predicateKind, expectedValue: parsed(rule.expectedValueJson) }, answer)
}

export function resolveNextStep(input: {
  step: StoredStep
  rules: StoredBranchRule[]
  answers: Record<string, unknown>
  selection?: import('../../shared/flowPolicies').BranchSelection
}) {
  const evaluations = input.rules.map((rule) => ({ ruleId: rule.id, matched: branchMatches(rule, input.answers[input.step.stableId]), destinationStepId: rule.destinationStepStableId }))
  const selected = (input.selection === 'last-matching-rule' ? evaluations.slice().reverse() : evaluations).find((evaluation) => evaluation.matched)
  return {
    evaluations,
    nextStepId: selected?.destinationStepId ?? input.step.nextStepStableId,
    selectedRuleId: selected?.ruleId ?? null,
    usedDefaultPath: !selected,
  }
}

function validSettings(step: StoredStep, choices: StoredChoice[]) {
  if (!step.questionSettingsJson) return { valid: typeSettingsValid(step.questionType, {}), value: {} as Record<string, unknown> }
  const value = parsed(step.questionSettingsJson)
  if (!value || Array.isArray(value) || typeof value !== 'object') return { valid: false, value: {} as Record<string, unknown> }
  if (!typeSettingsValid(step.questionType, value as Record<string, unknown>)) return { valid: false, value: {} as Record<string, unknown> }
  if (step.questionType === 'multiple_choice') {
    const { minSelections, maxSelections } = value as { minSelections?: unknown; maxSelections?: unknown }
    if (!Number.isInteger(minSelections) || !Number.isInteger(maxSelections) || (minSelections as number) < 0 || (maxSelections as number) < (minSelections as number) || (maxSelections as number) > choices.length) return { valid: false, value: {} as Record<string, unknown> }
  }
  return { valid: true, value: value as Record<string, unknown> }
}

export function questionSettings(step: StoredStep, choices: StoredChoice[]): { valid: boolean; value: Record<string, unknown> } {
  const defaultSettings = step.questionType === 'rating'
    ? { min: 1, max: 5 }
    : step.questionType === 'multiple_choice'
      ? { minSelections: 1, maxSelections: choices.length }
      : {}
  const settings = validSettings(step, choices)
  return { valid: settings.valid, value: step.questionSettingsJson ? settings.value : defaultSettings }
}

function branchRuleIsValid(rule: StoredBranchRule, source: StoredStep, choiceIds: string[]) {
  const expected = parsed(rule.expectedValueJson)
  if (['single_choice', 'dropdown'].includes(source.questionType ?? '')) return rule.predicateKind === 'equals' && typeof expected === 'string' && choiceIds.includes(expected)
  if (['yes_no', 'consent'].includes(source.questionType ?? '')) return rule.predicateKind === 'equals' && typeof expected === 'boolean'
  if (['nps', 'number', 'date'].includes(source.questionType ?? '')) return ['equals', 'greater_than', 'greater_than_or_equal', 'less_than', 'less_than_or_equal'].includes(rule.predicateKind) && (source.questionType === 'date' ? calendarDate(expected) : typeof expected === 'number' && Number.isFinite(expected) && (source.questionType !== 'nps' || Number.isInteger(expected) && expected >= 0 && expected <= 10))
  if (source.questionType === 'multiple_choice') return ['any_of', 'all_of'].includes(rule.predicateKind) && Array.isArray(expected) && expected.length > 0 && new Set(expected).size === expected.length && expected.every((value) => typeof value === 'string' && choiceIds.includes(value))
  if (source.questionType === 'rating') return ['equals', 'greater_than', 'greater_than_or_equal', 'less_than', 'less_than_or_equal'].includes(rule.predicateKind) && typeof expected === 'number'
  if (source.questionType === 'priority') {
    if (rule.predicateKind === 'equals') return Array.isArray(expected) && expected.every((value): value is string => typeof value === 'string') && sameStringSet(expected, choiceIds)
    const priority = expected && !Array.isArray(expected) && typeof expected === 'object' ? expected as { choiceId?: unknown; rank?: unknown } : undefined
    return ['greater_than', 'greater_than_or_equal', 'less_than', 'less_than_or_equal'].includes(rule.predicateKind)
      && typeof priority?.choiceId === 'string' && choiceIds.includes(priority.choiceId)
      && Number.isInteger(priority.rank) && (priority.rank as number) >= 1 && (priority.rank as number) <= choiceIds.length
  }
  return false
}

export function validateRevisionGraph(steps: StoredStep[], choices: StoredChoice[], rules: StoredBranchRule[], selection: BranchSelection = 'first-matching-rule'): GraphIssue[] {
  const issues: GraphIssue[] = []
  const byStableId = new Map(steps.map((step) => [step.stableId, step]))
  const choicesByStep = new Map<string, StoredChoice[]>()
  for (const choice of choices) {
    const current = choicesByStep.get(choice.stepId) ?? []
    current.push(choice)
    choicesByStep.set(choice.stepId, current)
  }

  const welcomeSteps = steps.filter((step) => step.kind === 'welcome')
  const questions = steps.filter((step) => step.kind === 'question')
  const completions = steps.filter((step) => step.kind === 'completion')
  if (welcomeSteps.length > 1) issues.push({ stepId: welcomeSteps[1].stableId, reason: 'A flow may contain only one welcome screen.' })
  if (welcomeSteps.some((step) => step.position !== 0)) issues.push(...welcomeSteps.filter((step) => step.position !== 0).map((step) => ({ stepId: step.stableId, reason: 'A welcome screen must be first.' })))
  if (questions.length === 0) issues.push({ stepId: 'flow', reason: 'A published flow needs at least one question.' })
  if (completions.length === 0) issues.push({ stepId: 'flow', reason: 'A published flow needs at least one named completion screen.' })

  for (const step of steps) {
    if (step.kind === 'question' && (!step.questionType || step.prompt.trim().length === 0 || step.prompt.length > 1000)) issues.push({ stepId: step.stableId, reason: 'Every question needs a prompt within the configured text limit.' })
    if (step.kind !== 'question' && step.questionType) issues.push({ stepId: step.stableId, reason: 'Only questions can have a question type.' })
    const stepChoices = choicesByStep.get(step.id) ?? []
    const structured = ['single_choice', 'multiple_choice', 'priority', 'dropdown'].includes(step.questionType ?? '')
    if (structured && stepChoices.length === 0) issues.push({ stepId: step.stableId, reason: 'This structured question needs at least one choice.' })
    if (new Set(stepChoices.map((choice) => choice.label.trim().toLocaleLowerCase())).size !== stepChoices.length) issues.push({ stepId: step.stableId, reason: 'Each choice needs a different label.' })
    if (new Set(stepChoices.map((choice) => choice.value)).size !== stepChoices.length) issues.push({ stepId: step.stableId, reason: 'Each choice needs a different answer value.' })
    if (stepChoices.length > 100 || (step.questionType === 'priority' && stepChoices.length > 10)) issues.push({ stepId: step.stableId, reason: 'This question exceeds its configured choice limit.' })
    if (!questionSettings(step, stepChoices).valid) issues.push({ stepId: step.stableId, reason: 'This question has invalid type-specific settings.' })
    if (step.kind === 'completion' && step.nextStepStableId) issues.push({ stepId: step.stableId, reason: 'A completion screen cannot lead to another step.' })
    if (step.kind !== 'completion' && !step.nextStepStableId) issues.push({ stepId: step.stableId, reason: 'Every non-completion step needs a default path.' })
    if (step.nextStepStableId && !byStableId.has(step.nextStepStableId)) issues.push({ stepId: step.stableId, reason: 'The default path points to a missing step.' })
  }

  const validRules: StoredBranchRule[] = []
  for (const rule of rules) {
    const source = byStableId.get(rule.sourceStepStableId)
    const destination = byStableId.get(rule.destinationStepStableId)
    if (!source || source.kind !== 'question') {
      issues.push({ stepId: rule.sourceStepStableId, reason: 'A branch must start at an existing question.' })
      continue
    }
    if (!destination || (destination.kind !== 'question' && destination.kind !== 'completion')) {
      issues.push({ stepId: rule.sourceStepStableId, reason: 'A branch must point to an existing question or completion screen.' })
      continue
    }
    const sourceChoiceIds = (choicesByStep.get(source.id) ?? []).map((choice) => choice.stableId)
    if (!branchRuleIsValid(rule, source, sourceChoiceIds)) issues.push({ stepId: source.stableId, reason: 'This branch predicate does not match the source question type or stable choices.' })
    else validRules.push(rule)
  }

  const first = steps.slice().sort((left, right) => left.position - right.position)[0]
  if (!first) return issues
  if (first.kind === 'completion') issues.push({ stepId: first.stableId, reason: 'The first screen must be a welcome screen or question.' })
  const edges = new Map<string, string[]>()
  for (const step of steps) {
    const stepChoices = choicesByStep.get(step.id) ?? []
    const settings = questionSettings(step, stepChoices)
    const destinations = settings.valid ? reachableDestinations(step, stepChoices.map((choice) => choice.stableId), settings.value, validRules.filter((rule) => rule.sourceStepStableId === step.stableId), selection) : []
    edges.set(step.stableId, destinations)
  }
  const visiting = new Set<string>()
  const visited = new Map<string, boolean>()
  const walk = (stepId: string): boolean => {
    if (visiting.has(stepId)) {
      issues.push({ stepId, reason: 'Every possible respondent path must terminate without a cycle.' })
      return false
    }
    if (visited.has(stepId)) return visited.get(stepId)!
    const step = byStableId.get(stepId)
    if (!step) return false
    visiting.add(stepId)
    const destinations = edges.get(stepId) ?? []
    const paths = destinations.map(walk)
    const terminates = step.kind === 'completion' || (paths.length > 0 && paths.every(Boolean))
    if (!terminates) issues.push({ stepId, reason: 'Every possible respondent path must reach a completion screen.' })
    visiting.delete(stepId)
    visited.set(stepId, terminates)
    return terminates
  }
  walk(first.stableId)
  for (const step of steps) if (!visited.has(step.stableId)) issues.push({ stepId: step.stableId, reason: 'Every published step must be reachable from the first screen.' })
  return issues
}
