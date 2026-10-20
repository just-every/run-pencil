import type { BuilderDraft } from '../src/core/app/api'
import type { ScenarioCall } from './results-scenario'

/** A separate exposure cohort; the original 43-response statistics matrix stays unchanged. */
export async function collectDisclosureScenario(call: ScenarioCall, slug: string) {
  const flow = await call<{ id: string }>('/api/app/flows', { title: 'Plan renewal study', slug })
  const path = `/api/app/flows/${flow.id}`
  const draft = () => call<BuilderDraft>(`${path}/draft`)
  for (const step of [
    { kind: 'question', questionType: 'single_choice', required: true, prompt: 'Plan', choices: [{ value: 'starter', label: 'Starter' }, { value: 'growth', label: 'Growth' }, { value: 'scale', label: 'Scale' }] },
    { kind: 'question', questionType: 'single_choice', required: true, prompt: 'Renewal', choices: [{ value: 'renew', label: 'Renew' }, { value: 'churn', label: 'Churn' }] },
    { kind: 'completion', questionType: null, prompt: 'Thank you.' },
  ]) {
    const current = await draft()
    await call(`${path}/draft/steps`, { expectedVersion: current.flow.draftVersion, step })
  }
  const current = await draft()
  const publication = await call<{ revision: { id: string } }>(`${path}/publish`, { expectedVersion: current.flow.draftVersion })
  const [plan, renewal] = current.steps.filter(step => step.kind === 'question')
  const choice = (stepId: string, index: number) => current.choices.filter(item => item.stepId === stepId)[index].id
  const matrix = [[10, 5], [10, 10], [3, 5]]
  const receipts: string[] = [], exposedIds: string[] = []
  for (const [p, row] of matrix.entries()) for (const [r, count] of row.entries()) for (let n = 0; n < count; n++) {
    const session = await call<{ sessionId: string; sessionToken: string }>(`/api/public/flows/${slug}/sessions`, { deviceClass: 'desktop', source: 'direct' })
    const receipt = await call<{ responseId: string; disposition: string }>(`/api/public/flows/${slug}/responses`, {
      ...session, idempotencyKey: `${slug}-${p}-${r}-${n}`,
      answers: [{ stepId: plan.id, value: choice(plan.id, p) }, { stepId: renewal.id, value: choice(renewal.id, r) }],
    })
    // The ordinary operator release route admits fast synthetic submissions, just as in the existing answer scenario.
    if (receipt.disposition === 'quarantined') await call(`/api/app/responses/${receipt.responseId}/release`, {})
    else if (receipt.disposition !== 'released') throw new Error('Exposure response was not retained')
    receipts.push(receipt.responseId)
    if (p === 2 && r === 0) exposedIds.push(receipt.responseId)
  }
  // No submissions or releases follow: every read and export uses this fixed population at its reported cutoff.
  const revisionId = publication.revision.id
  const filter = { revisionId, answerStepId: renewal.id, answerValue: choice(renewal.id, 0), search: 'Scale' }
  return { flow, path, revisionId, planId: plan.id, renewalId: renewal.id, scaleId: choice(plan.id, 2), renewId: choice(renewal.id, 0), receipts, exposedIds, filter }
}
