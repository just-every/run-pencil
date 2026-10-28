import { matchesBranch, type BranchPredicate } from './branching'
import { isUnanswered } from './answers'
import { isOtherAnswer } from './otherChoices'

export const conditionOperators = ['equals', 'not_equals', 'greater_than', 'greater_than_or_equal', 'less_than', 'less_than_or_equal', 'any_of', 'all_of', 'none_of', 'exactly', 'is_blank', 'is_answered'] as const
export type ConditionOperator = typeof conditionOperators[number]
export type ConditionValue = string | number | boolean | string[] | { choiceId: string; rank: number } | null
export type Condition = { kind: 'group'; join: 'and' | 'or'; conditions: Condition[] } | { kind: 'test'; stepId: string; rowId?: string; operator: ConditionOperator; value?: ConditionValue }
export type ConditionTrace = { matched: boolean; condition: Condition; value?: unknown; children?: ConditionTrace[] }

export function evaluateCondition(condition: Condition, answers: Record<string, unknown>): ConditionTrace {
  if (condition.kind === 'group') {
    const children = condition.conditions.map(child => evaluateCondition(child, answers))
    return { condition, children, matched: condition.join === 'and' ? children.every(child => child.matched) : children.some(child => child.matched) }
  }
  let value = answers[condition.stepId]
  if (condition.rowId !== undefined) value = value && typeof value === 'object' && !Array.isArray(value) && Object.hasOwn(value, condition.rowId) ? (value as Record<string, unknown>)[condition.rowId] : undefined
  if (value && typeof value === 'object' && 'accepted' in value) value = (value as { accepted: unknown }).accepted
  const blank = isUnanswered(value)
  let matched = false
  if (condition.operator === 'is_blank') matched = blank
  else if (condition.operator === 'is_answered') matched = !blank
  else if (!blank) {
    if (typeof value === 'string' && typeof condition.value === 'string' && ['equals','not_equals'].includes(condition.operator)) {
      const equal = value.trim().normalize('NFC').toLowerCase() === condition.value.trim().normalize('NFC').toLowerCase()
      return {condition,value,matched:condition.operator === 'equals' ? equal : !equal}
    }
    const selected = isOtherAnswer(value) ? value.choiceIds : Array.isArray(value) ? value : [value]
    if (condition.operator === 'not_equals') matched = !matchesBranch({ predicateKind: 'equals', expectedValue: condition.value }, value)
    else if (condition.operator === 'none_of') matched = Array.isArray(condition.value) && !condition.value.some(item => selected.includes(item))
    else if (condition.operator === 'exactly') matched = Array.isArray(condition.value) && selected.length === condition.value.length && selected.every(item => (condition.value as unknown[]).includes(item))
    else if (condition.operator === 'any_of' || condition.operator === 'all_of') matched = matchesBranch({ predicateKind: condition.operator, expectedValue: condition.value }, selected)
    else matched = matchesBranch({ predicateKind: condition.operator as BranchPredicate, expectedValue: condition.value }, value)
  }
  return { condition, value: value ?? null, matched }
}

export function conditionTests(condition: Condition): Extract<Condition, { kind: 'test' }>[] {
  return condition.kind === 'test' ? [condition] : condition.conditions.flatMap(conditionTests)
}
export function remapCondition(condition: Condition, steps: ReadonlyMap<string, string>, choices: ReadonlyMap<string, string>): Condition {
  if (condition.kind === 'group') return { ...condition, conditions: condition.conditions.map(child => remapCondition(child, steps, choices)) }
  const map = (value: unknown): unknown => typeof value === 'string' ? choices.get(value) ?? value : Array.isArray(value) ? value.map(map) : value && typeof value === 'object' && 'choiceId' in value ? { ...value, choiceId: choices.get(String(value.choiceId)) ?? value.choiceId } : value
  return { ...condition, stepId: steps.get(condition.stepId) ?? condition.stepId, ...(condition.value !== undefined ? { value: map(condition.value) as ConditionValue } : {}) }
}
