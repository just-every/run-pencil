import type { BuilderDraft, Ledger, LedgerResponse } from '../src/core/app/api'
import type { ImportReview } from '../src/core/features/importing/model'
import type { ScenarioCall } from './results-scenario'

export const consentStatement = 'I accept the terms, including "retained consent".'
/** Both cohorts enter through native collection or the reviewed import API. */
export async function collectLedgerFilterScenario(call: ScenarioCall, title: string) {
  const choices = [{ ref: 'coffee', label: 'Coffee' }, { ref: 'tea', label: 'Tea' }]
  const fields = [
    { ref: 'yes', type: 'yes_no', title: 'Return?' },
    { ref: 'consent', type: 'legal', title: consentStatement },
    { ref: 'number', type: 'number', title: 'Visits' },
    { ref: 'date', type: 'date', title: 'Visit date' },
    { ref: 'nps', type: 'nps', title: 'Recommend' },
    { ref: 'rating', type: 'rating', title: 'Stars', properties: { steps: 5 } },
    { ref: 'dropdown', type: 'dropdown', title: 'Drink', properties: { choices } },
    { ref: 'email', type: 'email', title: 'Email' },
    { ref: 'multi', type: 'multiple_choice', title: 'Enjoyed', properties: { choices, allow_multiple_selection: true } },
    { ref: 'priority', type: 'ranking', title: 'Priority', properties: { choices } },
  ]
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`
  const rows = [fields.map(field => field.title).concat('Submit Date'),
    ['1', '1', '11', '2024-02-29', '10', '5', 'Coffee', 'Mixed.Case@Example.test', '["Coffee","Tea"]', '["Coffee","Tea"]', '2024-03-01 10:00:00'],
    ['0', '0', '0', '2024-03-01', '0', '1', 'Tea', 'Other@Example.test', '["Tea"]', '["Tea","Coffee"]', '2024-03-02 10:00:00'],
  ]
  const input = { definition: JSON.stringify({ title, fields, thankyou_screens: [{ ref: 'end', title: 'Recorded.' }] }), csv: rows.map(row => row.map(quote).join(',')).join('\r\n') }
  const review = await call<ImportReview>('/api/app/imports/review', input)
  if (review.rowErrors.length) throw new Error(`Invalid synthetic import: ${JSON.stringify(review.rowErrors)}`)
  let job = await call<{ id: string; state: string }>('/api/app/imports/commit', { ...input, plannedAt: review.plannedAt, columns: review.columns, fingerprint: review.fingerprint, acknowledged: true })
  while (job.state === 'preparing' || job.state === 'applying') job = await call(`/api/app/imports/${job.id}/resume`, {})
  if (job.state !== 'completed') throw new Error('Synthetic import did not finish')
  const path = `/api/app/flows/${review.flowId}`
  const imported = await call<Ledger>(`${path}/ledger?source=imported`)
  const current = await call<BuilderDraft>(`${path}/draft`)
  const publication = await call<{ kind: string; revision?: { id: string }; latestVersion?: number }>(`${path}/publish`, { expectedVersion: current.flow.draftVersion })
  if (!publication.revision) throw new Error(`Ledger scenario publication failed: ${JSON.stringify(publication)}; draft version ${current.flow.draftVersion}`)
  const submit = async (positive: boolean, release = true) => {
    const session = await call<{ sessionId: string; sessionToken: string }>(`/api/public/flows/${current.flow.slug}/sessions`, { deviceClass: 'desktop', source: 'direct' })
    const answers = current.steps.filter(step => step.kind === 'question').map(step => {
      const options = current.choices.filter(choice => choice.stepId === step.id)
      const values: Record<string, unknown> = { yes_no: positive, consent: positive, number: positive ? 11 : 0, date: positive ? '2024-02-29' : '2024-03-01', nps: positive ? 10 : 0, rating: positive ? 5 : 1, email: positive ? 'Mixed.Case@Example.test' : 'Other@Example.test' }
      const value = step.questionType === 'dropdown' ? options[positive ? 0 : 1].id : step.questionType === 'multiple_choice' ? (positive ? options : options.slice(1)).map(choice => choice.id) : step.questionType === 'priority' ? (positive ? options : [...options].reverse()).map(choice => choice.id) : values[step.questionType!]
      return { stepId: step.id, value }
    })
    const receipt = await call<{ responseId: string; disposition: string }>(`/api/public/flows/${current.flow.slug}/responses`, { ...session, idempotencyKey: `answer-${session.sessionId}`, answers })
    if (release && receipt.disposition === 'quarantined') await call(`/api/app/responses/${receipt.responseId}/release`, {})
    return receipt
  }
  const nativePositive = await submit(true), nativeNegative = await submit(false)
  const stepId = (type: string) => current.steps.find(step => step.questionType === type)!.id
  const isPositive = (response: LedgerResponse) => response.answers.find(answer => answer.questionType === 'yes_no')?.value === true
  return { path, flowId: review.flowId, stepId, current, importedRevisionId: imported.responses[0].revisionId, nativeRevisionId: publication.revision.id, importedPositive: imported.responses.find(isPositive)!, importedNegative: imported.responses.find(response => !isPositive(response))!, nativePositive, nativeNegative, submit }
}
