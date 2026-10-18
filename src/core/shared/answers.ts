import { otherChoiceIssue } from './otherChoices'
import type { QuestionType } from './questionKinds'
import { contactQuestionTypes, contactAnswerIssue } from './contactAnswers'
import { scoreQuestionTypes, scoreAnswerIssue } from './scoreQuestions'
import { textAnswerIssue } from './textValidation'
import { dateFormat } from './dateFormat'
import { calendarDate, decimalPlaces, typeSettingsValid } from './questionTypes'
export type AnswerQuestion = {
  prompt: string
  questionType: QuestionType | null
  required: boolean
  questionSettings: Record<string, unknown> | null
}
export function isUnanswered(value: unknown) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const parts = Object.entries(value).filter(([key]) => key !== 'country')
    if (parts.every(([, part]) => typeof part === 'string' && !part.trim())) return true
  }
  return value === undefined || value === null || (typeof value === 'string' && !value.trim()) || (Array.isArray(value) && value.length === 0)
}
export function answerIssue(step: AnswerQuestion, choiceIds: string[], value: unknown): string | undefined {
  if (isUnanswered(value)) return step.required ? `An answer is required for “${step.prompt}”.` : undefined
  const settings = step.questionSettings ?? {}
  if (!typeSettingsValid(step.questionType, settings)) return 'This question has invalid settings.'
  if ((contactQuestionTypes as readonly string[]).includes(step.questionType ?? '')) return contactAnswerIssue(step.questionType!, value)
  if ((scoreQuestionTypes as readonly string[]).includes(step.questionType ?? '')) return scoreAnswerIssue(step.questionType!, value)
  switch (step.questionType) {
    case 'short_text':
    case 'long_text': return textAnswerIssue(step.questionType, settings, value)
    case 'email': return typeof value === 'string' && value.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? undefined : 'Enter a valid email address.'
    case 'dropdown':
    case 'single_choice': return otherChoiceIssue(step.questionType, settings, choiceIds, value)
    case 'multiple_choice': {
      return otherChoiceIssue(step.questionType, settings, choiceIds, value)
    }
    case 'yes_no': return typeof value === 'boolean' ? undefined : 'Choose Yes or No.'
    case 'consent': return typeof value === 'boolean' && (!step.required || value) ? undefined : 'Consent is required to continue.'
    case 'number': return typeof value === 'number' && Number.isFinite(value) && (settings.min === undefined || value >= (settings.min as number)) && (settings.max === undefined || value <= (settings.max as number)) && (settings.decimalPlaces === undefined || decimalPlaces(value) <= (settings.decimalPlaces as number)) ? undefined : 'Enter a number within the configured range and precision.'
    case 'date': return calendarDate(value) && (settings.earliest === undefined || value >= (settings.earliest as string)) && (settings.latest === undefined || value <= (settings.latest as string)) ? undefined : `Enter a valid date in ${dateFormat(settings).label} format within the configured range.`
    case 'nps': return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 10 ? undefined : 'Choose a whole-number score from 0 to 10.'
    case 'rating': {
      const min = typeof settings.min === 'number' ? settings.min : 1
      const max = typeof settings.max === 'number' ? settings.max : 5
      return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max ? undefined : `Choose a whole-number rating between ${min} and ${max}.`
    }
    case 'priority': return Array.isArray(value) && value.length === choiceIds.length && new Set(value).size === value.length && value.every((id) => typeof id === 'string' && choiceIds.includes(id)) ? undefined : 'Select every option once, in priority order.'
    default: return 'This question has no valid answer type.'
  }
}
