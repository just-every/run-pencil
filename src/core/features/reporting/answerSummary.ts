import { finiteMidpoint } from './finiteMidpoint'

export type SummaryType = 'short_text' | 'long_text' | 'email' | 'single_choice' | 'multiple_choice' | 'dropdown' | 'rating' | 'nps' | 'number' | 'date' | 'yes_no' | 'consent' | 'priority'
export type AnswerSummary = {
  average?: number; minimum?: number; median?: number; maximum?: number
  earliest?: string; latest?: string; score?: number
  promoters?: number; passives?: number; detractors?: number
  positions?: Array<{ id: string; label: string; average: number }>
  texts?: string[]
}
/** Values are validated at collection; invalid retained data fails visibly. */
export function summarizeAnswers(type: string | null, values: unknown[], choices: Array<{ id: string; label: string }>): AnswerSummary {
  if (type === 'short_text' || type === 'long_text' || type === 'email') {
    if (!values.every(value => typeof value === 'string')) throw new Error('Invalid stored text answer')
    return { texts: values }
  }
  if (type === 'rating' || type === 'number' || type === 'nps') {
    if (!values.every((value): value is number => typeof value === 'number' && Number.isFinite(value))) throw new Error('Invalid stored numeric answer')
    if (!values.length) return {}
    const sorted = [...values].sort((a, b) => a - b)
    if (type === 'nps') {
      if (!values.every(value => Number.isInteger(value) && value >= 0 && value <= 10)) throw new Error('Invalid stored NPS answer')
      const promoters = values.filter(value => value >= 9).length
      const detractors = values.filter(value => value <= 6).length
      return { score: (promoters - detractors) / values.length * 100, promoters, detractors, passives: values.length - promoters - detractors }
    }
    if (type === 'rating') return { average: values.reduce((sum, value) => sum + value, 0) / values.length }
    const middle = Math.floor(sorted.length / 2)
    return { minimum: sorted[0], maximum: sorted.at(-1), median: sorted.length % 2 ? sorted[middle] : finiteMidpoint(sorted[middle - 1], sorted[middle]) }
  }
  if (type === 'date') {
    if (!values.every((value): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value)) throw new Error('Invalid stored calendar date')
    const sorted = [...values].sort()
    return values.length ? { earliest: sorted[0], latest: sorted.at(-1) } : {}
  }
  if (type === 'priority') {
    if (!values.every(value => Array.isArray(value) && choices.every(choice => value.includes(choice.id)))) throw new Error('Invalid stored priority answer')
    const rankings = values.filter((value): value is unknown[] => Array.isArray(value))
    return { positions: choices.map(choice => ({ ...choice, average: rankings.length ? rankings.reduce((sum, value) => sum + value.indexOf(choice.id) + 1, 0) / rankings.length : 0 })) }
  }
  if (type === null || ['single_choice', 'multiple_choice', 'dropdown', 'yes_no', 'consent'].includes(type)) return {}
  throw new Error(`Unsupported stored question type: ${type}`)
}
export function booleanAnswer(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (value && typeof value === 'object' && 'accepted' in value && typeof value.accepted === 'boolean' && 'statement' in value && typeof value.statement === 'string') return value.accepted
  throw new Error('Invalid stored yes/no or consent answer')
}
