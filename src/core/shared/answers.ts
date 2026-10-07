export type AnswerQuestion = {
  prompt: string
  questionType: 'short_text' | 'long_text' | 'email' | 'single_choice' | 'multiple_choice' | 'rating' | 'priority' | null
  required: boolean
  questionSettings: Record<string, unknown> | null
}
export function isUnanswered(value: unknown) {
  return value === undefined || value === null || (typeof value === 'string' && !value.trim()) || (Array.isArray(value) && value.length === 0)
}
export function answerIssue(step: AnswerQuestion, choiceIds: string[], value: unknown): string | undefined {
  if (isUnanswered(value)) return step.required ? `An answer is required for “${step.prompt}”.` : undefined
  const settings = step.questionSettings ?? {}
  switch (step.questionType) {
    case 'short_text': return typeof value === 'string' && value.length <= 200 ? undefined : 'Enter text within 200 characters.'
    case 'long_text': return typeof value === 'string' && value.length <= 5000 ? undefined : 'Enter text within 5,000 characters.'
    case 'email': return typeof value === 'string' && value.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? undefined : 'Enter a valid email address.'
    case 'single_choice': return typeof value === 'string' && choiceIds.includes(value) ? undefined : 'Choose one of the available options.'
    case 'multiple_choice': {
      const min = typeof settings.minSelections === 'number' ? settings.minSelections : 1
      const max = typeof settings.maxSelections === 'number' ? settings.maxSelections : choiceIds.length
      return Array.isArray(value) && value.every((id) => typeof id === 'string' && choiceIds.includes(id)) && new Set(value).size === value.length && value.length >= min && value.length <= max ? undefined : `Choose between ${min} and ${max} distinct options.`
    }
    case 'rating': {
      const min = typeof settings.min === 'number' ? settings.min : 1
      const max = typeof settings.max === 'number' ? settings.max : 5
      return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max ? undefined : `Choose a whole-number rating between ${min} and ${max}.`
    }
    case 'priority': return Array.isArray(value) && value.length === choiceIds.length && new Set(value).size === value.length && value.every((id) => typeof id === 'string' && choiceIds.includes(id)) ? undefined : 'Select every option once, in priority order.'
    default: return 'This question has no valid answer type.'
  }
}
