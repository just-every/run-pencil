import type { PublicFlow } from '../app/api'
import { answerIssue } from './answers'
import { visiblePath } from './flowPath'
import { ratingScale, ratingSettingsValid } from './ratingScale'

type EmailFirstFlow = Pick<PublicFlow, 'steps' | 'choices' | 'branchRules' | 'branchSelection' | 'formSettings' | 'hiddenContext'>
type EmailQuestion = { stepId: string; prompt: string; options: Array<{ value: string; label: string }> }

/** Only the first question on the unanswered published path can be embedded. */
export function emailFirstQuestion(flow: EmailFirstFlow): EmailQuestion | undefined {
  const step = visiblePath(flow, {}).find(entry => entry.kind !== 'welcome')
  if (!step || step.kind !== 'question') return undefined
  if(flow.formSettings?.prefill?.some(mapping=>mapping.stepId===step.id && mapping.locked))return undefined
  const choices = flow.choices.filter(choice => choice.stepId === step.id).sort((a, b) => a.position - b.position)
  const choiceIds = choices.map(choice => choice.id)
  let options: EmailQuestion['options']
  if (step.questionType === 'single_choice') {
    if (!choices.length || choices.length > 8 || choices.some(choice => !choice.label.trim() || choice.label.length > 80)) return undefined
    options = choices.filter(choice => !answerIssue(step, choiceIds, choice.id)).map(choice => ({ value: choice.id, label: choice.label }))
  } else {
    let min: number, max: number
    if (step.questionType === 'nps') { min = 0; max = 10 }
    else if (step.questionType === 'csat') { min = 1; max = 5 }
    else if (step.questionType === 'rating' && ratingSettingsValid(step.questionSettings ?? {})) {
      const scale = ratingScale(step.questionSettings ?? {})
      min = scale.min; max = scale.max
    } else return undefined
    options = Array.from({ length: max - min + 1 }, (_, index) => ({ value: String(min + index), label: String(min + index) }))
      .filter(option => !answerIssue(step, choiceIds, Number(option.value)))
  }
  return options.length ? { stepId: step.id, prompt: step.prompt, options } : undefined
}

/** A query hint is never an answer write. Repeated and noncanonical values are invalid. */
export function emailFirstAnswer(flow: EmailFirstFlow, raw: unknown): { stepId: string; value: number | string } | undefined {
  if (typeof raw !== 'string' && typeof raw !== 'number') return undefined
  const question = emailFirstQuestion(flow)
  if (!question) return undefined
  const step = flow.steps.find(entry => entry.id === question.stepId)!
  if (step.questionType === 'single_choice' && typeof raw !== 'string') return undefined
  const option = question.options.find(option => option.value === String(raw))
  if (!option) return undefined
  const value = step.questionType === 'single_choice' ? option.value : Number(option.value)
  if (answerIssue(step, flow.choices.filter(choice => choice.stepId === step.id).map(choice => choice.id), value)) return undefined
  return { stepId: question.stepId, value }
}
