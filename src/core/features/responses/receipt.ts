import { completionRedirect } from '../../shared/completionRedirect'
import { variableAnswers } from '../../shared/calculationContext'
import { formSettings, hiddenAnswers, type ResponseContext } from '../../shared/hiddenFields'
import { revisionBranchSelection } from '../../shared/flowPolicies'
import { NotFoundError } from '../../shared/errors'
import { publicChoices, publicRules, publicSteps, type FlowRepository } from '../flows'
import { runtimeAnswerValue } from './answerStorage'
import { retainedCompletion } from './path'
import type { ResponseRepository } from './repository'

export type StoredResponse = { id: string; revisionId: string; state: 'released' | 'quarantined'; contextJson?: string }

/** A retry is the original committed path, regardless of newer submitted values.
 * The immutable graph and retained answers also cover old rows. */
export async function completionReceipt(flows: FlowRepository, responses: ResponseRepository, response: StoredResponse) {
  const [{ steps, choices, rules }, answers, revision] = await Promise.all([
    flows.getRevisionGraph(response.revisionId),
    responses.getRetainedResponseAnswers(response.id),
    flows.findRevisionById(response.revisionId),
  ])
  if (!answers || !revision) throw new NotFoundError('This completed response is no longer available.')
  const retainedContext = JSON.parse(response.contextJson ?? '{}') as ResponseContext
  const values = Object.fromEntries(answers.map(answer => [answer.stepId, runtimeAnswerValue(steps.find(step => step.stableId === answer.stepId), JSON.parse(answer.valueJson))]))
  const completionStepId = retainedCompletion(steps, rules, { ...hiddenAnswers(retainedContext), ...variableAnswers(retainedContext.calculations), ...values }, revisionBranchSelection(revision.policySnapshotJson))
  const redirectUrl = completionRedirect({ steps: publicSteps(steps), choices: publicChoices(steps, choices), branchRules: publicRules(rules), formSettings: formSettings(revision.formSettingsJson), hiddenContext: retainedContext }, completionStepId, values)
  return { responseId: response.id, idempotent: true, disposition: response.state, completionStepId, redirectUrl: response.state === 'released' ? redirectUrl : null }
}
