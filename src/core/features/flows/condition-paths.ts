import { visibilityCondition } from '../../shared/screenLayout'
import { publicSteps } from './serialization'
import type { Condition } from '../../shared/conditions'
import type { BranchSelection } from '../../shared/flowPolicies'
import type { GraphIssue } from './graph'
import type { StoredBranchRule, StoredChoice, StoredStep } from './repository'
import { conditionRequirementsPossible, ConditionProofError, spendConditionProof, type ConditionQuestion, type ConditionRequirement } from './condition-feasibility'

function ruleCondition(rule: StoredBranchRule): Condition {
  const tree = (rule as StoredBranchRule & { conditionJson?: string | null }).conditionJson
  return tree ? JSON.parse(tree) as Condition : { kind: 'test', stepId: rule.sourceStepStableId, operator: rule.predicateKind, value: JSON.parse(rule.expectedValueJson) }
}

/** Reachability is a property of a whole path once rules can reuse earlier
 * answers. Never memoize by step alone: two arrivals can carry contradictory
 * answer constraints and different sets of skipped questions.
 */
export function validateConditionPaths(steps: StoredStep[], choices: StoredChoice[], rules: StoredBranchRule[], selection: BranchSelection = 'first-matching-rule'): { issues: GraphIssue[]; edges: Map<string, string[]> } {
  const issues: GraphIssue[] = [], edges = new Map(steps.map(step => [step.stableId, [] as string[]]))
  const byId = new Map(steps.map(step => [step.stableId, step]))
  const questions = new Map<string, ConditionQuestion>()
  for (const step of steps.filter(step => step.kind === 'question')) {
    const ids = choices.filter(choice => choice.stepId === step.id).map(choice => choice.stableId)
    const settings = step.questionSettingsJson ? JSON.parse(step.questionSettingsJson) as Record<string, unknown> : step.questionType === 'rating' ? { min: 1, max: 5 } : step.questionType === 'multiple_choice' ? { minSelections: 1, maxSelections: ids.length } : {}
    questions.set(step.stableId, { step, choices: ids, settings: {...(step.questionType==='rating'?{min:1,max:5}:{}),...settings} })
  }
  const ordered = new Map(steps.map(step => {
    const own = rules.filter(rule => rule.sourceStepStableId === step.stableId).sort((a, b) => a.position - b.position)
    return [step.stableId, (selection === 'last-matching-rule' ? own.reverse() : own).map(rule => ({ rule, condition: ruleCondition(rule) }))] as const
  }))
  const reached = new Set<string>(), budget = { remaining: 100_000 }
  const addIssue = (stepId: string, reason: string) => {
    if (!issues.some(issue => issue.stepId === stepId && issue.reason === reason)) issues.push({ stepId, reason })
  }
  const walk = (stepId: string, path: ReadonlySet<string>, requirements: ConditionRequirement[], trail: ReadonlySet<string> = new Set()) => {
    spendConditionProof(budget)
    if (trail.has(stepId)) {
      addIssue(stepId, 'Every possible respondent path must terminate without a cycle.')
      return
    }
    const step = byId.get(stepId)
    if (!step) return
    if (step.kind === 'completion') { reached.add(stepId); return }
    const nextTrail = new Set(trail).add(stepId)
    const visibility = visibilityCondition(publicSteps([step])[0])
    const evaluateExit = (visible:boolean, nextRequirements:ConditionRequirement[]) => {
      if (!conditionRequirementsPossible(questions,nextRequirements,path,budget)) return
      if (visible) reached.add(stepId)
      const available = new Set(path)
      if (visible) available.add(stepId)
      const previous: ConditionRequirement[] = []
      let hasPath = false
      const follow = (destination: string | null, extra: ConditionRequirement[]) => {
        if (!destination) return
        const next = [...nextRequirements, ...extra]
        if (!conditionRequirementsPossible(questions, next, available, budget)) return
        hasPath = true
        const destinations = edges.get(stepId)!
        if (!destinations.includes(destination)) destinations.push(destination)
        walk(destination, available, next, nextTrail)
      }
      for (const { rule, condition } of ordered.get(stepId) ?? []) {
        follow(rule.destinationStepStableId, [...previous, { condition, matched: true, available }])
        previous.push({ condition, matched: false, available })
      }
      follow(step.nextStepStableId, previous)
      if (!hasPath) addIssue(stepId, 'Every possible respondent path must reach a completion screen.')
    }
    if (visibility) {
      evaluateExit(false,[...requirements,{condition:visibility,matched:false,available:path}])
      evaluateExit(true,[...requirements,{condition:visibility,matched:true,available:path}])
    } else evaluateExit(true,requirements)
  }
  const first = steps.slice().sort((a, b) => a.position - b.position)[0]
  if (!first) return { issues, edges }
  try {
    walk(first.stableId, new Set(), [])
    for (const step of steps) if (!reached.has(step.stableId)) addIssue(step.stableId, 'Every published step must be reachable from the first screen.')
  } catch (error) {
    if (!(error instanceof ConditionProofError)) throw error
    addIssue(first.stableId, error.message)
  }
  return { issues, edges }
}
