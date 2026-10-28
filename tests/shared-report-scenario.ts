import type { BuilderDraft } from '../src/core/app/api'
import type { ScenarioCall } from './results-scenario'

/** Shared report disclosure fixture, created through the same doors as ordinary operators and respondents. */
export async function collectSharedReportScenario(call: ScenarioCall, slug: string) {
  const flow = await call<{ id: string }>('/api/app/flows', { title: 'synthetic-pencil-12', slug })
  const path = `/api/app/flows/${flow.id}`
  const draft = () => call<BuilderDraft>(path + '/draft')
  for (const step of [
    { kind: 'question', questionType: 'single_choice', required: true, prompt: 'Plan', choices: [{ value: 'synthetic-pencil-1', label: 'Starter' }, { value: 'synthetic-pencil-2', label: 'Growth' }, { value: 'synthetic-pencil-3', label: 'Scale' }] },
    { kind: 'question', questionType: 'single_choice', required: true, prompt: 'Renewal', choices: [{ value: 'synthetic-pencil-4', label: 'Renew' }, { value: 'synthetic-pencil-5', label: 'Churn' }] },
    { kind: 'question', questionType: 'multiple_choice', required: true, prompt: 'synthetic-pencil-6', choices: [{ value: 'synthetic-pencil-6', label: 'synthetic-pencil-6' }, { value: 'synthetic-pencil-7', label: 'synthetic-pencil-7' }] },
    { kind: 'question', questionType: 'short_text', required: true, prompt: 'synthetic-pencil-8' },
    { kind: 'completion', questionType: null, prompt: 'synthetic-pencil-9' },
  ]) {
    const current = await draft()
    await call(path + '/draft/steps', { expectedVersion: current.flow.draftVersion, step })
  }
  let current = await draft()
  await call(path + '/draft/settings', { expectedVersion: current.flow.draftVersion, settings: { identityMode: 'identified', hiddenFields: [
    { id: 'synthetic-pencil-13', name: 'synthetic_pencil_13', type: 'text', category: 'identifying' },
    { id: 'synthetic-pencil-14', name: 'synthetic_pencil_14', type: 'text', category: 'plain' },
  ] } }, 'PUT')
  current = await draft()
  const publication = await call<{ revision: { id: string } }>(path + '/publish', { expectedVersion: current.flow.draftVersion })
  const [plan, renewal, multi, text] = current.steps.filter(step => step.kind === 'question')
  const choice = (stepId: string, index: number) => current.choices.filter(item => item.stepId === stepId)[index].id
  const subset = await call<{ id: string; publicKey: string }>(path + '/collectors', { name: 'synthetic-pencil-15', channel: 'web' })
  const remainder = await call<{ id: string; publicKey: string }>(path + '/collectors', { name: 'synthetic-pencil-16', channel: 'web' })
  const matrix = [[10, 5], [10, 10], [3, 5]]
  const receipts: string[] = [], exposedIds: string[] = []
  const identityValue = 'synthetic-pencil-17', rareValue = 'synthetic-pencil-18', excerpt = 'synthetic-pencil-19'
  for (const [p, row] of matrix.entries()) for (const [r, count] of row.entries()) for (let n = 0; n < count; n++) {
    const collector = receipts.length < 40 ? subset : remainder
    const session = await call<{ sessionId: string; sessionToken: string }>(`/api/public/flows/${slug}/sessions`, { deviceClass: 'desktop', source: 'direct', collectorKey: collector.publicKey })
    const receipt = await call<{ responseId: string; disposition: string }>(`/api/public/flows/${slug}/responses`, {
      ...session, idempotencyKey: `${slug}-${p}-${r}-${n}`,
      hidden: { synthetic_pencil_13: identityValue, synthetic_pencil_14: p === 2 && r === 0 ? rareValue : 'synthetic-pencil-20' },
      answers: [{ stepId: plan.id, value: choice(plan.id, p) }, { stepId: renewal.id, value: choice(renewal.id, r) }, { stepId: multi.id, value: [choice(multi.id, 0), choice(multi.id, 1)] }, { stepId: text.id, value: excerpt }],
    })
    if (receipt.disposition === 'quarantined') await call(`/api/app/responses/${receipt.responseId}/release`, {})
    else if (receipt.disposition !== 'released') throw new Error('Shared report response was not retained')
    receipts.push(receipt.responseId)
    if (p === 2 && r === 0) exposedIds.push(receipt.responseId)
  }
  return { flow: { ...flow, slug }, path, revisionId: publication.revision.id, planId: plan.id, renewalId: renewal.id, multiId: multi.id, textId: text.id,
    scaleId: choice(plan.id, 2), renewId: choice(renewal.id, 0), multiChoiceIds: [choice(multi.id, 0), choice(multi.id, 1)], receipts, exposedIds, subsetCollectorId: subset.id,
    filter: { revisionId: publication.revision.id, answerStepId: renewal.id, answerValue: choice(renewal.id, 0), search: 'Scale' },
    identityFieldId: 'synthetic-pencil-13', observedFieldId: 'synthetic-pencil-14', identityValue, rareValue, excerpt }
}
