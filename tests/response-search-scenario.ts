import type { BuilderDraft } from '../src/core/app/api'
import type { ScenarioCall } from './results-scenario'

/** Real collection, two immutable revisions and one unreleased response. */
export async function collectResponseSearchScenario(call: ScenarioCall, slug: string) {
  const flow = await call<{ id: string }>('/api/app/flows', { title: 'Harbour Cafe customer feedback', slug })
  const path = `/api/app/flows/${flow.id}`
  const draft = () => call<BuilderDraft>(`${path}/draft`)
  for (const step of [
    { kind: 'question', questionType: 'long_text', prompt: 'What could we do better?', required: true },
    { kind: 'question', questionType: 'single_choice', prompt: 'What did you order?', required: true, choices: [{ label: 'Cold brew', value: 'cold-brew' }, { label: 'Tea', value: 'tea' }] },
    { kind: 'question', questionType: 'email', prompt: 'Your email for a reply', required: false },
    { kind: 'completion', questionType: null, prompt: 'Thank you for helping us improve.' },
  ]) await call(`${path}/draft/steps`, { expectedVersion: (await draft()).flow.draftVersion, step })
  const current = await draft()
  const publish = async () => call<{ revision: { id: string } }>(`${path}/publish`, { expectedVersion: (await draft()).flow.draftVersion })
  const first = await publish()
  const [text, choice, email] = current.steps
  const options = current.choices.filter(option => option.stepId === choice.id)
  const submit = async (message: string, option: number, release = true) => {
    const session = await call<{ sessionId: string; sessionToken: string }>(`/api/public/flows/${slug}/sessions`, { deviceClass: 'mobile', source: 'direct' })
    const receipt = await call<{ responseId: string; disposition: string }>(`/api/public/flows/${slug}/responses`, { ...session, idempotencyKey: `search-${session.sessionId}`, answers: [
      { stepId: text.id, value: message }, { stepId: choice.id, value: options[option].id }, { stepId: email.id, value: option ? 'tea@example.test' : 'Jo.Cafe@example.test' },
    ] })
    if (release && receipt.disposition === 'quarantined') await call(`/api/app/responses/${receipt.responseId}/release`, {})
    return receipt.responseId
  }
  const slow = await submit('The queue moved slowly.', 0)
  const tea = await submit('Loved the tea.', 1)
  const second = await publish()
  const faster = await submit('The queue was shorter.', 1)
  const quarantined = await submit('queue awaiting review', 1, false)
  const unicode = await submit('Le CAFE\u0301 et la Straße sont agréables. Очень ВКУСНО.', 1)
  return { flowId: flow.id, path, firstRevision: first.revision.id, secondRevision: second.revision.id, slow, tea, faster, quarantined, unicode }
}
