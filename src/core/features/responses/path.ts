import type { FormSettings, ResponseContext } from '../../shared/hiddenFields'
import { formAnswerContext } from '../../shared/calculationContext'
import type { BranchSelection } from '../../shared/flowPolicies'
import { visibilityCondition } from '../../shared/screenLayout'
import { evaluateCondition } from '../../shared/conditions'
import { answerIssue, isUnanswered } from '../../shared/answers'
import { publicSteps, questionSettings, resolveNextStep, type StoredBranchRule, type StoredChoice, type StoredStep } from '../flows'
import { ValidationError } from '../../shared/errors'

export type AnswerInput = { stepId: string; value: unknown }
function normalizeOptional(value: unknown) { return isUnanswered(value) ? undefined : value }

export function retainedCompletion(steps: StoredStep[], rules: StoredBranchRule[], answers: Record<string, unknown>, selection: BranchSelection) {
  // This evidence already passed the admission rules in force at commitment.
  // Trace its pinned graph; never reject or rewrite it under newer validation.
  const byStableId = new Map(steps.map((step) => [step.stableId, step]))
  const visited = new Set<string>()
  let current: StoredStep | undefined = steps[0]
  while (current && !visited.has(current.stableId)) {
    visited.add(current.stableId)
    if (current.kind === 'completion') return current.stableId
    const step: StoredStep = current
    const next = resolveNextStep({ selection, step, rules: rules.filter((rule) => rule.sourceStepStableId === step.stableId), answers })
    current = next.nextStepId ? byStableId.get(next.nextStepId) : undefined
  }
  throw new ValidationError('The retained completion could not be read. This response has not been resubmitted.')
}

export function validatePathAnswers(steps: StoredStep[], choices: StoredChoice[], rules: StoredBranchRule[], answers: AnswerInput[], selection: BranchSelection, context:Record<string,unknown> = {}, settings?:FormSettings) {
  const submitted = new Map<string, unknown>()
  for (const answer of answers) {
    if (submitted.has(answer.stepId)) throw new ValidationError('Each question can be answered once per submission.')
    submitted.set(answer.stepId, answer.value)
  }
  const choicesByStep = new Map<string, StoredChoice[]>()
  for (const choice of choices) choicesByStep.set(choice.stepId, [...(choicesByStep.get(choice.stepId) ?? []), choice])
  const byStableId = new Map(steps.map((step) => [step.stableId, step]))
  const first = steps[0]
  if (!first) throw new ValidationError('This published flow has no first screen.')
  const accepted: AnswerInput[] = []
  const values=()=>formAnswerContext(settings,Object.fromEntries(accepted.map(answer=>[answer.stepId,answer.value])),{hidden:Object.fromEntries(Object.entries(context).filter(([id])=>id.startsWith('hidden:')).map(([id,value])=>[id.slice(7),value])) as ResponseContext['hidden']})
  const reached = new Set<string>()
  const visited = new Set<string>()
  let current: StoredStep | undefined = first
  while (current && !visited.has(current.stableId)) {
    visited.add(current.stableId)
    const visible: boolean = !visibilityCondition(publicSteps([current])[0]) || evaluateCondition(visibilityCondition(publicSteps([current])[0])!, values()).matched
    if(visible) reached.add(current.stableId)
    if (current.kind === 'question' && visible) {
      const value = normalizeOptional(submitted.get(current.stableId))
      if (value === undefined) {
        if (current.required) throw new ValidationError(`A response is required for “${current.prompt}”.`)
      } else {
        validateQuestionValue(current, choicesByStep.get(current.id) ?? [], value)
        accepted.push({ stepId: current.stableId, value })
      }
    }
    if (current.kind === 'completion') break
    const answerRecord = values()
    const next: {nextStepId:string|null} = resolveNextStep({ selection, step: current, rules: rules.filter((rule) => rule.sourceStepStableId === current!.stableId), answers: answerRecord })
    current = next.nextStepId ? byStableId.get(next.nextStepId) : undefined
  }
  if (!current || current.kind !== 'completion') throw new ValidationError('The selected respondent path does not reach a completion screen.')
  const unknown = [...submitted.keys()].filter((stepId) => !byStableId.has(stepId))
  if (unknown.length > 0) throw new ValidationError('A submitted answer does not belong to this published flow.')
  // PAY-001: publication proves at most one payment step on a path; this is the one this response pays at.
  const paymentStepId = [...reached].find(id => byStableId.get(id)?.kind === 'payment')
  return { accepted, completionStepId: current.stableId, reachedStepIds: [...reached], paymentStepId }
}

function validateQuestionValue(step: StoredStep, choices: StoredChoice[], value: unknown) {
  const issue = answerIssue({ ...step, questionSettings: questionSettings(step, choices).value }, choices.map((choice) => choice.stableId), value)
  if (issue) throw new ValidationError(`“${step.prompt}”: ${issue}`, [{ stepId: step.stableId, reason: issue }])
}
