import { developmentInbox } from '../helpers/development-outbox'
import { devKeyHeaders } from '../helpers/dev-key.mjs'
import { operatorEmail } from './auth-identity'
import { expect } from './fixtures'
import { contract } from './contract'
import type { BuilderDraft, RevisionComparison } from '../../src/core/app/api'

// Native APIRequestContext only. No browser/context/page fixture or external send.
contract('RSLT-005', 'native revision comparison keeps absent questions, containing-revision cohorts and historical labels distinct', async ({ request }, info) => {
  const slug = `native-comparison-${info.project.name}-${Date.now()}`
  const headers = { Origin: new URL(info.project.use.baseURL!).origin, 'CF-Connecting-IP': `198.18.155.${info.project.name === 'mobile' ? 44 : 43}` }
  const ok = async <T,>(path: string, data?: unknown, method = data === undefined ? 'GET' : 'POST'): Promise<T> => {
    const response = await request.fetch(path, { method, headers, ...(data === undefined ? {} : { data }) })
    expect(response.status(), path).toBeGreaterThanOrEqual(200); expect(response.status(), path).toBeLessThan(300)
    return response.status() === 204 ? undefined as T : await response.json() as T
  }
  await ok('/auth/magic-link', { email: operatorEmail() })
  const inbox = await developmentInbox(path => request.get(path, { headers: devKeyHeaders }), operatorEmail())
  expect((await request.post('/auth/confirm', { data: { token: inbox.messages[0].magicLinkToken }, headers, maxRedirects: 0 })).status()).toBe(303)
  const flow = await ok<{ id: string }>('/api/app/flows', { title: `Synthetic comparison ${info.project.name}`, slug })
  const path = `/api/app/flows/${flow.id}`
  const draft = () => ok<BuilderDraft>(`${path}/draft`)
  const add = async (step: unknown) => { const current = await draft(); await ok(`${path}/draft/steps`, { expectedVersion: current.flow.draftVersion, step }) }
  await add({ kind: 'question', questionType: 'single_choice', prompt: 'Repeated question title', required: true, choices: [{ value: 'a', label: 'Original answer' }, { value: 'b', label: 'Other answer' }] })
  await add({ kind: 'completion', questionType: null, prompt: 'Recorded.' })
  let current = await draft(); const original = current.steps[0]; const choice = current.choices[0]
  await ok(`${path}/publish`, { expectedVersion: current.flow.draftVersion })
  const submit = async (answers: unknown[], key: string) => {
    const session = await ok<{ sessionId: string; sessionToken: string; revisionId: string }>(`/api/public/flows/${slug}/sessions`, { deviceClass: 'desktop', source: 'direct' })
    const receipt = await ok<{ responseId: string; disposition: string }>(`/api/public/flows/${slug}/responses`, { ...session, idempotencyKey: key, answers })
    expect(['quarantined', 'released']).toContain(receipt.disposition)
    return { ...session, ...receipt }
  }
  const release = async (response: { responseId: string; disposition: string }) => { if (response.disposition === 'quarantined') await ok(`/api/app/responses/${response.responseId}/release`, {}) }
  const old = await submit([{ stepId: original.id, value: choice.id }], `${slug}-old-key`); await release(old)
  current = await draft()
  await ok(`${path}/draft`, { stepId: original.id, prompt: original.prompt, required: true, expectedVersion: current.flow.draftVersion, choices: current.choices.map(value => ({ id: value.id, value: value.value, label: value.id === choice.id ? 'Changed answer' : value.label })) }, 'PUT')
  await add({ kind: 'question', questionType: 'rating', prompt: original.prompt, required: false, questionSettings: { min: 1, max: 5 } })
  current = await draft(); const added = current.steps.find(step => step.questionType === 'rating')!
  expect(added.id).not.toBe(original.id)
  await ok(`${path}/publish`, { expectedVersion: current.flow.draftVersion })
  const answered = await submit([{ stepId: original.id, value: choice.id }, { stepId: added.id, value: 5 }], `${slug}-new-answered-key`); await release(answered)
  const omitted = await submit([{ stepId: original.id, value: choice.id }], `${slug}-new-optional-key`); await release(omitted)
  const comparison = await ok<RevisionComparison>(`${path}/questions/compare`)
  const repeated = comparison.questions.find(question => question.id === original.id)!
  expect(repeated.versions.map(version => [version.revisionId, version.answered, version.eligibleResponses])).toEqual([[answered.revisionId, 2, 2], [old.revisionId, 1, 1]])
  expect(repeated.versions[0].distribution).toContainEqual({ value: choice.id, label: 'Changed answer', count: 2 })
  expect(repeated.versions[1].distribution).toContainEqual({ value: choice.id, label: 'Original answer', count: 1 })
  const later = comparison.questions.find(question => question.id === added.id)!
  expect(later).toMatchObject({ answered: 1, eligibleResponses: 2 })
  expect(later.versions).toHaveLength(1)
  expect(later.versions[0]).toMatchObject({ revisionId: answered.revisionId, answered: 1, eligibleResponses: 2, distribution: [{ value: 5, label: '5', count: 1 }] })
  expect(comparison.questions.filter(question => question.versions[0].prompt === original.prompt)).toHaveLength(2)
  expect(JSON.stringify(comparison)).not.toMatch(/sessionToken|responseId|deviceClass/)
  await ok(`${path}/archive`, {})
  expect(await ok(`${path}/questions/compare`)).toEqual(comparison)
  expect((await request.get(`/f/${slug}`, { headers })).status()).toBe(404)
})
