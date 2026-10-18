import manifest from '../../../seed.json'

export const formLimits = manifest.limits
export function choiceLimit(type: string | null) {
  return type === 'dropdown' ? formLimits.questions.dropdownChoices : type === 'priority' ? formLimits.steps.priorityOptionsPerStep : formLimits.steps.choiceOptionsPerStep
}
export function structureLimitIssue(steps: Array<{ kind: string }>) {
  if (steps.filter(step => step.kind === 'question').length > formLimits.questions.perRevision) return 'This form exceeds its configured question limit.'
  if (steps.filter(step => step.kind !== 'question').length > formLimits.steps.structurePerRevision) return 'This form exceeds its configured screen limit.'
  if (steps.length > formLimits.steps.perRevision) return 'This form exceeds its configured step limit.'
}
