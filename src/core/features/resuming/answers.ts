import { formAnswerContext } from '../../shared/calculationContext'
import { formSettings } from '../../shared/hiddenFields'
import { publicChoices, publicRules, publicSteps, questionSettings, resolveNextStep, type StoredBranchRule, type StoredChoice, type StoredStep } from '../flows'
import { visibilityCondition } from '../../shared/screenLayout'
import { evaluateCondition } from '../../shared/conditions'
import { answerIssue, isUnanswered } from '../../shared/answers'
import { revisionBranchSelection } from '../../shared/flowPolicies'
import { ValidationError } from '../../shared/errors'

type Answer = { stepId: string; value: unknown }
type Graph = { steps: StoredStep[]; choices: StoredChoice[]; rules: StoredBranchRule[] }

/** Explicit save accepts a valid prefix and optional answers still on its
 * selected path. Hidden branches and required gaps before the current screen
 * cannot be persisted as a response to another question. */
export function validateSavedAnswers(graph: Graph, policy: string | null, currentStepId: string, answers: Answer[], context:Record<string,unknown>={},settings?:import('../../shared/hiddenFields').FormSettings) {
  const submitted = new Map<string, unknown>()
  for (const answer of answers) {
    if (submitted.has(answer.stepId)) throw new ValidationError('Each saved question can be answered once.')
    submitted.set(answer.stepId, answer.value)
  }
  const byId = new Map(graph.steps.map(step => [step.stableId, step]))
  const values=()=>formAnswerContext(settings,Object.fromEntries(accepted.map(answer=>[answer.stepId,answer.value])),{hidden:Object.fromEntries(Object.entries(context).filter(([id])=>id.startsWith('hidden:')).map(([id,value])=>[id.slice(7),value])) as import('../../shared/hiddenFields').ResponseContext['hidden']})
  const accepted: Answer[] = [], visited = new Set<string>(), traversed = new Set<string>()
  let step: StoredStep | undefined = graph.steps[0], foundCurrent = false
  while (step && !traversed.has(step.stableId)) {
    traversed.add(step.stableId)
    const condition = visibilityCondition(publicSteps([step])[0])
    const visible = !condition || evaluateCondition(condition,values()).matched
    if(visible)visited.add(step.stableId)
    if (visible && step.stableId === currentStepId) foundCurrent = true
    if (visible && step.kind === 'question') {
      const value = submitted.get(step.stableId)
      if (isUnanswered(value)) {
        if (!foundCurrent && step.required) throw new ValidationError('Answer the required questions before this screen before saving.')
      } else {
        const choices = graph.choices.filter(choice => choice.stepId === step!.id)
        const issue = answerIssue({ ...step, questionSettings: questionSettings(step, choices).value }, choices.map(choice => choice.stableId), value)
        if (issue) throw new ValidationError(`“${step.prompt}”: ${issue}`, [{ stepId: step.stableId, reason: issue }])
        accepted.push({ stepId: step.stableId, value })
      }
    }
    if (step.kind === 'completion') break
    const next = resolveNextStep({ selection: revisionBranchSelection(policy), step, rules: graph.rules.filter(rule => rule.sourceStepStableId === step!.stableId), answers: values() })
    step = next.nextStepId ? byId.get(next.nextStepId) : undefined
  }
  if (!foundCurrent || byId.get(currentStepId)?.kind === 'completion') throw new ValidationError('Choose a screen on your unfinished response before saving.')
  if ([...submitted.keys()].some(id => !visited.has(id) || byId.get(id)?.kind !== 'question')) throw new ValidationError('A saved answer is outside the selected response path.')
  return accepted
}

export function resumedPublicFlow(flow: { id: string; slug: string }, revision: { id: string; number: number; title: string; publishedAt: string | null; deadlineAt: string | null; targetCompletedResponses: number | null; policySnapshotJson: string | null; formSettingsJson?:string }, graph: Graph, identified: boolean, completionStepId?: string) {
  return { formSettings:formSettings(revision.formSettingsJson), branchSelection: revisionBranchSelection(revision.policySnapshotJson), flow: { id: flow.id, slug: flow.slug, title: revision.title }, revision: { id: revision.id, number: revision.number, publishedAt: revision.publishedAt, deadlineAt: revision.deadlineAt, targetCompletedResponses: revision.targetCompletedResponses }, steps: publicSteps(graph.steps), choices: publicChoices(graph.steps, graph.choices), branchRules: publicRules(graph.rules), ...(identified ? { identity: 'identified' as const } : {}), ...(completionStepId ? { completedStepId: completionStepId } : {}) }
}
