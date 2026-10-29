import type { BuilderDraft, QuestionReport, Ledger, RevisionComparison } from '../src/core/app/api'
export type ScenarioCall = <T>(path: string, data?: unknown, method?: string) => Promise<T>
/** Synthetic records are collected through the real native endpoints. */
export async function collectAnswerScenario(call: ScenarioCall, slug: string) {
  const flow = await call<{ id: string }>('/api/app/flows', { title: 'Answer summary study', slug })
  const path = `/api/app/flows/${flow.id}`
  const draft = () => call<BuilderDraft>(`${path}/draft`)
  const types = ['short_text', 'long_text', 'email', 'single_choice', 'multiple_choice', 'rating', 'priority', 'dropdown', 'yes_no', 'nps', 'number', 'date', 'consent']
  for (const type of types) {
    const current = await draft()
    await call(`${path}/draft/steps`, { expectedVersion: current.flow.draftVersion, step: { kind: 'question', questionType: type, prompt: `Question ${type}`, required: false,
      ...(['single_choice', 'multiple_choice', 'priority', 'dropdown'].includes(type) ? { choices: [{ value: 'coffee', label: 'Coffee' }, { value: 'tea', label: 'Tea' }] } : {}),
      questionSettings: type === 'multiple_choice' ? { minSelections: 1, maxSelections: 2 } : type === 'rating' ? { min: 1, max: 5 } : type === 'consent' ? { statement: 'I agree to the stated terms.' } : type === 'number' ? { decimalPlaces: 1 } : {},
    } })
  }
  let current = await draft()
  await call(`${path}/draft/steps`, { expectedVersion: current.flow.draftVersion, step: { kind: 'completion', questionType: null, prompt: 'Recorded.' } })
  current = await draft()
  const publication = await call<{ revision: { id: string } }>(`${path}/publish`, { expectedVersion: current.flow.draftVersion })
  const receipts: string[] = []
  for (let index = 0; index < 12; index++) {
    const session = await call<{ sessionId: string; sessionToken: string }>(`/api/public/flows/${slug}/sessions`, { deviceClass: index % 2 ? 'mobile' : 'desktop', source: 'direct' })
    const answers = current.steps.filter(step => step.kind === 'question').map(step => {
      const options = current.choices.filter(choice => choice.stepId === step.id)
      let value: unknown
      switch (step.questionType) {
        case 'single_choice': case 'dropdown': value = options[index % 2].id; break
        case 'multiple_choice': value = options.map(choice => choice.id); break
        case 'priority': value = index % 2 ? options.map(choice => choice.id).reverse() : options.map(choice => choice.id); break
        case 'rating': value = index % 5 + 1; break
        case 'email': value = `answer${index}@example.com`; break
        case 'yes_no': value = index % 2 === 0; break
        case 'consent': value = index % 2 === 0; break
        case 'nps': value = index % 11; break
        case 'number': value = index - 5.5; break
        case 'date': value = `2024-02-${String(index + 1).padStart(2, '0')}`; break
        case 'short_text': case 'long_text': value = `Exact retained answer ${index}`; break
        default: throw new Error('Unexpected scenario question type')
      }
      return { stepId: step.id, value }
    })
    const receipt = await call<{ responseId: string; disposition: string }>(`/api/public/flows/${slug}/responses`, { ...session, idempotencyKey: `${slug}-response-${index}`, answers })
    if (receipt.disposition === 'quarantined') await call(`/api/app/responses/${receipt.responseId}/release`, {})
    if (receipt.disposition !== 'quarantined' && receipt.disposition !== 'released') throw new Error('Scenario response was not retained')
    receipts.push(receipt.responseId)
  }
  current = await draft()
  await call(`${path}/publish`, { expectedVersion: current.flow.draftVersion })
  const questions = (await call<QuestionReport[]>(`${path}/questions?revisionId=${publication.revision.id}`)).filter(question => question.questionType !== null)
  const ledger = await call<Ledger>(`${path}/ledger?revisionId=${publication.revision.id}`)
  const comparison = await call<RevisionComparison>(`${path}/questions/compare`)
  return { flow, path, revisionId: publication.revision.id, receipts, questions, ledger, comparison }
}

/** Different optional omissions keep each score's answered cohort distinct. */
export async function collectScoreTrendScenario(call: ScenarioCall, slug: string) {
  const flow = await call<{ id: string }>('/api/app/flows', { title: 'Workshop satisfaction', slug })
  const path = `/api/app/flows/${flow.id}`
  const draft = () => call<BuilderDraft>(`${path}/draft`)
  for (const [questionType, prompt] of [['csat', 'How satisfied were you?'], ['thumbs_rating', 'Was the workshop helpful?']]) {
    const current = await draft()
    await call(`${path}/draft/steps`, { expectedVersion: current.flow.draftVersion,
      step: { kind: 'question', questionType, prompt, required: false } })
  }
  let current = await draft()
  await call(`${path}/draft/steps`, { expectedVersion: current.flow.draftVersion,
    step: { kind: 'completion', questionType: null, prompt: 'Thank you for your feedback.' } })
  current = await draft()
  await call(`${path}/publish`, { expectedVersion: current.flow.draftVersion })
  const rows = [
    { csat: 5, thumbs_rating: true },
    { csat: 4, thumbs_rating: false },
    { csat: 1, thumbs_rating: true },
    { thumbs_rating: false },
    { thumbs_rating: true },
    { csat: 2 },
  ]
  for (const [index, row] of rows.entries()) {
    const session = await call<{ sessionId: string; sessionToken: string }>(`/api/public/flows/${slug}/sessions`, { deviceClass: 'desktop', source: 'direct' })
    const answers = current.steps.filter(step => step.kind === 'question' && Object.hasOwn(row, step.questionType!))
      .map(step => ({ stepId: step.id, value: row[step.questionType as keyof typeof row] }))
    const receipt = await call<{ responseId: string; disposition: string }>(`/api/public/flows/${slug}/responses`,
      { ...session, idempotencyKey: `${slug}-response-${index}`, answers })
    if (receipt.disposition === 'quarantined') await call(`/api/app/responses/${receipt.responseId}/release`, {})
    if (receipt.disposition !== 'quarantined' && receipt.disposition !== 'released') throw new Error('Score response was not retained')
  }
  const questions = await call<QuestionReport[]>(`${path}/questions`)
  return { flow, questions }
}
