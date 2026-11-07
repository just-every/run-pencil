import type { FlowStep, ChoiceOption } from '../app/api'
import { matrixAnswerIssue, matrixRows } from './matrix'

export type ResponseQualitySettings = { straightLining: boolean }

export function responseQualityIssue(value: unknown): string | undefined {
  if (value === undefined) return
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).some(key => key !== 'straightLining') ||
      typeof (value as ResponseQualitySettings).straightLining !== 'boolean') {
    return 'Choose whether to check matrix straight-lining.'
  }
}

/** Check only complete, valid single-selection grids with at least two rows. */
export function hasStraightLinedMatrix(steps: FlowStep[], choices: ChoiceOption[], answers: Array<{ stepId: string; value: unknown }>): boolean {
  return answers.some(answer => {
    const step = steps.find(step => step.id === answer.stepId)
    const settings = step?.questionSettings
    if (step?.questionType !== 'matrix' || !settings || !['single', 'likert5', 'likert7'].includes(String(settings.matrixMode))) return false
    const rows = matrixRows(settings)
    if (rows.length < 2 || matrixAnswerIssue(settings, choices.filter(choice => choice.stepId === step.id).map(choice => choice.id), answer.value, true)) return false
    const values = answer.value as Record<string, string>
    return rows.every(row => values[row.id] === values[rows[0].id])
  })
}
