import type { FlowStep, ChoiceOption } from '../app/api'
import { calendarDate } from './questionTypes'
import { conditionOperators, type Condition, type ConditionOperator } from './conditions'
import manifest from '../../../seed.json' with { type: 'json' }

export function operatorsFor(type: string | null): ConditionOperator[] {
  const common: ConditionOperator[] = ['is_answered', 'is_blank']
  if (['single_choice', 'dropdown'].includes(type ?? '')) return ['equals', 'not_equals', 'any_of', 'none_of', ...common]
  if (type === 'multiple_choice') return ['any_of', 'all_of', 'none_of', 'exactly', ...common]
  if (['yes_no', 'consent', 'thumbs_rating'].includes(type ?? '')) return ['equals', 'not_equals', ...common]
  if (['number', 'rating', 'nps', 'csat', 'ces', 'emoji_rating', 'date', 'priority'].includes(type ?? '')) return ['equals', 'not_equals', 'greater_than', 'greater_than_or_equal', 'less_than', 'less_than_or_equal', ...common]
  if (['short_text','long_text','email','url','phone'].includes(type ?? '')) return ['equals','not_equals',...common]
  return common
}

/** Boundary shape validation is bounded before descending through client JSON. */
export function conditionShape(value: unknown): value is Condition {
  let count = 0
  const visit = (item: unknown, depth: number): boolean => {
    if (!item || typeof item !== 'object' || Array.isArray(item) || depth > manifest.limits.logic.groupDepth) return false
    const node = item as Record<string, unknown>
    if (node.kind === 'group') return Object.keys(node).every(key => ['kind','join','conditions'].includes(key)) && ['and','or'].includes(String(node.join)) && Array.isArray(node.conditions) && node.conditions.length > 0 && node.conditions.every(child => visit(child, depth + 1))
    return node.kind === 'test' && ++count <= manifest.limits.logic.conditionsPerRule && Object.keys(node).every(key => ['kind','stepId','operator','value'].includes(key)) && typeof node.stepId === 'string' && node.stepId.length > 0 && node.stepId.length <= 200 && conditionOperators.includes(node.operator as ConditionOperator)
  }
  return visit(value, 0)
}

export function conditionValueValid(test: Extract<Condition, { kind: 'test' }>, step: FlowStep, choices: ChoiceOption[]): boolean {
  if (!operatorsFor(step.questionType).includes(test.operator)) return false
  if (['is_blank','is_answered'].includes(test.operator)) return test.value === undefined || test.value === null
  const value = test.value, ids = choices.filter(choice => choice.stepId === step.id).map(choice => choice.id)
  const set = () => Array.isArray(value) && value.length > 0 && new Set(value).size === value.length && value.every(item => typeof item === 'string' && ids.includes(item))
  if (['single_choice','dropdown'].includes(step.questionType ?? '')) return ['any_of','none_of'].includes(test.operator) ? set() : typeof value === 'string' && ids.includes(value)
  if (step.questionType === 'multiple_choice') return set()
  if (['yes_no','consent','thumbs_rating'].includes(step.questionType ?? '')) return typeof value === 'boolean'
  if (step.questionType === 'date') return calendarDate(value)
  if (step.questionType === 'priority') return ['equals','not_equals'].includes(test.operator) ? set() && (value as string[]).length === ids.length : !!value && typeof value === 'object' && 'choiceId' in value && ids.includes(String(value.choiceId)) && 'rank' in value && Number.isInteger(value.rank) && Number(value.rank) >= 1 && Number(value.rank) <= ids.length
  if (['short_text','long_text','email','url','phone'].includes(step.questionType ?? '')) return typeof value === 'string' && value.trim().length > 0 && value.length <= 1000
  return typeof value === 'number' && Number.isFinite(value)
}
