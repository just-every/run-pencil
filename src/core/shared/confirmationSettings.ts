import { remapAnswerRecall, validateAnswerRecall, type FlowGraph, type RecallIssue } from './answerRecall'
import { questionTypes } from './questionKinds'

export type ConfirmationSettings = {
  enabled: boolean
  includeAnswers: boolean
  answerTypes: string[]
  emailStepId?: string
  subject: string
  body: string
}

/** Absence is off; answer inclusion always requires an explicit type selection. */
export function confirmationSettingsIssue(value: unknown): string | undefined {
  if (value === undefined) return undefined
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'Choose valid confirmation email settings.'
  const settings = value as Record<string, unknown>
  if (Object.keys(settings).some(key => !['enabled', 'includeAnswers', 'answerTypes', 'emailStepId', 'subject', 'body'].includes(key))) return 'Unknown confirmation email setting.'
  if (typeof settings.enabled !== 'boolean' || typeof settings.includeAnswers !== 'boolean') return 'Choose whether confirmation emails and answer copies are enabled.'
  if (!Array.isArray(settings.answerTypes) || settings.answerTypes.length > questionTypes.length || settings.answerTypes.some(type => typeof type !== 'string' || !(questionTypes as readonly string[]).includes(type)) || new Set(settings.answerTypes).size !== settings.answerTypes.length) return 'Choose distinct supported answer types for the confirmation email.'
  if (settings.emailStepId !== undefined && (typeof settings.emailStepId !== 'string' || !/^[A-Za-z0-9_-]{1,256}$/.test(settings.emailStepId))) return 'Choose a valid email question.'
  if (typeof settings.subject !== 'string' || !settings.subject.trim() || settings.subject.length > 200) return 'Enter a confirmation subject of at most 200 characters.'
  if (typeof settings.body !== 'string' || !settings.body.trim() || settings.body.length > 4000) return 'Enter a confirmation message of at most 4000 characters.'
}

export function confirmationPublicationIssues(settings: ConfirmationSettings | undefined, flow: FlowGraph): RecallIssue[] {
  if (!settings) return []
  const issues: RecallIssue[] = []
  if (settings.emailStepId && !flow.steps.some(step => step.id === settings.emailStepId && step.kind === 'question' && step.questionType === 'email')) issues.push({ stepId: settings.emailStepId, reason: 'The confirmation recipient must be an existing email question.' })
  if (!settings.enabled) return issues
  const completionIds = new Set(flow.steps.filter(step => step.kind === 'completion').map(step => step.id))
  const confirmationFlow = { ...flow, steps: flow.steps.map(step => step.kind === 'completion' ? { ...step, prompt: settings.subject, helperText: settings.body } : step) }
  return [...issues, ...validateAnswerRecall(confirmationFlow).filter(issue => completionIds.has(issue.stepId))]
}

export function remapConfirmationSettings(settings: ConfirmationSettings | undefined, ids: ReadonlyMap<string, string>): ConfirmationSettings | undefined {
  if (!settings) return undefined
  return { ...settings, answerTypes: [...settings.answerTypes], ...(settings.emailStepId ? { emailStepId: ids.get(settings.emailStepId) ?? settings.emailStepId } : {}), subject: remapAnswerRecall(settings.subject, ids), body: remapAnswerRecall(settings.body, ids) }
}
