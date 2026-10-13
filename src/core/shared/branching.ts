import { calendarDate } from './questionTypes'
export type BranchPredicate = 'equals' | 'greater_than' | 'greater_than_or_equal' | 'less_than' | 'less_than_or_equal' | 'any_of' | 'all_of'

export function matchesBranch(rule: { predicateKind: BranchPredicate; expectedValue: unknown }, answer: unknown): boolean {
  const expected = rule.expectedValue
  const priorityRank = () => {
    if (!Array.isArray(answer) || !expected || Array.isArray(expected) || typeof expected !== 'object') return undefined
    const { choiceId, rank } = expected as { choiceId?: unknown; rank?: unknown }
    if (typeof choiceId !== 'string' || !Number.isInteger(rank)) return undefined
    const actualRank = answer.indexOf(choiceId) + 1
    return actualRank > 0 ? { actualRank, expectedRank: rank as number } : undefined
  }
  switch (rule.predicateKind) {
    case 'equals':
      if (Array.isArray(answer) && Array.isArray(expected)) return answer.length === expected.length && answer.every((value, index) => value === expected[index])
      return answer === expected
    case 'greater_than':
      return (typeof answer === 'number' && typeof expected === 'number' && answer > expected) || (calendarDate(answer) && calendarDate(expected) && answer > expected) || (() => { const value = priorityRank(); return Boolean(value && value.actualRank > value.expectedRank) })()
    case 'greater_than_or_equal':
      return (typeof answer === 'number' && typeof expected === 'number' && answer >= expected) || (calendarDate(answer) && calendarDate(expected) && answer >= expected) || (() => { const value = priorityRank(); return Boolean(value && value.actualRank >= value.expectedRank) })()
    case 'less_than':
      return (typeof answer === 'number' && typeof expected === 'number' && answer < expected) || (calendarDate(answer) && calendarDate(expected) && answer < expected) || (() => { const value = priorityRank(); return Boolean(value && value.actualRank < value.expectedRank) })()
    case 'less_than_or_equal':
      return (typeof answer === 'number' && typeof expected === 'number' && answer <= expected) || (calendarDate(answer) && calendarDate(expected) && answer <= expected) || (() => { const value = priorityRank(); return Boolean(value && value.actualRank <= value.expectedRank) })()
    case 'any_of':
      return Array.isArray(answer) && Array.isArray(expected) && answer.some((value) => typeof value === 'string' && expected.includes(value))
    case 'all_of':
      return Array.isArray(answer) && Array.isArray(expected) && expected.every((value) => typeof value === 'string' && answer.includes(value))
  }
}
