import type { BranchRule, FlowStep, PublicFlow } from '../app/api'
import { matchesBranch } from './branching'
type AnswerValues = Record<string, unknown>

export function visiblePath(flow: Pick<PublicFlow, 'steps' | 'branchRules' | 'branchSelection'>, answers: AnswerValues) {
  const steps = flow.steps.filter((step) => step.kind === 'welcome' || step.kind === 'question' || step.kind === 'completion').sort((left, right) => left.position - right.position)
  const byId = new Map(steps.map((step) => [step.id, step]))
  const rulesBySource = new Map<string, BranchRule[]>()
  for (const rule of flow.branchRules.slice().sort((left, right) => left.position - right.position)) rulesBySource.set(rule.sourceStepId, [...(rulesBySource.get(rule.sourceStepId) ?? []), rule])

  const path: FlowStep[] = []
  const visited = new Set<string>()
  let current: FlowStep | undefined = steps[0]
  while (current && !visited.has(current.id)) {
    const step: FlowStep = current
    path.push(step)
    visited.add(step.id)
    if (step.kind === 'completion') break
    const rules: BranchRule[] = rulesBySource.get(step.id) ?? []
    const selected: BranchRule | undefined = (flow.branchSelection === 'last-matching-rule' ? rules.slice().reverse() : rules).find((rule) => matchesBranch(rule, answers[step.id]))
    current = selected ? byId.get(selected.destinationStepId) : step.nextStepId ? byId.get(step.nextStepId) : undefined
  }
  return path
}
