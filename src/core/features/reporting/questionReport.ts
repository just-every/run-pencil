import { summarizeAnswers, booleanAnswer } from './answerSummary'
export type ReportStep = { revisionId: string; id: string; prompt: string; questionType: string | null; position: number; reached: number; dropped: number }
export type ReportAnswer = { revisionId: string; stepId: string; valueJson: string; source: string }
export type ReportChoice = { revisionId: string; id: string; label: string; stepId: string }

/** Both ordinary reports and comparisons use each revision's own answers/labels. */
export function composeQuestionReports(steps: ReportStep[], answers: ReportAnswer[], choices: ReportChoice[]) {
  const key = (revisionId: string, stepId: string) => `${revisionId}\0${stepId}`
  const importedByQuestion = new Map<string, number>()
  const valuesByQuestion = new Map<string, unknown[]>()
  const choicesByQuestion = new Map<string, Array<Omit<ReportChoice, 'revisionId'>>>()
  for (const answer of answers) {
    const identity = key(answer.revisionId, answer.stepId)
    if (answer.source === 'imported') importedByQuestion.set(identity, (importedByQuestion.get(identity) ?? 0) + 1)
    const values = valuesByQuestion.get(identity) ?? []
    values.push(JSON.parse(answer.valueJson)); valuesByQuestion.set(identity, values)
  }
  for (const { revisionId, ...choice } of choices) {
    const identity = key(revisionId, choice.stepId)
    const values = choicesByQuestion.get(identity) ?? []
    values.push(choice); choicesByQuestion.set(identity, values)
  }
  return steps.map(step => {
    const identity = key(step.revisionId, step.id)
    const values = valuesByQuestion.get(identity) ?? []
    const options = choicesByQuestion.get(identity) ?? []
    const distribution = ['single_choice', 'multiple_choice', 'dropdown', 'priority'].includes(step.questionType ?? '')
      ? options.map(choice => ({ value: choice.id as unknown, label: choice.label, count: values.filter(value => Array.isArray(value) ? step.questionType === 'priority' ? value[0] === choice.id : value.includes(choice.id) : value === choice.id).length }))
      : ['rating', 'nps'].includes(step.questionType ?? '') ? [...new Set(values.filter((value): value is number => typeof value === 'number'))].sort((a, b) => a - b).map(value => ({ value: value as unknown, label: String(value), count: values.filter(answer => answer === value).length })) : ['yes_no', 'consent'].includes(step.questionType ?? '') ? [true, false].map(value => ({ value: value as unknown, label: step.questionType === 'consent' ? value ? 'Accepted' : 'Declined' : value ? 'Yes' : 'No', count: values.filter(answer => booleanAnswer(answer) === value).length })) : []
    return { ...step, importedAnswered: importedByQuestion.get(identity) ?? 0, summary: summarizeAnswers(step.questionType, values, options), choices: options, answered: values.length, distribution, distributionLabel: step.questionType === 'multiple_choice' ? 'Multiple select; shares may total more than 100%.' : step.questionType === 'priority' ? 'First-priority choices.' : 'One answer per response.' }
  })
}
