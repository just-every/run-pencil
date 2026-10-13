import { publicChoices, publicRules, publicSteps } from './serialization'
import type { StoredStep, StoredChoice, StoredBranchRule } from './repository'

export function structureContent(steps: StoredStep[], choices: StoredChoice[], rules: StoredBranchRule[]) {
  return JSON.stringify({
    steps: publicSteps(steps),
    choices: publicChoices(steps, choices).sort((a, b) => a.stepId.localeCompare(b.stepId) || a.position - b.position),
    rules: publicRules(rules).map(({ id: _id, ...rule }) => rule).sort((a, b) => a.sourceStepId.localeCompare(b.sourceStepId) || a.position - b.position),
  })
}
