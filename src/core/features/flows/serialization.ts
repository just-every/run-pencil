import type { StoredStep, StoredChoice, StoredBranchRule } from './repository'

export function publicSteps(steps: StoredStep[]) {
  return steps.map(step => ({
    id: step.stableId, position: step.position, kind: step.kind, questionType: step.questionType,
    prompt: step.prompt, helperText: step.helperText, required: step.required, nextStepId: step.nextStepStableId,
    questionSettings: step.questionSettingsJson ? JSON.parse(step.questionSettingsJson) : null,
  }))
}
export function publicChoices(steps: StoredStep[], choices: StoredChoice[]) {
  const stepStableIds = new Map(steps.map(step => [step.id, step.stableId]))
  return choices.map(choice => ({
    id: choice.stableId, stepId: stepStableIds.get(choice.stepId) ?? choice.stepId, value: choice.value,
    label: choice.label, position: choice.position,
  }))
}
export function publicRules(rules: StoredBranchRule[]) {
  return rules.map(rule => ({
    id: rule.id, sourceStepId: rule.sourceStepStableId, predicateKind: rule.predicateKind,
    expectedValue: JSON.parse(rule.expectedValueJson), destinationStepId: rule.destinationStepStableId, position: rule.position,
    ...(rule.conditionJson ? { condition: JSON.parse(rule.conditionJson) as import('../../shared/conditions').Condition } : {}),
  }))
}
