import { object } from './fields'
import { googleChoiceAnswer } from './choice-values'
import { importedAnswer } from './response-mapping'
import { googleIdentity, type ImportForm, type ImportStep } from './model'

export function googleJsonAnswers(definition: Record<string, any>, form: ImportForm) {
  const known = new Set<string>()
  for (const raw of definition.items ?? []) {
    const item = object(raw)
    if (item.questionItem) known.add(object(object(item.questionItem).question).questionId)
    for (const question of object(item.questionGroupItem).questions ?? []) known.add(object(question).questionId)
  }
  return (key: string, raw: unknown): { step: ImportStep; value: unknown } | undefined => {
    const answer = object(raw)
    if (answer.questionId !== key || !known.has(key)) throw new Error('Google answer question identity is unknown or does not match its key.')
    const step = form.steps.find(s => s.kind === 'question' && s.sourceId === key)
    // Omitted private/file/grid source questions retain their explicit definition review.
    if (!step) return
    if (googleIdentity(step.prompt) && step.questionType !== 'email') throw new Error('Collected identity requires an explicitly selected ordinary email question; it never becomes contact or authentication identity.')
    const entries = object(answer.textAnswers).answers
    if (!Array.isArray(entries) || Object.hasOwn(answer, 'fileUploadAnswers') || entries.some(v => typeof object(v).value !== 'string')) throw new Error('Google answers require documented textAnswers string values.')
    const values = entries.map(v => object(v).value as string)
    if (!values.length) return
    let value: unknown
    if (['single_choice', 'multiple_choice', 'dropdown'].includes(step.questionType!)) value = googleChoiceAnswer(values, step)
    else {
      if (values.length !== 1) throw new Error('This Google question requires exactly one answer value.')
      value = importedAnswer(values[0], step, {})
    }
    return { step, value }
  }
}
