import { contactQuestionTypes, normalizeContactAnswer } from '../../shared/contactAnswers'
import type { StoredStep } from '../flows'
import { questionSettings } from '../flows'
import { ValidationError } from '../../shared/errors'

export function storedAnswerValue(step: StoredStep, value: unknown) {
  if ((contactQuestionTypes as readonly string[]).includes(step.questionType ?? '')) return normalizeContactAnswer(step.questionType!, value)
  if (step.questionType !== 'consent') return value
  const statement = questionSettings(step, []).value.statement
  if (typeof value !== 'boolean' || typeof statement !== 'string') throw new ValidationError('The consent answer or published statement is invalid.')
  return { accepted: value, statement }
}
export function runtimeAnswerValue(step: StoredStep | undefined, value: unknown) {
  if (step?.questionType !== 'consent') return value
  if (!value || typeof value !== 'object' || Array.isArray(value) || !('accepted' in value) || typeof value.accepted !== 'boolean' || !('statement' in value) || typeof value.statement !== 'string') throw new ValidationError('The retained consent answer is invalid.')
  return value.accepted
}
